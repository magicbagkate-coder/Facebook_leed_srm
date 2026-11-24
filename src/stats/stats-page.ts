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
  #info, #legend { color: #667; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: right; padding: 4px 10px; border-bottom: 1px solid #e9ecef; }
  th:first-child, td:first-child { text-align: left; }
  #table { max-height: 360px; overflow: auto; }
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
<p id="legend">Підпис біля останньої точки: «усього лідів / без відповіді». Наведіть мишку на будь-яку точку, щоб побачити час і цифри заміру.</p>
<div class="box"><h2>Усі заміри за день</h2><div id="table"></div></div>
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
const blue = '#1c7ed6';
// Rounds the range of the values to whole steps; a single value still gets a visible range
function range(values, step) {
  const low = Math.floor(Math.min(...values) / step) * step;
  const high = Math.ceil(Math.max(...values) / step) * step;
  return { min: low, max: high === low ? low + step : high };
}
// Writes "all leads / without an answer" next to the last dot, all the other numbers are in the hint and in the table
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    const dots = chart.data.datasets[0].data;
    const meta = chart.getDatasetMeta(0);
    const ctx = chart.ctx;
    ctx.save();
    ctx.fillStyle = '#1864ab';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    const last = dots.length - 1;
    ctx.fillText(dots[last].x + ' / ' + dots[last].y, meta.data[last].x, meta.data[last].y - 10);
    ctx.restore();
  },
};
// Side axis: leads without an answer. Bottom axis: all leads (ticks by 1 or by 50). One dot per measurement, time in the hint.
function draw(id, points, status) {
  const step = status === 'productChoice' ? 50 : 1;
  const leads = range(points.map((point) => point[status].total), step);
  const dots = points.map((point) => ({ x: point[status].total, y: point[status].unanswered, at: point.at }));
  const sets = [{ label: 'Замір', data: dots, backgroundColor: blue, borderColor: blue, showLine: true, pointRadius: 5 }];
  const tooltip = {
    displayColors: false,
    callbacks: { label: (item) => ['Час: ' + time(item.raw.at), 'Усього лідів: ' + item.raw.x, 'Без відповіді: ' + item.raw.y] },
  };
  const scales = {
    y: { beginAtZero: true, grace: '12%', title: { display: true, text: 'Без відповіді' }, ticks: { stepSize: 1, precision: 0 } },
    x: { min: leads.min, max: leads.max, title: { display: true, text: 'Кількість лідів' }, ticks: { stepSize: step, precision: 0 } },
  };
  const options = { animation: false, layout: { padding: { top: 16 } }, plugins: { legend: { display: false }, tooltip }, scales };
  if (charts[id]) { charts[id].data.datasets = sets; charts[id].options = options; charts[id].update(); return; }
  charts[id] = new Chart(document.getElementById(id), { type: 'scatter', data: { datasets: sets }, options, plugins: [valueLabels] });
}
function table(points) {
  const head = '<tr><th>Час</th><th>Новий: усього</th><th>Новий: без відповіді</th><th>Вибір товару: усього</th><th>Вибір товару: без відповіді</th></tr>';
  const rows = points.slice().reverse().map((point) => '<tr><td>' + time(point.at) + '</td><td>' + point.newChats.total + '</td><td>' + point.newChats.unanswered + '</td><td>' + point.productChoice.total + '</td><td>' + point.productChoice.unanswered + '</td></tr>');
  document.getElementById('table').innerHTML = '<table>' + head + rows.join('') + '</table>';
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
  table(points);
}
dayInput.addEventListener('change', load);
load();
setInterval(load, 60000);
</script>
</body>
</html>
`;
