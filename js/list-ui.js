// js/list-ui.js
// contract:
//   renderGameList(el, games, onOpen)      — all games, newest first
//   renderSessions(el, games, onOpen)      — groups by session name

function emptyState(el, msg) {
  el.innerHTML = `
    <div class="page">
      <div class="empty">
        <div class="empty-ic">🎳</div>
        <p>${msg}</p>
      </div>
    </div>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Filter chips: "All" + one per known player. `active` = selected player or null.
export function playerChips(games, active) {
  const names = [...new Set(games.map((g) => g.player).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return '';
  const chip = (label, val) =>
    `<button class="chip-btn ${active === val ? 'on' : ''}" data-p="${esc(val ?? '')}">${esc(label)}</button>`;
  return `<div class="player-chips">${chip('All', null)}${names.map((n) => chip(n, n)).join('')}</div>`;
}

export function wireChips(el, onPickPlayer) {
  el.querySelectorAll('.player-chips .chip-btn').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      onPickPlayer(b.dataset.p || null);
    })
  );
}

function gameRow(g) {
  const title = [g.date, g.player && esc(g.player), g.alley && esc(g.alley)]
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
  const sub = [
    g.player && g.alley ? esc(g.alley) : null,
    g.lane && `Lane ${esc(g.lane)}`,
    g.session && `🗂 ${esc(g.session)}`,
    g.notes && '📝 ' + esc(g.notes.slice(0, 40)),
  ]
    .filter(Boolean)
    .join(' · ');
  return `
    <div class="row" data-id="${g.id}">
      <div class="row-score">${g.total ?? '—'}</div>
      <div class="row-main">
        <div class="row-title">${title}</div>
        <div class="row-sub">${sub}</div>
      </div>
    </div>`;
}

export function renderGameList(el, games, onOpen, opts = {}) {
  const { player = null, onPickPlayer, title = 'Games' } = opts;
  const shown = player ? games.filter((g) => g.player === player) : games;
  if (shown.length === 0) {
    emptyState(el, player ? `No games for ${esc(player)}.` : 'No games yet. Tap + New to log your first game.');
    return;
  }
  const sorted = [...shown].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  el.innerHTML = `
    <div class="page">
      ${playerChips(games, player)}
      <div class="page-head"><h2>${esc(title)}</h2><span class="spacer"></span><span class="count">${shown.length}</span></div>
      <div class="list">${sorted.map(gameRow).join('')}</div>
    </div>`;
  wireChips(el, onPickPlayer);
  el.querySelectorAll('.row').forEach((r) =>
    r.addEventListener('click', () => onOpen(Number(r.dataset.id)))
  );
}

export function renderSessions(el, games, onOpen) {
  const grouped = {};
  const ungrouped = [];
  for (const g of games) {
    if (g.session) (grouped[g.session] ||= []).push(g);
    else ungrouped.push(g);
  }
  const names = Object.keys(grouped).sort((a, b) => {
    const la = grouped[a].map((g) => g.date).sort().pop();
    const lb = grouped[b].map((g) => g.date).sort().pop();
    return lb > la ? 1 : lb < la ? -1 : a < b ? -1 : 1;
  });
  if (names.length === 0 && ungrouped.length === 0) {
    emptyState(el, 'No games yet. Sessions appear when you tag games with a session name.');
    return;
  }
  let html = '<div class="page"><div class="page-head"><h2>Sessions</h2><span class="spacer"></span></div>';
  for (const name of names) {
    const gs = grouped[name];
    const avg = Math.round(gs.reduce((a, g) => a + (g.total || 0), 0) / gs.length);
    const span = gs.map((g) => g.date).sort();
    html += `
      <div class="row" data-session="${name.replace(/"/g, '&quot;')}">
        <div class="row-score">${avg}</div>
        <div class="row-main">
          <div class="row-title">${name.replace(/</g, '&lt;')}</div>
          <div class="row-sub">${gs.length} game${gs.length > 1 ? 's' : ''} · ${span[0]}${span.length > 1 ? ' → ' + span[span.length - 1] : ''}</div>
        </div>
      </div>`;
  }
  if (ungrouped.length > 0) {
    const avg = Math.round(ungrouped.reduce((a, g) => a + (g.total || 0), 0) / ungrouped.length);
    html += `
      <div class="row" data-session="">
        <div class="row-score">${avg}</div>
        <div class="row-main">
          <div class="row-title">No session</div>
          <div class="row-sub">${ungrouped.length} game${ungrouped.length > 1 ? 's' : ''}</div>
        </div>
      </div>`;
  }
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll('.row').forEach((r) =>
    r.addEventListener('click', () => onOpen(r.dataset.session, r.dataset.session === ''))
  );
}
