// js/store.js
// contract:
//   loadAll()    -> game[] (from localStorage)
//   saveAll(games) -> persist whole array
const KEY = 'bowling_games_v1';

export function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAll(games) {
  localStorage.setItem(KEY, JSON.stringify(games));
}
