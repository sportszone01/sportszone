const AUTO_REFRESH_MS = 30000;
const refreshTimers = {};
const DEFAULT_API_KEY = 'rz_demo_public_key';

function getApiKey() {
  return localStorage.getItem('RZ_API_KEY') || DEFAULT_API_KEY;
}

function showSport(sportId, clickedButton) {
  const sections = document.querySelectorAll('.content');
  sections.forEach((section) => {
    section.classList.remove('active');
  });

  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach((button) => {
    button.classList.remove('active');
  });

  const targetSection = document.getElementById(sportId);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  if (clickedButton) {
    clickedButton.classList.add('active');
  }
}

async function loadLiveMatches(sportId, triggerButton) {
  const liveList = document.getElementById(`${sportId}-live-list`);
  if (!liveList) {
    return;
  }

  if (triggerButton) {
    triggerButton.disabled = true;
    triggerButton.textContent = 'Loading...';
  }

  liveList.innerHTML = '<li>Fetching live matches...</li>';

  try {
    const response = await fetch(`/api/matches?sport=${encodeURIComponent(sportId)}`, {
      headers: {
        'x-api-key': getApiKey(),
      },
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload.error || `Request failed: ${response.status}`;
      throw new Error(message);
    }

    const payload = await response.json();
    const matches = payload.matches || [];
    liveList.innerHTML = '';

    if (matches.length === 0) {
      liveList.innerHTML = '<li>No live matches available right now.</li>';
      return;
    }

    matches.forEach((match, index) => {
      const item = document.createElement('li');
      item.textContent = `${sportId.toUpperCase()} Match ${index + 1}: ${match}`;
      liveList.appendChild(item);
    });

    const sourceLabel = payload.source === 'upstream-proxy'
      ? 'Live source: upstream proxy'
      : 'Live source: local fallback';
    const cacheLabel = payload.cached ? ' (cached)' : '';
    liveList.dataset.source = `${sourceLabel}${cacheLabel}`;
  } catch (error) {
    liveList.innerHTML = `<li>Unable to load live matches: ${error.message}</li>`;
    console.error(error);
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.textContent = 'Load Live Matches';
    }
  }
}

function toggleAutoRefresh(sportId, toggleButton) {
  const existingTimer = refreshTimers[sportId];

  if (existingTimer) {
    clearInterval(existingTimer);
    delete refreshTimers[sportId];
    toggleButton.textContent = 'Start Auto Refresh';
    toggleButton.classList.remove('active');
    return;
  }

  loadLiveMatches(sportId, null);

  const timerId = setInterval(() => {
    loadLiveMatches(sportId, null);
  }, AUTO_REFRESH_MS);

  refreshTimers[sportId] = timerId;
  toggleButton.textContent = 'Stop Auto Refresh';
  toggleButton.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  const firstTab = document.querySelector('.tab-button[data-sport="football"]');
  showSport('football', firstTab);
});
