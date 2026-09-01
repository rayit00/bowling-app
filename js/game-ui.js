// js/game-ui.js
// contract:
//   renderGameForm(el, game, onDone)   — new/edit form: meta + frame grid + number pad
//   renderGameDetail(el, game, {onEdit, onDelete, onBack}) — scorecard + stats + notes
import { scoreGame, frameStats } from './score.js';
import { loadPref, savePref } from './store.js';

function emptyFrames() {
  return Array.from({ length: 10 }, () => []);
}

export function frameState(frames) {
  // [frameIdx, rollIdx] of next roll to enter
  for (let f = 0; f < 10; f++) {
    const fr = frames[f];
    if (f < 9) {
      if (fr.length === 0) return [f, 0];
      if (fr[0] !== 10 && fr.length === 1) return [f, 1];
    } else {
      if (fr.length === 0) return [9, 0];
      if (fr.length === 1) return [9, 1]; // strike OR open first roll: always need roll 2
      if (fr.length === 2) {
        if (fr[0] === 10) return [9, 2];      // strike: always exactly 3 rolls
        if (fr[0] + fr[1] === 10) return [9, 2]; // spare: one bonus roll
      }
      return null; // open frame with 2 rolls: complete
    }
  }
  return null; // complete
}

export function standingPins(frames, f, s) {
  // how many pins are standing on the rack for the upcoming roll
  const fr = frames[f];
  if (s === 0) return 10;
  const prev = fr[s - 1];
  if (f < 9) {
    if (prev === 10) return 0; // strike: frame over
    return 10 - prev;
  }
  // 10th frame
  if (s === 1) {
    if (prev === 10) return 10; // strike: fresh rack
    return 10 - prev;
  }
  if (s === 2) {
    const a = fr[0], b = fr[1];
    if (a === 10) return b === 10 ? 10 : 10 - b;
    if (a + b === 10) return 10; // spare: fresh rack
    return 0; // open: frame over
  }
  return 0;
}

export function rackStandingFor(frames, rackState, f, s) {
  // pure: pins standing BEFORE roll s. rackState[f] = "pins standing after each roll".
  const FULL_RACK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  if (s === 0) return [...FULL_RACK];
  const prev = frames[f][s - 1];
  // 10th frame: strike or spare means a fresh rack (rule wins over recorded state)
  if (f === 9) {
    if (prev === 10) return [...FULL_RACK];
    if (s === 2 && frames[f][0] + prev === 10) return [...FULL_RACK];
  }
  const arr = rackState[f];
  if (arr && arr.length > s - 1) {
    const rec = arr[s - 1];
    // trust recorded taps only when the count still matches the roll
    // (guards against undo + re-roll with a different count)
    if (rec.length === 10 - prev) return [...rec];
  }
  return [...FULL_RACK].slice(0, 10 - prev); // legacy / stale: generic fallback
}

