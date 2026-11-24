// One self-contained page: it asks /stats/<token>/points for a day and draws two charts with Chart.js.
export const STATS_PAGE_HTML = `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Чати: Новий і Вибір товару</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; background: #f6f7f9; color: #1b1f24; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  .bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 16px; }
  .card { background: #fff; border-radius: 8px; padding: 10px 12px; }
  .card b { display: block; font-size: 24px; }
  .box { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
  .box h2 { font-size: 15px; margin: 0 0 8px; }
  canvas { max-height: 320px; }
  #info { color: #667; font-size: 13px; }
</style>
</head>
<body>
<h1>Новий і Вибір товару</h1>
<div class="bar">
  <label>День: <input type="date" id="day"></label>
  <span id="info"></span>
</div>
<div class="cards" id="cards"></div>
<div class="box"><h2>Новий</h2><canvas id="newChats"></canvas></div>
<div class="box"><h2>Вибір товару</h2><canvas id="productChoice"></canvas></div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
const token = location.pathname.split('/')[2];
const zone = 'Europe/Kyiv';
const dayInput = document.getElementById('day');
dayInput.value = new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(new Date());
const charts = {};
function time(iso) {
  return new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: zone });
}
// One dot per measurement: x = leads without an answer, y = all leads of the status
function draw(id, points, status) {
  const dots = points.map((point) => ({ x: point[status].unanswered, y: point[status].total, at: point.at }));
  const sets = [{ label: 'Замір (кожні 10 хв)', data: dots, backgroundColor: '#1c7ed6', borderColor: '#1c7ed6', showLine: true, tension: 0.2, pointRadius: 5 }];
  const tooltip = { callbacks: { label: (item) => time(item.raw.at) + ': без відповіді ' + item.raw.x + ', усього ' + item.raw.y } };
  const scales = {
    x: { beginAtZero: true, title: { display: true, text: 'Без відповіді' }, ticks: { precision: 0 } },
    y: { beginAtZero: true, title: { display: true, text: 'Кількість лідів' }, ticks: { precision: 0 } },
  };
  const config = { type: 'scatter', data: { datasets: sets }, options: { animation: false, plugins: { tooltip }, scales } };
  if (charts[id]) { charts[id].data = config.data; charts[id].update(); return; }
  charts[id] = new Chart(document.getElementById(id), config);
}
function cards(last) {
  const items = [
    ['Новий: без відповіді', last.newChats.unanswered], ['Новий: усього', last.newChats.total],
    ['Вибір товару: без відповіді', last.productChoice.unanswered], ['Вибір товару: усього', last.productChoice.total],
  ];
  document.getElementById('cards').innerHTML = items.map(([name, value]) => '<div class="card">' + name + '<b>' + value + '</b></div>').join('');
}
async function load() {
  const response = await fetch('/stats/' + token + '/points?day=' + dayInput.value);
  const points = await response.json();
  document.getElementById('info').textContent = points.length ? 'Замірів: ' + points.length + ', останній о ' + time(points[points.length - 1].at) : 'За цей день замірів ще немає';
  if (!points.length) { document.getElementById('cards').innerHTML = ''; return; }
  cards(points[points.length - 1]);
  draw('newChats', points, 'newChats');
  draw('productChoice', points, 'productChoice');
}
dayInput.addEventListener('change', load);
load();
setInterval(load, 60000);
</script>
</body>
</html>
`;
