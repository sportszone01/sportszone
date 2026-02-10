<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sports Section</title>
<style>
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    position: relative;
    overflow-x: hidden;
    background-color: #5F9EA0; /* slightly darker soft blue */
  }

  /* Fixed emojis */
  .emoji {
    position: absolute;
    font-size: 2rem;
    opacity: 0.25;
    pointer-events: none;
  }

  h1 {
    text-align: center;
    font-size: 3rem;
    margin: 20px 0;
    color: white;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  }

  .sport-container {
    max-width: 900px;
    margin: 20px auto;
    padding: 20px;
    background-color: #ffffff;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(192,128,129,0.4);
    position: relative;
    z-index: 2;
  }

  /* Tabs */
  .sport-tabs button {
    background: linear-gradient(135deg, #16a085, #1abc9c);
    color: white;
    border: none;
    padding: 10px 15px;
    margin: 5px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .sport-tabs button:hover {
    background: linear-gradient(135deg, #138d75, #16a085);
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  }

  .sport-tabs button.active {
    background: linear-gradient(135deg, #C08081, #A05252);
  }

  .sport-content {
    display: none;
    margin-top: 20px;
    opacity: 0;
    transition: opacity 0.5s ease-in-out;
  }

  .sport-content.active {
    display: block;
    opacity: 1;
  }

  /* Light maroon buttons for content */
  .sport-content button {
    background-color: #C08081;
    color: white;
    border: none;
    padding: 8px 12px;
    margin: 5px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
  }

  .sport-content button:hover {
    background-color: #A05252;
    transform: scale(1.05);
    box-shadow: 0 3px 8px rgba(0,0,0,0.3);
  }
</style>
</head>
<body>

<!-- 60+ fixed emojis scattered randomly -->
<script>
const emojis = ["⚽","🏀","🏏","🏸","🏑","🎾","🏐","🏉","🥊","⛳","🏹","🥋","🤺","🏂","⛸️","🏌️‍♂️","🏄‍♂️","🚴‍♂️","🏇","🏊‍♂️","🤽‍♂️","🤾‍♂️","🏸","⚾","🥎","🏹","🏒","🎯"];
for(let i=0;i<60;i++){
  const div = document.createElement("div");
  div.className="emoji";
  div.innerHTML = emojis[Math.floor(Math.random()*emojis.length)];
  div.style.top = (Math.random()*window.innerHeight)+"px";
  div.style.left = (Math.random()*window.innerWidth)+"px";
  div.style.fontSize = (Math.random()*30+20)+"px"; 
  div.style.opacity = (Math.random()*0.3+0.2);
  document.body.appendChild(div);
}
</script>

<h1>Sports Zone</h1>

<div class="sport-container">
  <div class="sport-tabs">
    <button class="active" onclick="showSport('football')">Football</button>
    <button onclick="showSport('cricket')">Cricket</button>
    <button onclick="showSport('badminton')">Badminton</button>
    <button onclick="showSport('hockey')">Hockey</button>
    <button onclick="showSport('chess')">Chess</button>
    <button onclick="showSport('tennis')">Tennis</button>
    <button onclick="showSport('basketball')">Basketball</button>
  </div>

  <div id="football" class="sport-content active">
    <h2>Football</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Some Football news and highlights can be shown here.</p>
  </div>

  <div id="cricket" class="sport-content">
    <h2>Cricket</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Cricket updates, scores, and player stats can be added here.</p>
  </div>

  <div id="badminton" class="sport-content">
    <h2>Badminton</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Badminton events, player rankings, and news can go here.</p>
  </div>

  <div id="hockey" class="sport-content">
    <h2>Hockey</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Hockey matches, team updates, and player info can be shown here.</p>
  </div>

  <div id="chess" class="sport-content">
    <h2>Chess</h2>
    <button>Upcoming Tournaments</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Chess tournaments, grandmasters, and strategies updates go here.</p>
  </div>

  <div id="tennis" class="sport-content">
    <h2>Tennis</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Tennis matches, player stats, and tournaments info can go here.</p>
  </div>

  <div id="basketball" class="sport-content">
    <h2>Basketball</h2>
    <button>Upcoming Matches</button>
    <button>Player Profile</button>
    <button>Polls</button>
    <button>Latest News</button>
    <p>Basketball scores, NBA updates, and player highlights can go here.</p>
  </div>
</div>

<script>
function showSport(sport){
  const contents = document.querySelectorAll('.sport-content');
  contents.forEach(c=>c.classList.remove('active'));
  const buttons = document.querySelectorAll('.sport-tabs button');
  buttons.forEach(b=>b.classList.remove('active'));
  document.getElementById(sport).classList.add('active');
  event.target.classList.add('active');
}
</script>
</body>
</html>
