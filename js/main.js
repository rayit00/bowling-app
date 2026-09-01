// js/main.js — ORCHESTRATOR ONLY: state, routing, wiring. No business logic.
const APP_VER = 'v16'; // bump on every deploy — shown in header so you can verify freshness
import { loadAll, saveAll } from './store.js';
import { renderGameForm, renderGameDetail } from './game-ui.js';
import { renderGameList, renderSessions } from './list-ui.js';
import { renderStats } from './stats-ui.js';
import { exportJSON, importJSON } from './io.js';

const view = document.getElementById('view');
let games = loadAll();

// route state: {name, id?}
let route = { name: 'games' };

function persist() {
  saveAll(games);
}

function navigate(name, id, extra) {
  route = { name, id, extra };
  document.querySelectorAll('nav button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === name)
  );
  render();
}

function render() {
  if (route.name === 'games') {
    renderGameList(view, games, (id) => navigate('detail', id), {
      player: route.extra?.player ?? null,
      onPickPlayer: (p) => navigate('games', undefined, { player: p }),
    });
  } else if (route.name === 'new' || route.name === 'edit') {
    const game = route.name === 'edit' ? games.find((g) => g.id === route.id) : null;
    const players = [...new Set(games.map((g) => g.player).filter(Boolean))].sort();
    renderGameForm(view, game, (saved, cancelled) => {
      if (cancelled) return navigate(route.name === 'edit' ? 'detail' : 'games', route.id ?? undefined);
      if (route.name === 'edit') {
        games = games.map((g) => (g.id === saved.id ? saved : g));
      } else {
        games.push(saved);
      }
      persist();
      navigate('detail', saved.id);
    }, players);
  } else if (route.name === 'detail') {
    const game = games.find((g) => g.id === route.id);
    if (!game) return navigate('games');
    renderGameDetail(view, game, {
      onEdit: () => navigate('edit', game.id),
      onDelete: () => {
        games = games.filter((g) => g.id !== game.id);
        persist();
        navigate('games');
      },
      onBack: () => navigate('games'),
    });
  } else if (route.name === 'sessions') {
    renderSessions(view, games, (session, ungrouped) =>
      navigate(ungrouped ? 'ungrouped' : 'session', session));
  } else if (route.name === 'session') {
    const inSession = games.filter((g) => g.session === route.id);
    renderGameList(view, inSession, (id) => navigate('detail', id), {
      title: `🗂 ${route.id}`,
      onPickPlayer: (p) => navigate('games', undefined, { player: p }),
    });
  } else if (route.name === 'ungrouped') {
    const inSession = games.filter((g) => !g.session);
    renderGameList(view, inSession, (id) => navigate('detail', id), {
      title: 'No session',
      onPickPlayer: (p) => navigate('games', undefined, { player: p }),
    });
  } else if (route.name === 'stats') {
    renderStats(view, games, (player) => navigate('games', undefined, { player }), route.extra?.player ?? null);
  }
}

document.querySelectorAll('nav button').forEach((b) =>
  b.addEventListener('click', () => navigate(b.dataset.view))
);

// Data menu
const dataMenu = document.getElementById('data-menu');
document.getElementById('data-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  dataMenu.classList.toggle('open');
});
document.addEventListener('click', () => dataMenu.classList.remove('open'));
document.getElementById('export-btn').addEventListener('click', () => exportJSON(games));
const importFile = document.getElementById('import-file');
document.getElementById('import-btn').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', () => {
  if (!importFile.files[0]) return;
  importJSON(importFile.files[0], (clean) => {
    const existing = new Set(games.map((g) => g.id));
    let added = 0;
    for (const g of clean) {
      if (!existing.has(g.id)) {
        games.push(g);
        added++;
      }
    }
    persist();
    importFile.value = '';
    alert(`Imported ${added} new game(s). ${clean.length - added} already existed (skipped).`);
    render();
  });
});

render();
document.getElementById('app-ver').textContent = APP_VER;
