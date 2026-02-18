const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8000);
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const SPORTS_API_URL = process.env.SPORTS_API_URL || '';
const SPORTS_API_TIMEOUT_MS = Number(process.env.SPORTS_API_TIMEOUT_MS || 4000);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 30000);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-admin-token';
const RATE_LIMIT_FREE_PER_MIN = Number(process.env.RATE_LIMIT_FREE_PER_MIN || 60);
const RATE_LIMIT_PRO_PER_MIN = Number(process.env.RATE_LIMIT_PRO_PER_MIN || 600);
const MONTHLY_QUOTA_FREE = Number(process.env.MONTHLY_QUOTA_FREE || 5000);
const MONTHLY_QUOTA_PRO = Number(process.env.MONTHLY_QUOTA_PRO || 100000);
const DEMO_PUBLIC_API_KEY = process.env.DEMO_PUBLIC_API_KEY || 'rz_demo_public_key';

const matchesCache = new Map();
const apiKeys = new Map();
const usageByKey = new Map();
const rateLimits = new Map();

const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  upstreamRequests: 0,
  upstreamFailures: 0,
  fallbackUses: 0,
  apiAuthFailures: 0,
  rateLimitBlocks: 0,
  quotaBlocks: 0,
};

const matchCatalog = {
  football: [
    'Premier League: Manchester City vs Arsenal',
    'La Liga: Barcelona vs Sevilla',
    'Serie A: Inter Milan vs Juventus',
  ],
  cricket: [
    'IPL: Chennai Super Kings vs Mumbai Indians',
    'ODI: India vs Australia',
    'Test: England vs South Africa',
  ],
  badminton: [
    'BWF Open: Lakshya Sen vs Viktor Axelsen',
    'Women Singles: P. V. Sindhu vs An Se-young',
    'Doubles: Satwik/Chirag vs Ahsan/Setiawan',
  ],
  hockey: [
    'FIH Pro League: India vs Netherlands',
    'Champions Trophy: Germany vs Belgium',
    'Asia Cup: Pakistan vs Malaysia',
  ],
  chess: [
    'Rapid Arena: Carlsen vs Nakamura',
    'Candidates: Nepomniachtchi vs Firouzja',
    'Chess.com Finals: Gukesh vs Praggnanandhaa',
  ],
  tennis: [
    'ATP Tour: Djokovic vs Alcaraz',
    'WTA Tour: Swiatek vs Sabalenka',
    'Doubles: Ram/Salisbury vs Bopanna/Ebden',
  ],
  basketball: [
    'NBA: Lakers vs Warriors',
    'EuroLeague: Real Madrid vs Fenerbahce',
    'NBA: Celtics vs Bucks',
  ],
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};


apiKeys.set(DEMO_PUBLIC_API_KEY, {
  userId: 'demo-user',
  plan: 'free',
  createdAt: new Date().toISOString(),
  revoked: false,
});

const PLAN_CONFIG = {
  free: {
    rateLimitPerMin: RATE_LIMIT_FREE_PER_MIN,
    monthlyQuota: MONTHLY_QUOTA_FREE,
  },
  pro: {
    rateLimitPerMin: RATE_LIMIT_PRO_PER_MIN,
    monthlyQuota: MONTHLY_QUOTA_PRO,
  },
};

