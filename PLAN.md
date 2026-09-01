# BowlTrack — PLAN

Personal bowling stats tracker. PWA, vanilla JS, localStorage, no build step.
Hosted on GitHub Pages (rayit00/bowling-app).

## Stack
- Vanilla JS (ES modules), max 2 exported functions per file
- main.js = orchestrator only (state, routing, wiring — no business logic)
- localStorage persistence (key `bowling_games_v1`)
- PWA: manifest + service worker (offline app shell)
- JSON export/import for backups

## Data Model
```js
game = {
  id: Number,          // Date.now()
  date: 'YYYY-MM-DD',
  alley: string,       // '' if unknown
  lane: string,
  session: string,     // '' = ungrouped; links games into sessions
  notes: string,       // freeform, linked by game
  frames: [[n],[a,b],...],  // 10 frames; 10th has 2-3 rolls
  total: Number        // computed on save
}
```

## File Contracts
| File | Exports |
|------|---------|
| js/score.js | `scoreGame(frames)` → {valid,error,total,frameScores}; `frameStats(frames)` → {strikes,spares,splits,openFrames,spareAttempts,spareConversions,conversionPct} |
| js/store.js | `loadAll()` → games[]; `saveAll(games)` |
| js/game-ui.js | `renderGameForm(el, game, onDone)`; `renderGameDetail(el, game, {onEdit,onDelete,onBack})` |
| js/list-ui.js | `renderGameList(el, games, onOpen)`; `renderSessions(el, games, onOpen)` |
| js/stats-ui.js | `renderStats(el, games)`; `drawTrend(canvas, games)` |
| js/io.js | `exportJSON(games)`; `importJSON(file, cb)` |
| js/main.js | (orchestrator, no exports) |
| sw.js | PWA service worker (cache-first) |

## Views
- games (list) → detail (scorecard + stats + notes) → edit (form)
- new (form with frame grid + number pad)
- sessions (grouped by session name) → session-detail (filtered list)
- stats (dashboard + trend canvas + by-alley table)

## Phases
| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Score engine + unit tests | ✅ |
| 2 | Frontend: entry, list, detail, sessions, stats, export/import | ✅ |
| 3 | PWA: manifest, service worker, icons | ✅ |
| 4 | Deploy: push to GitHub, enable Pages, verify | ✅ |

## Versioning
- v1.0 — initial release (all 4 phases)
- v15 — rack fixed to standard layout (7-8-9-10 back, head pin 1 front); split callout on pad label; Undo button; HTML-escaping everywhere (XSS-safe); sessions sorted by recency; "No session" row now navigates; manifest `id` added; SW cache bowltrack-v15
- v16 — multi-bowler: plain-text Player field (no autocomplete, no name history — names only stored on the game itself); player shown on list rows + game detail; player filter chips on Games and Stats; Head-to-Head table (avg/best/strikes per player, tap a row to filter); stats dashboard follows the selected player; player survives export/import; SW cache bowltrack-v16

## Test Gates
- Phase 1: `node tests/score.test.mjs` (perfect game 300, all spares 150, gutters 0, 10th-frame cases, validation errors)
- Phase 2: browser smoke test — log a full game, verify score, edit, delete, export/import
- Phase 3: manifest + SW register without console errors
- Phase 4: live URL serves index.html

## Decisions
- One bowler (single-user personal tracker)
- GitHub Pages + localStorage (no server); JSON export/import as backup path
- Splits: gutter split (0-10) does NOT count as split; regular split = first ball 1-9
- Spare conversion: spare followed by strike (10th-frame 3rd ball strike counts)
- Frame grid: 10 columns, tap slot → bottom number pad (0-10 + CLR), auto-advance to next slot
