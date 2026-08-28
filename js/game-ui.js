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

export function renderGameForm(el, game, onDone) {
  const isNew = !game;
  const g = game || {
    id: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    alley: '',
    lane: '',
    session: '',
    notes: '',
    frames: emptyFrames(),
  };
  let frames = g.frames.map((fr) => [...fr]);
  const meta = { date: g.date, alley: g.alley, lane: g.lane, session: g.session, notes: g.notes };
  let glyphMode = loadPref('glyphMode', true); // default: pin symbols (X / G)

  el.innerHTML = `
    <div class="page">
      <div class="page-head">
        <button class="back" data-act="back">←</button>
        <h2>${isNew ? 'New Game' : 'Edit Game'}</h2>
        <button class="ghost" id="f-glyph" title="Toggle pin symbols / numbers">🎳 X / G</button>
      </div>
      <div class="meta-grid">
        <label>Date<input type="date" id="f-date" value="${meta.date}"></label>
        <label>Session<input type="text" id="f-session" placeholder="e.g. Sat Night 3-up" value="${meta.session}"></label>
        <label>Alley<input type="text" id="f-alley" placeholder="e.g. Lanes on 9" value="${meta.alley}"></label>
        <label>Lane<input type="text" id="f-lane" placeholder="e.g. 12" value="${meta.lane}"></label>
      </div>
      <div class="scorecard" id="f-card"></div>
      <div class="pad" id="f-pad"></div>
      <div class="form-row">
        <button class="primary" id="f-save">Save Game</button>
        <button class="danger" id="f-clear">Clear All</button>
      </div>
      <div class="err" id="f-err"></div>
      <textarea id="f-notes" placeholder="Notes — lane oil, ball, how it felt..." rows="3">${meta.notes}</textarea>
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
    card.innerHTML = html;
  }

  function drawPad() {
    const pos = frameState(frames);
    if (!pos) {
      pad.innerHTML = '<div class="pad-done">Game complete ✓ — save when ready</div>';
      return;
    }
    const [f, s] = pos;
    const standing = standingPins(frames, f, s);
    const knocked = new Set();
    const pins = [];
    for (let p = 1; p <= 10; p++) {
      const up = p <= standing;
      pins.push(`<div class="pin ${up ? 'up' : 'down'}" data-p="${p}" ${up ? '' : 'hidden'}><span class="pin-n">${p}</span></div>`);
    }
    // standard rack triangle, front row (4 5 6 1) on top, head pin 7 at bottom
    const order = [6, 7, 8, 9, 1, 2, 3, 4, 5, 0];
    const rows = [order.slice(6, 10), order.slice(3, 6), order.slice(1, 3), order.slice(0, 1)];
    pad.innerHTML = `
      <div class="pad-label">Frame ${f + 1} · roll ${s + 1} — tap the pins you knock down</div>
      <div class="rack">
        ${rows.map(r => `<div class="rack-row">${r.map(i => pins[i]).join('')}</div>`).join('')}
      </div>
      <div class="form-row rack-actions">
        <button class="primary" id="roll-btn">Roll ${knocked.size}</button>
        <button class="ghost" id="reset-btn">Reset rack</button>
      </div>
      <button class="pad-toggle" id="pad-toggle">✏️ Type a number instead</button>
      <div class="pad-num" id="pad-num" hidden></div>`;
    drawNumPad(f, s);
    pad.querySelector('#pad-toggle').addEventListener('click', () => {
      const num = pad.querySelector('#pad-num');
      num.hidden = !num.hidden;
      pad.querySelector('#pad-toggle').textContent = num.hidden
        ? '✏️ Type a number instead'
        : '🎳 Use the pin rack';
    });
    pad.querySelector('.rack').addEventListener('click', (e) => {
      const pin = e.target.closest('.pin');
      if (!pin || pin.hidden) return;
      const p = Number(pin.dataset.p);
      if (knocked.has(p)) knocked.delete(p); else knocked.add(p);
      pin.classList.toggle('down', knocked.has(p));
      pin.classList.toggle('up', !knocked.has(p));
      pad.querySelector('#roll-btn').textContent = `Roll ${knocked.size}`;
      if (knocked.size === 10) setTimeout(() => confirmRoll(10), 350); // auto strike
    });
    pad.querySelector('#roll-btn').addEventListener('click', () => confirmRoll(knocked.size));
    pad.querySelector('#reset-btn').addEventListener('click', () => {
      knocked.clear();
      drawPad();
    });
    function confirmRoll(n) {
      const pos2 = frameState(frames);
      if (!pos2) return;
      frames[pos2[0]][pos2[1]] = n;
      draw();
    }
  }

  function drawNumPad(f, s) {
    const num = pad.querySelector('#pad-num');
    if (!num) return;
    let max = 10;
    if (f < 9 && s === 1) max = 10 - frames[f][0];
    if (f === 9) {
      if (s === 1) max = frames[9][0] === 10 ? 10 : 10 - frames[9][0];
      if (s === 2) {
        const a = frames[9][0], b = frames[9][1];
        if (a === 10) max = b === 10 ? 10 : 10 - b;
        else max = 10;
      }
    }
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
        const pos2 = frameState(frames);
        if (!pos2) return;
        if (n === -1) frames[pos2[0]].pop();
        else frames[pos2[0]][pos2[1]] = n;
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
    const pos = frameState(frames);
    if (!pos) return;
    const [f, s] = pos;
    if (Number(cell.dataset.f) === f && Number(cell.dataset.s) === s) drawPad();
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
  el.querySelector('#f-clear').addEventListener('click', () => {
    if (confirm('Clear all rolls?')) {
      frames = emptyFrames();
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
      session: el.querySelector('#f-session').value.trim(),
      alley: el.querySelector('#f-alley').value.trim(),
      lane: el.querySelector('#f-lane').value.trim(),
      notes: el.querySelector('#f-notes').value.trim(),
      frames,
      total: sc.total,
    };
    onDone(out, false);
  });

  draw();
}

function rollLabel(f, fr) {
  // display glyphs for a roll: X strike, / spare, G gutter, or number
  if (f < 9) {
    if (fr[0] === 10) return ['X'];
    return [fr[0] === 0 ? 'G' : String(fr[0]), fr[1] === 10 ? '/' : fr[1] === 0 ? 'G' : String(fr[1])];
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
    game.alley ? game.alley : null,
    game.lane ? `Lane ${game.lane}` : null,
    game.session ? `🗂 ${game.session}` : null,
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
        <p>${game.notes ? game.notes.replace(/</g, '&lt;') : '<i>no notes</i>'}</p>
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
