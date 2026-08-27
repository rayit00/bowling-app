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

function gameRow(g) {
  const bits = [g.date];
  if (g.alley) bits.push(g.alley);
  if (g.lane) bits.push(`Lane ${g.lane}`);
  if (g.session) bits.push(`🗂 ${g.session}`);
  return `
    <div class="row" data-id="${g.id}">
      <div class="row-score">${g.total ?? '—'}</div>
      <div class="row-main">
        <div class="row-title">${bits.slice(0, 2).join(' · ')}</div>
        <div class="row-sub">${bits.slice(2).join(' · ') || (g.notes ? '📝 ' + g.notes.slice(0, 40) : '')}</div>
      </div>
    </div>`;
}

function renderGameList(el, games, onOpen) {
  if (games.length === 0) {
    emptyState(el, 'No games yet. Tap + New to log your first game.');
    return;
  }
  const sorted = [...games].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h2>Games</h2><span class="spacer"></span><span class="count">${games.length}</span></div>
      <div class="list">${sorted.map(gameRow).join('')}</div>
    </div>`;
  el.querySelectorAll('.row').forEach((r) =>
    r.addEventListener('click', () => onOpen(Number(r.dataset.id)))
  );
}

function renderSessions(el, games, onOpen) {
  const grouped = {};
  const ungrouped = [];
  for (const g of games) {
    if (g.session) (grouped[g.session] ||= []).push(g);
    else ungrouped.push(g);
  }
  const names = Object.keys(grouped).sort();
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
    r.addEventListener('click', () => onOpen(r.dataset.session))
  );
}
