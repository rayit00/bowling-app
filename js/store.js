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

const PREF_KEY = 'bowling_prefs_v1';

export function loadPref(name, def) {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return p[name] !== undefined ? p[name] : def;
  } catch {
    return def;
  }
}

export function savePref(name, value) {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    const p = raw ? JSON.parse(raw) : {};
    p[name] = value;
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // non-fatal: pref just won't persist
  }
}
