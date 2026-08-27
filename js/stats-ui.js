// js/stats-ui.js
// contract:
//   renderStats(el, games)   — dashboard + trend chart + by-alley table
//   drawTrend(canvas, games) — simple line chart of game totals (newest right)
import { frameStats } from './score.js';

function rollingAvg(sorted, n) {
  const last = sorted.slice(-n);
  return Math.round(last.reduce((a, g) => a + (g.total || 0), 0) / last.length);
}

export function renderStats(el, games) {
  if (games.length === 0) {
    el.innerHTML = `<div class="page"><div class="empty"><div class="empty-ic">📈</div><p>Log some games to see stats.</p></div></div>`;
    return;
  }
  const sorted = [...games].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : a.id - b.id));
  const totals = sorted.map((g) => g.total || 0);
  const best = Math.max(...totals);
  const agg = { strikes: 0, spares: 0, splits: 0, open: 0, attempts: 0, conv: 0 };
  for (const g of sorted) {
    const s = frameStats(g.frames);
    agg.strikes += s.strikes;
    agg.spares += s.spares;
    agg.splits += s.splits;
    agg.open += s.openFrames;
    agg.attempts += s.spareAttempts;
    agg.conv += s.spareConversions;
  }
  const convPct = agg.attempts ? Math.round((100 * agg.conv) / agg.attempts) : '—';

  // by alley
  const byAlley = {};
  for (const g of sorted) {
    const k = g.alley || '(no alley)';
    (byAlley[k] ||= []).push(g.total || 0);
  }
  const alleyRows = Object.entries(byAlley)
    .map(([k, v]) => [k, v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length), Math.max(...v)])
    .sort((a, b) => b[2] - a[2]);

  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h2>Stats</h2><span class="spacer"></span><span class="count">${games.length} games</span></div>
      <div class="stat-grid">
        <div class="stat-card"><b>${rollingAvg(sorted, 5)}</b><span>avg (last 5)</span></div>
        <div class="stat-card"><b>${rollingAvg(sorted, 10)}</b><span>avg (last 10)</span></div>
        <div class="stat-card"><b>${rollingAvg(sorted, 9999)}</b><span>career avg</span></div>
        <div class="stat-card"><b>${best}</b><span>best game</span></div>
      </div>
      <div class="stat-chips">
        <div class="chip"><b>${agg.strikes}</b><span>strikes</span></div>
        <div class="chip"><b>${agg.spares}</b><span>spares</span></div>
        <div class="chip"><b>${agg.splits}</b><span>splits</span></div>
        <div class="chip"><b>${convPct}</b><span>spare conv</span></div>
      </div>
      <h3>Trend</h3>
      <canvas id="trend" width="640" height="220"></canvas>
      <h3>By Alley</h3>
      <table class="tbl">
        <thead><tr><th>Alley</th><th>Games</th><th>Avg</th><th>Best</th></tr></thead>
        <tbody>${alleyRows.map(([k, n, avg, b]) =>
          `<tr><td>${k.replace(/</g, '&lt;')}</td><td>${n}</td><td>${avg}</td><td>${b}</td></tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
  drawTrend(el.querySelector('#trend'), sorted);
}

function drawTrend(canvas, sorted) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  ctx.clearRect(0, 0, W, H);
  ctx.font = '11px sans-serif';

  const vals = sorted.map((g) => g.total || 0);
  const maxV = Math.max(300, ...vals);
  const minV = Math.min(...vals, 0);
  const x = (i) => pad.l + (vals.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (vals.length - 1));
  const y = (v) => H - pad.b - ((v - minV) / (maxV - minV || 1)) * (H - pad.t - pad.b);

  // grid lines
  ctx.strokeStyle = '#23272e';
  ctx.fillStyle = '#6b7280';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = minV + ((maxV - minV) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.l, y(v));
    ctx.lineTo(W - pad.r, y(v));
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), 4, y(v) + 4);
  }

  if (vals.length === 0) return;

  // line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  vals.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
  ctx.stroke();

  // dots + best marker
  vals.forEach((v, i) => {
    ctx.fillStyle = v === Math.max(...vals) ? '#f59e0b' : '#374151';
    ctx.beginPath();
    ctx.arc(x(i), y(v), v === Math.max(...vals) ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // x labels (first / mid / last dates)
  ctx.fillStyle = '#6b7280';
  const label = (i) => ctx.fillText(sorted[i].date.slice(5), Math.min(x(i), W - 60), H - 6);
  label(0);
  if (vals.length > 2) label(Math.floor(vals.length / 2));
  label(vals.length - 1);
}