function getPlanConfig(plan) {
  return PLAN_CONFIG[plan] || PLAN_CONFIG.free;
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function ensureUsageRecord(apiKey) {
  const month = getCurrentMonth();
  const current = usageByKey.get(apiKey);

  if (!current || current.month !== month) {
    const resetRecord = {
      month,
      requests: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimited: 0,
      lastRequestAt: null,
    };
    usageByKey.set(apiKey, resetRecord);
    return resetRecord;
  }

  return current;
}

function trackUsage(apiKey, updates = {}) {
  const entry = ensureUsageRecord(apiKey);
  entry.requests += Number(updates.requests || 0);
  entry.errors += Number(updates.errors || 0);
  entry.cacheHits += Number(updates.cacheHits || 0);
  entry.cacheMisses += Number(updates.cacheMisses || 0);
  entry.rateLimited += Number(updates.rateLimited || 0);
  entry.lastRequestAt = new Date().toISOString();
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function serveStaticFile(reqPath, res) {
  const relativePath = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(FRONTEND_DIR, relativePath);

  if (!resolvedPath.startsWith(path.resolve(FRONTEND_DIR))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolvedPath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function normalizeRemoteMatches(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => String(item));
  }

  if (Array.isArray(payload?.matches)) {
    return payload.matches.map((item) => String(item));
  }

  return [];
}

function getCachedMatches(sport) {
  const cachedEntry = matchesCache.get(sport);
  if (!cachedEntry) {
    return null;
  }

  if (Date.now() >= cachedEntry.expiresAt) {
    matchesCache.delete(sport);
    return null;
  }

  return {
    ...cachedEntry.payload,
    cached: true,
  };
}

function setCachedMatches(sport, payload) {
  matchesCache.set(sport, {
    payload: {
      ...payload,
      cached: false,
    },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function fetchRemoteMatches(sport) {
  if (!SPORTS_API_URL) {
    return null;
  }

  metrics.upstreamRequests += 1;

  const upstreamUrl = new URL(SPORTS_API_URL);
  upstreamUrl.searchParams.set('sport', sport);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SPORTS_API_TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Upstream status ${response.status}`);
    }

    const body = await response.json();
    const matches = normalizeRemoteMatches(body);

    return {
      sport,
      source: 'upstream-proxy',
      matches,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildMatchesPayload(sport) {
  try {
    const proxied = await fetchRemoteMatches(sport);

    if (proxied) {
      return proxied;
    }
  } catch (error) {
    metrics.upstreamFailures += 1;
    metrics.fallbackUses += 1;

    return {
      sport,
      source: 'local-demo-backend',
      fallbackReason: String(error.message || error),
      matches: matchCatalog[sport] || [],
    };
  }

  return {
    sport,
    source: 'local-demo-backend',
    matches: matchCatalog[sport] || [],
  };
}

function authenticateApiKey(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    metrics.apiAuthFailures += 1;
    sendJson(res, 401, { error: 'API key required', hint: 'Set x-api-key header' });
    return null;
  }

  const keyRecord = apiKeys.get(apiKey);
  if (!keyRecord || keyRecord.revoked) {
    metrics.apiAuthFailures += 1;
    sendJson(res, 403, { error: 'Invalid API key' });
    return null;
  }

  return { apiKey, keyRecord };
}

function enforceMonthlyQuota(apiKey, plan, res) {
  const usageRecord = ensureUsageRecord(apiKey);
  const { monthlyQuota } = getPlanConfig(plan);

  if (usageRecord.requests >= monthlyQuota) {
    metrics.quotaBlocks += 1;
    sendJson(res, 429, {
      error: 'Monthly quota exceeded',
      month: usageRecord.month,
      requests: usageRecord.requests,
      quota: monthlyQuota,
      plan,
    });
    return false;
  }

  return true;
}

function enforceRateLimit(apiKey, plan, res) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const { rateLimitPerMin } = getPlanConfig(plan);

  let bucket = rateLimits.get(apiKey);
  if (!bucket || now >= bucket.resetTime) {
    bucket = {
      count: 0,
      resetTime: now + windowMs,
    };
    rateLimits.set(apiKey, bucket);
  }

  if (bucket.count >= rateLimitPerMin) {
    metrics.rateLimitBlocks += 1;
    trackUsage(apiKey, { rateLimited: 1 });

    const resetInMs = Math.max(0, bucket.resetTime - now);
    sendJson(
      res,
      429,
      {
        error: 'Rate limit exceeded',
        limit: rateLimitPerMin,
        resetInMs,
      },
      {
        'Retry-After': String(Math.ceil(resetInMs / 1000)),
      },
    );
    return false;
  }

  bucket.count += 1;
  return true;
}

async function handleAdminCreateKey(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: String(error.message || error) });
    return;
  }

  const userId = String(body.userId || '').trim();
  const plan = String(body.plan || 'free').toLowerCase();

  if (!userId) {
    sendJson(res, 400, { error: 'userId required' });
    return;
  }

  if (!PLAN_CONFIG[plan]) {
    sendJson(res, 400, { error: 'Unsupported plan', supportedPlans: Object.keys(PLAN_CONFIG) });
    return;
  }

  const key = `rz_${crypto.randomBytes(16).toString('hex')}`;
  apiKeys.set(key, {
    userId,
    plan,
    createdAt: new Date().toISOString(),
    revoked: false,
  });

  sendJson(res, 201, {
    apiKey: key,
    userId,
    plan,
    createdAt: apiKeys.get(key).createdAt,
  });
}

async function handleAdminRevokeKey(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: String(error.message || error) });
    return;
  }

  const apiKey = String(body.apiKey || '').trim();
  if (!apiKey) {
    sendJson(res, 400, { error: 'apiKey required' });
    return;
  }

  const record = apiKeys.get(apiKey);
  if (!record) {
    sendJson(res, 404, { error: 'API key not found' });
    return;
  }

  record.revoked = true;
  sendJson(res, 200, { success: true, apiKey });
}

function isAdminAuthorized(req) {
  return req.headers['x-admin-token'] === ADMIN_TOKEN;
}

async function handleMatchesRequest(req, requestUrl, res) {
  const auth = authenticateApiKey(req, res);
  if (!auth) {
    return;
  }

  const { apiKey, keyRecord } = auth;
  const { plan } = keyRecord;

  if (!enforceMonthlyQuota(apiKey, plan, res)) {
    return;
  }

  if (!enforceRateLimit(apiKey, plan, res)) {
    return;
  }

  const sport = (requestUrl.searchParams.get('sport') || 'football').toLowerCase();

  const cachedPayload = getCachedMatches(sport);
  if (cachedPayload) {
    metrics.cacheHits += 1;
    trackUsage(apiKey, { requests: 1, cacheHits: 1 });
    sendJson(res, 200, {
      ...cachedPayload,
      plan,
    });
    return;
  }

  metrics.cacheMisses += 1;

  try {
    const payload = await buildMatchesPayload(sport);
    setCachedMatches(sport, payload);
    trackUsage(apiKey, { requests: 1, cacheMisses: 1 });

    sendJson(res, 200, {
      ...payload,
      cached: false,
      plan,
    });
  } catch (error) {
    trackUsage(apiKey, { requests: 1, errors: 1, cacheMisses: 1 });
    sendJson(res, 500, {
      error: 'Failed to build match payload',
      details: String(error.message || error),
    });
  }
}

function handleUsageRequest(req, res) {
  const auth = authenticateApiKey(req, res);
  if (!auth) {
    return;
  }

  const { apiKey, keyRecord } = auth;
  const usage = ensureUsageRecord(apiKey);
  const planLimits = getPlanConfig(keyRecord.plan);

  sendJson(res, 200, {
    apiKey,
    userId: keyRecord.userId,
    plan: keyRecord.plan,
    month: usage.month,
    requests: usage.requests,
    errors: usage.errors,
    cacheHits: usage.cacheHits,
    cacheMisses: usage.cacheMisses,
    rateLimited: usage.rateLimited,
    monthlyQuota: planLimits.monthlyQuota,
    remainingQuota: Math.max(0, planLimits.monthlyQuota - usage.requests),
    lastRequestAt: usage.lastRequestAt,
  });
}

function handleHealthRequest(res) {
  sendJson(res, 200, {
    status: 'ok',
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    demoApiKey: DEMO_PUBLIC_API_KEY,
  });
}

function handleMetricsRequest(res) {
  const keyCount = Array.from(apiKeys.values()).filter((item) => !item.revoked).length;

  sendJson(res, 200, {
    ...metrics,
    cacheEntries: matchesCache.size,
    cacheTtlMs: CACHE_TTL_MS,
    upstreamConfigured: Boolean(SPORTS_API_URL),
    activeApiKeys: keyCount,
    usageTrackedKeys: usageByKey.size,
    demoApiKeyEnabled: Boolean(DEMO_PUBLIC_API_KEY),
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === '/admin/create-key' && req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: 'Admin token required' });
      return;
    }
    await handleAdminCreateKey(req, res);
    return;
  }

  if (requestUrl.pathname === '/admin/revoke-key' && req.method === 'POST') {
    if (!isAdminAuthorized(req)) {
      sendJson(res, 401, { error: 'Admin token required' });
      return;
    }
    await handleAdminRevokeKey(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/matches' && req.method === 'GET') {
    await handleMatchesRequest(req, requestUrl, res);
    return;
  }

  if (requestUrl.pathname === '/api/usage' && req.method === 'GET') {
    handleUsageRequest(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/health' && req.method === 'GET') {
    handleHealthRequest(res);
    return;
  }

  if (requestUrl.pathname === '/api/metrics' && req.method === 'GET') {
    handleMetricsRequest(res);
    return;
  }

  serveStaticFile(requestUrl.pathname, res);
});

server.listen(PORT, () => {
  console.log(`Sports Zone server running at http://localhost:${PORT}`);
});