// Rack layout: rows of indices into the pins[] array (pin n lives at pins[n-1]).
// Viewed from the bowler: back row 7 8 9 10 on top, head pin 1 at the bottom.
export const RACK_ROWS = [
  [6, 7, 8, 9], // pins 7 8 9 10
  [3, 4, 5],    // pins 4 5 6
  [1, 2],       // pins 2 3
  [0],          // pin 1 (head pin)
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderGameForm(el, game, onDone, knownPlayers = []) {
  const isNew = !game;
  const lastPlayer = loadPref('lastPlayer', '');
  const g = game || {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    player: lastPlayer,
    alley: '',
    lane: '',
    session: '',
    notes: '',
    frames: emptyFrames(),
  };
  let frames = g.frames.map((fr) => [...fr]);
  const meta = { date: g.date, player: g.player || '', alley: g.alley, lane: g.lane, session: g.session, notes: g.notes };
  let glyphMode = loadPref('glyphMode', true); // default: pin symbols (X / G)
  let padMode = loadPref('padMode', 'rack');   // 'rack' | 'num' — persists across rolls/games

  // rackState[f] = array of "pins standing AFTER each roll" (pin numbers 1-10).
  // Legacy games have no rack data: the first confirmed roll seeds a fresh rack,
  // so roll 2+ shows the exact pins the user left up.
  let rackState = frames.map(() => []);
  const FULL_RACK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  let knocked = new Set();   // pins tapped down for the in-progress roll (form scope: survives redraws)
  let curPos = null;         // [f, s] of the roll the rack currently targets
  const RACK_KEY = `bt_rack_${g.id}`;
  try {
    const stored = JSON.parse(localStorage.getItem(RACK_KEY) || 'null');
    if (Array.isArray(stored)) for (let f = 0; f < 10; f++) rackState[f] = (stored[f] || []).map((r) => [...r]);
  } catch { /* corrupt: start fresh */ }
  function saveRack() {
    try { localStorage.setItem(RACK_KEY, JSON.stringify(rackState)); } catch { /* storage full */ }
  }
  function rackStanding(f, s) {
    return rackStandingFor(frames, rackState, f, s);
  }
  function recordRack(f, s, after) {
    const arr = rackState[f];
    while (arr.length < s) arr.push([...FULL_RACK]);
    if (arr.length === s) arr.push([...after]);
    else arr[s] = [...after]; // stale entry from undo + re-roll: overwrite
  }
  function confirmRoll(n, knockedSet) {
    const pos2 = frameState(frames);
    if (!pos2) return;
    const [f, s] = pos2;
    const before = rackStanding(f, s);
    let after;
    if (n === 10) after = []; // strike: rack empty (fresh rack handled at next roll)
    else if (s > 0 && frames[f][s - 1] !== 10 && frames[f][s - 1] + n === 10) after = []; // spare
    else if (f === 9 && s === 2 && frames[f][0] === 10 && frames[f][1] + n === 10) after = []; // 10th: spare after strike (X /)
    else if (knockedSet) after = before.filter((p) => !knockedSet.has(p));
    else after = before.slice(0, Math.max(0, before.length - n)); // numeric entry: generic
    frames[f][s] = n;
    recordRack(f, s, after);
    saveRack();
    knocked = new Set(); // the confirmed taps are now recorded — start the next roll clean
    draw();
  }

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <button class="back" data-act="back">←</button>
        <h2>${isNew ? 'New Game' : 'Edit Game'}</h2>
        <button class="ghost" id="f-glyph" title="Toggle pin symbols / numbers">🎳 X / G</button>
      </div>
      <div class="meta-grid">
        <label class="wide">Player<input type="text" id="f-player" list="player-list" placeholder="Who's bowling?" value="${esc(meta.player)}"></label>
        <datalist id="player-list">${knownPlayers.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
        <label>Date<input type="date" id="f-date" value="${esc(meta.date)}"></label>
        <label>Session<input type="text" id="f-session" placeholder="e.g. Sat Night 3-up" value="${esc(meta.session)}"></label>
        <label>Alley<input type="text" id="f-alley" placeholder="e.g. Lanes on 9" value="${esc(meta.alley)}"></label>
        <label>Lane<input type="text" id="f-lane" placeholder="e.g. 12" value="${esc(meta.lane)}"></label>
      </div>
      <div class="scorecard" id="f-card"></div>
      <div class="pad" id="f-pad"></div>
      <div class="form-row">
        <button class="primary" id="f-save">Save Game</button>
        <button class="ghost" id="f-undo">Undo</button>
        <button class="danger" id="f-clear">Clear All</button>
      </div>
      <div class="err" id="f-err"></div>
      <textarea id="f-notes" placeholder="Notes — lane oil, ball, how it felt..." rows="3">${esc(meta.notes)}</textarea>
    </div>`;

  const card = el.querySelector('#f-card');
  const pad = el.querySelector('#f-pad');
  const errEl = el.querySelector('#f-err');

  function cellText(f, s) {
    const v = frames[f][s];
    if (v === undefined) return '';
    if (!glyphMode) return String(v); // plain numbers
    return rollLabel(f, frames[f])[s] ?? String(v); // X / G symbols
  }

  function drawCard() {
    const pos = frameState(frames);
    let html = '<div class="frames">';
    for (let f = 0; f < 10; f++) {
      const fr = frames[f];
      const slots = f === 9 ? [0, 1, 2] : [0, 1];
      let cells = '';
      for (const s of slots) {
        const active = pos && pos[0] === f && pos[1] === s;
        cells += `<div class="cell ${active ? 'active' : ''}" data-f="${f}" data-s="${s}">${cellText(f, s)}</div>`;
      }
      html += `<div class="frame f${f + 1}">${cells}</div>`;
    }
    html += '</div>';
    const sc = scoreGame(frames);
    html += `<div class="running">${sc.valid ? sc.frameScores.map((n) => `<b>${n}</b>`).join(' ') : ''}</div>`;
    html += '<div class="card-hint">tap a filled frame to jump back and re-enter that roll</div>';
    card.innerHTML = html;
  }

  function drawPad() {
    const pos = frameState(frames);
    if (!pos) {
      pad.innerHTML = '<div class="pad-done">Game complete ✓ — save when ready</div>';
      curPos = null;
      return;
    }
    const [f, s] = pos;
    const standing = rackStanding(f, s);
    // new roll position -> start with nothing knocked; unchanged position
    // (pin taps, pad toggles, glyph toggle) -> keep the in-progress selection
    if (!curPos || curPos[0] !== f || curPos[1] !== s) knocked = new Set();
    curPos = [f, s];
    // split callout: head pin down AND (a gap between the leftmost and
    // rightmost standing pins, or a named two-pin split like the 2-3 "sisters")
    const TWO_PIN = [[2, 3], [2, 7], [3, 7], [4, 6], [4, 10], [5, 9], [6, 7], [6, 10]];
    const isSplit = (() => {
      if (s < 1 || standing.includes(1) || standing.length < 2) return false;
      if (standing.length === 2 && TWO_PIN.some((sp) => sp.every((p) => standing.includes(p)))) return true;
      const lo = Math.min(...standing), hi = Math.max(...standing);
      for (let p = lo + 1; p < hi; p++) if (!standing.includes(p)) return true;
      return false;
    })();
    const labelText = `Frame ${f + 1} · roll ${s + 1}${isSplit ? ' — SPLIT!' : ''} — ${padMode === 'num' ? 'type the pins you knock down' : 'tap the pins you knock down'}`;
    // standard rack triangle, viewed from the bowler:
    // back row 7 8 9 10 on top, head pin 1 at the bottom (front of the lane)
    const pins = [];
    for (let p = 1; p <= 10; p++) {
      const standingNow = standing.includes(p);
      const up = standingNow && !knocked.has(p);
      // Always render all 10 pins in fixed rack positions — pins already
      // knocked down stay on the rack, dimmed and untappable, so the rack
      // never shifts between rolls.
      const cls = up ? 'up' : standingNow ? 'down' : 'dead';
      pins.push(`<div class="pin ${cls}" data-p="${p}"><span class="pin-n">${p}</span></div>`);
    }
    pad.innerHTML = `
      <div class="pad-label">${esc(labelText)}</div>
      <div class="rack" id="rack-wrap" ${padMode === 'num' ? 'hidden' : ''}>
        ${RACK_ROWS.map(r => `<div class="rack-row">${r.map(i => pins[i]).join('')}</div>`).join('')}
      </div>
      <div class="form-row rack-actions" id="rack-actions" ${padMode === 'num' ? 'hidden' : ''}>
        <button class="primary" id="roll-btn">Roll ${knocked.size}</button>
        <button class="ghost" id="reset-btn">Reset rack</button>
      </div>
      <button class="pad-toggle" id="pad-toggle">${padMode === 'num' ? '🎳 Use the pin rack' : '✏️ Type a number instead'}</button>
      <div class="pad-num" id="pad-num" ${padMode === 'num' ? '' : 'hidden'}></div>`;
    drawNumPad(f, s);
    pad.querySelector('#pad-toggle').addEventListener('click', () => {
      padMode = padMode === 'num' ? 'rack' : 'num';
      savePref('padMode', padMode);
      drawPad();
    });
    pad.querySelector('.rack').addEventListener('click', (e) => {
      const pin = e.target.closest('.pin');
      if (!pin || !pin.classList.contains('up')) return; // only standing pins are tappable
      const p = Number(pin.dataset.p);
      if (knocked.has(p)) knocked.delete(p); else knocked.add(p);
      pin.classList.toggle('down', knocked.has(p));
      pin.classList.toggle('up', !knocked.has(p));
      pad.querySelector('#roll-btn').textContent = `Roll ${knocked.size}`;
    });
    // No auto-confirm: a strike is only recorded when the user taps "Roll 10".
    pad.querySelector('#roll-btn').addEventListener('click', () => confirmRoll(knocked.size, knocked));
    pad.querySelector('#reset-btn').addEventListener('click', () => {
      knocked = new Set();
      drawPad();
    });
  }

  function drawNumPad(f, s) {
    const num = pad.querySelector('#pad-num');
    if (!num) return;
    const max = rackStanding(f, s).length;
    let btns = '';
    for (let n = 0; n <= max; n++) {
      const label = n === 10 ? 'X' : n === 0 ? 'G' : String(n);
      btns += `<button data-n="${n}">${label}</button>`;
    }
    btns += '<button data-n="-1">CLR</button>';
    num.innerHTML = `<div class="pad-grid">${btns}</div>`;
    num.querySelectorAll('button[data-n]').forEach((b) =>
      b.addEventListener('click', () => {
        const n = Number(b.dataset.n);
        if (n === -1) {
          const pos2 = frameState(frames);
          if (!pos2) return;
          frames[pos2[0]].pop();
          // rackState[f][i] = pins after roll i (0-based). Popping roll at index
          // (pos2[1]-1) drops its record; keep 0..pos2[1]-2.
          rackState[pos2[0]] = rackState[pos2[0]].slice(0, Math.max(0, pos2[1] - 1));
          saveRack();
          knocked = new Set();
        } else {
          confirmRoll(n, null);
        }
        draw();
      })
    );
  }

  function draw() {
    drawCard();
    drawPad();
  }

  card.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const f = Number(cell.dataset.f), s = Number(cell.dataset.s);
    if (frames[f][s] === undefined) return; // empty cell: nothing to return to
    // Jump back: rewind to this roll — it and every roll after it are dropped,
    // so the user can re-enter it (and the rack state follows).
    if (!confirm(`Return to frame ${f + 1}, roll ${s + 1}? That roll and everything after it will be cleared.`)) return;
    frames[f] = frames[f].slice(0, s);
    for (let k = f + 1; k < 10; k++) frames[k] = [];
    rackState[f] = rackState[f].slice(0, s);
    for (let k = f + 1; k < 10; k++) rackState[k] = [];
    saveRack();
    knocked = new Set();
    curPos = null;
    draw();
  });

  el.querySelector('[data-act="back"]').addEventListener('click', () => onDone(null, true));
  el.querySelector('#f-glyph').addEventListener('click', () => {
    glyphMode = !glyphMode;
    savePref('glyphMode', glyphMode);
    syncGlyphBtn();
    draw();
  });
  function syncGlyphBtn() {
    const b = el.querySelector('#f-glyph');
    b.textContent = glyphMode ? '🎳 X / G' : '🔢 123';
    b.classList.toggle('on', glyphMode);
  }
  syncGlyphBtn();
  el.querySelector('#f-undo').addEventListener('click', () => {
    // find the last entered roll and drop it
    let last = null;
    for (let f = 9; f >= 0; f--) {
      if (frames[f].length > 0) { last = [f, frames[f].length - 1]; break; }
    }
    if (!last) return; // nothing to undo
    const [f, s] = last;
    frames[f].pop();
    rackState[f] = rackState[f].slice(0, Math.max(0, s));
    saveRack();
    knocked = new Set();
    curPos = null;
    draw();
  });
  el.querySelector('#f-clear').addEventListener('click', () => {
    if (confirm('Clear all rolls?')) {
      frames = emptyFrames();
      rackState = frames.map(() => []);
      try { localStorage.removeItem(RACK_KEY); } catch { /* ignore */ }
      knocked = new Set();
      curPos = null;
      draw();
    }
  });
  el.querySelector('#f-save').addEventListener('click', () => {
    const sc = scoreGame(frames);
    if (!sc.valid) {
      errEl.textContent = sc.error;
      return;
    }
    const out = {
      id: g.id,
      date: el.querySelector('#f-date').value || new Date().toISOString().slice(0, 10),
      player: el.querySelector('#f-player').value.trim(),
      session: el.querySelector('#f-session').value.trim(),
      alley: el.querySelector('#f-alley').value.trim(),
      lane: el.querySelector('#f-lane').value.trim(),
      notes: el.querySelector('#f-notes').value.trim(),
      frames,
      total: sc.total,
    };
    savePref('lastPlayer', out.player);
    saveRack();
    onDone(out, false);
  });

  draw();
}

function rollLabel(f, fr) {
  // display glyphs for a roll: X strike, / spare, G gutter, or number
  if (f < 9) {
    if (fr[0] === 10) return ['X'];
    return [fr[0] === 0 ? 'G' : String(fr[0]), fr[0] + fr[1] === 10 ? '/' : fr[1] === 0 ? 'G' : String(fr[1])];
  }
  const out = [];
  for (let i = 0; i < fr.length; i++) {
    const r = fr[i];
    if (r === 10) out.push('X');
    else if (i > 0 && fr[i - 1] !== 10 && fr[i - 1] + r === 10) out.push('/');
    else out.push(r === 0 ? 'G' : String(r));
  }
  return out;
}

export function renderGameDetail(el, game, { onEdit, onDelete, onBack }) {
  const sc = scoreGame(game.frames);
  const st = frameStats(game.frames);
  const conv = st.conversionPct !== null ? `${st.conversionPct}%` : '—';

  let framesHtml = '<div class="frames detail">';
  for (let f = 0; f < 10; f++) {
    const glyphs = rollLabel(f, game.frames[f]);
    const cells = glyphs
      .map((g) => `<div class="cell">${g}</div>`)
      .join('');
    const run = sc.valid && sc.frameScores[f] !== undefined ? sc.frameScores[f] : '';
    framesHtml += `<div class="frame f${f + 1}">${cells}<div class="run">${run}</div></div>`;
  }
  framesHtml += '</div>';

  const metaBits = [
    game.date,
    game.alley ? esc(game.alley) : null,
    game.lane ? `Lane ${esc(game.lane)}` : null,
    game.session ? `🗂 ${esc(game.session)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <button class="back" data-act="back">←</button>
        <h2>Game</h2>
        <span class="spacer"></span>
      </div>
      <div class="score-hero">
        <div class="score-big">${sc.valid ? sc.total : '—'}</div>
        ${game.player ? `<div class="score-player">🎳 ${esc(game.player)}</div>` : ''}
        <div class="meta-line">${metaBits}</div>
      </div>
      ${framesHtml}
      <div class="stat-chips">
        <div class="chip"><b>${st.strikes}</b><span>strikes</span></div>
        <div class="chip"><b>${st.spares}</b><span>spares</span></div>
        <div class="chip"><b>${st.splits}</b><span>splits</span></div>
        <div class="chip"><b>${st.openFrames}</b><span>open frames</span></div>
        <div class="chip"><b>${st.spareConversions}/${st.spareAttempts}</b><span>spare conv (${conv})</span></div>
      </div>
      <div class="notes-block">
        <h3>Notes</h3>
        <p>${game.notes ? esc(game.notes) : '<i>no notes</i>'}</p>
      </div>
      <div class="form-row">
        <button class="primary" data-act="edit">Edit</button>
        <button class="danger" data-act="del">Delete</button>
      </div>
    </div>`;

  el.querySelector('[data-act="back"]').addEventListener('click', onBack);
  el.querySelector('[data-act="edit"]').addEventListener('click', onEdit);
  el.querySelector('[data-act="del"]').addEventListener('click', () => {
    if (confirm('Delete this game?')) onDelete();
  });
}
