// tests/score.test.mjs — phase 1 test gate: node tests/score.test.mjs
import { scoreGame, frameStats } from '../js/score.js';
import { frameState, standingPins, rackStandingFor, RACK_ROWS } from '../js/game-ui.js';

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; }
  else { fail++; console.log(`FAIL ${name}\n  got:  ${g}\n  want: ${w}`); }
}

// 9 copies of a frame (fresh arrays each)
const nine = (fr) => Array.from({ length: 9 }, () => [...fr]);
// 10 copies
const ten = (fr) => Array.from({ length: 10 }, () => [...fr]);

// perfect game = 300
eq('perfect game', scoreGame(nine([10]).concat([[10, 10, 10]])).total, 300);

// all spares (5+5) = 150
eq('all spares', scoreGame(nine([5, 5]).concat([[5, 5, 5]])).total, 150);

// all gutters = 0
eq('all gutters', scoreGame(ten([0, 0])).total, 0);

// all 7+2: 9/frame, no bonus = 90
eq('all 7+2', scoreGame(ten([7, 2])).total, 90);

// 10th frame: strike then 7+3 = 0 + (10+7+3) = 20
eq('10th strike 7/3', scoreGame(nine([0, 0]).concat([[10, 7, 3]])).total, 20);

// 10th frame: spare then 8 = 0 + (10+8) = 18
eq('10th spare +8', scoreGame(nine([0, 0]).concat([[4, 6, 8]])).total, 18);

// 10th frame: open 3+4 = 7
eq('10th open', scoreGame(nine([0, 0]).concat([[3, 4]])).total, 7);

// mixed game, hand-verified:
// f1 X:10+5+5=20 | f2 /:10+7=17 | f3 73:10 | f4 X:10+10+10=30 | f5 X:10+10+4=24
// f6 X:10+4+6=20 | f7 /:10+9=19 | f8 91:10 | f9 82:10 | f10 X90:19 -> 207
eq('mixed game', scoreGame([[10], [5, 5], [7, 3], [10], [10], [10], [4, 6], [9, 1], [8, 2], [10, 9, 0]]).total, 207);

// validation: pins over 10
eq('over-10 invalid', scoreGame([[6, 5], ...nine([0, 0])]).valid, false);

// validation: incomplete frame 10 (strike, only 2 rolls)
eq('10th strike incomplete', scoreGame(nine([0, 0]).concat([[10, 7]])).valid, false);

// validation: 10th frame OPEN with 3 rolls (7+2 is open, not a spare)
eq('10th open with 3 rolls invalid', scoreGame(nine([0, 0]).concat([[7, 2, 0]])).valid, false);

// validation: 10th frame strike with 4 rolls
eq('10th 4 rolls invalid', scoreGame(nine([0, 0]).concat([[10, 5, 5, 4]])).valid, false);

// frameStats on perfect game: 12 strikes (10th frame has 3)
eq('perfect stats', frameStats(nine([10]).concat([[10, 10, 10]])),
   { strikes: 12, spares: 0, splits: 0, openFrames: 0, spareAttempts: 0, spareConversions: 0, conversionPct: null });

// split detection: 4/6 spare = spare+split, then strike converts (10 frames total)
const splitGame = [[4, 6], [10], ...nine([0, 0]).slice(0, 8)];
const ss = frameStats(splitGame);
eq('split counted', ss.splits, 1);
eq('spare converted', ss.spareConversions, 1);
eq('conv pct', ss.conversionPct, 100);

// gutter split (0/10) is a spare but NOT a split (10 frames total)
const gutterSplit = [[0, 10], ...nine([0, 0]).slice(0, 9)];
eq('gutter split not a split', frameStats(gutterSplit).splits, 0);
eq('gutter split is a spare', frameStats(gutterSplit).spares, 1);

// 10th frame strike + 5 + 4: score 10+5+4=19; 1 strike, 0 spares
const tenth2 = nine([0, 0]).concat([[10, 5, 4]]);
eq('10th strike+5+4 score', scoreGame(tenth2).total, 19);
const t2s = frameStats(tenth2);
eq('10th: 1 strike', t2s.strikes, 1);
eq('10th: 0 spares', t2s.spares, 0);

// X X 0: 2 strikes, NO spare
const t3s = frameStats(nine([0, 0]).concat([[10, 10, 0]]));
eq('X X 0: 2 strikes', t3s.strikes, 2);
eq('X X 0: 0 spares', t3s.spares, 0);

// frameState: 10th-frame completion (regression — "Game complete ✓" shown
// for a lone 10th-frame strike, then Save rejected it)
eq('state: 10th strike 1 roll needs roll 2', frameState(nine([0, 0]).concat([[10]])), [9, 1]);
eq('state: 10th open 1 roll needs roll 2', frameState(nine([0, 0]).concat([[7]])), [9, 1]);
eq('state: 10th strike 2 rolls needs roll 3', frameState(nine([0, 0]).concat([[10, 5]])), [9, 2]);
eq('state: 10th spare 2 rolls needs roll 3', frameState(nine([0, 0]).concat([[7, 3]])), [9, 2]);
eq('state: 10th open 2 rolls complete', frameState(nine([0, 0]).concat([[7, 2]])), null);
eq('state: 10th strike 3 rolls complete', frameState(nine([0, 0]).concat([[10, 10, 10]])), null);
eq('state: 10th spare 3 rolls complete', frameState(nine([0, 0]).concat([[7, 3, 5]])), null);
eq('state: mid-game open frame 1 roll', frameState([[7], ...nine([0, 0]).slice(0, 8), [0, 0]]), [0, 1]);
eq('state: empty game starts at f1 r1', frameState(ten([])), [0, 0]);

// standingPins: pins standing on the rack for the upcoming roll (pin-deck UI)
eq('pins: fresh rack', standingPins(ten([]), 0, 0), 10);
eq('pins: after 7 -> 3 standing', standingPins([[7], ...nine([0, 0]).slice(0, 8), [0, 0]], 0, 1), 3);
eq('pins: after strike -> 0', standingPins([[10], ...nine([0, 0]).slice(0, 8), [0, 0]], 0, 1), 0);
eq('pins: 10th fresh', standingPins(nine([0, 0]).concat([]), 9, 0), 10);
eq('pins: 10th after strike -> fresh rack', standingPins(nine([0, 0]).concat([[10]]), 9, 1), 10);
eq('pins: 10th after 7 -> 3', standingPins(nine([0, 0]).concat([[7]]), 9, 1), 3);
eq('pins: 10th X X -> fresh rack', standingPins(nine([0, 0]).concat([[10, 10]]), 9, 2), 10);
eq('pins: 10th X 7 -> 3', standingPins(nine([0, 0]).concat([[10, 7]]), 9, 2), 3);
eq('pins: 10th spare -> fresh rack', standingPins(nine([0, 0]).concat([[7, 3]]), 9, 2), 10);
eq('pins: 10th open -> 0', standingPins(nine([0, 0]).concat([[7, 2]]), 9, 2), 0);

// rackStandingFor: which SPECIFIC pins stand for the upcoming roll (pin-deck UI)
const R = Array.from({ length: 10 }, () => []); // empty rackState
const FULL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
eq('rack: fresh', rackStandingFor(ten([]), R, 0, 0), FULL);
eq('rack: legacy after 7 (no rack data)', rackStandingFor([[7], ...nine([0, 0]).slice(0, 8), [0, 0]], R, 0, 1), [1, 2, 3]);
eq('rack: recorded taps win over generic',
  rackStandingFor([[5], ...nine([0, 0]).slice(0, 8), [0, 0]], [[[1, 2, 3, 5, 8]]], 0, 1), [1, 2, 3, 5, 8]);
eq('rack: stale recorded (count mismatch) -> generic fallback',
  rackStandingFor([[7], ...nine([0, 0]).slice(0, 8), [0, 0]], [[[1, 2, 3, 5, 8]]], 0, 1), [1, 2, 3]);
eq('rack: after strike -> empty',
  rackStandingFor([[10], ...nine([0, 0]).slice(0, 8), [0, 0]], [[[]]], 0, 1), []);
eq('rack: 10th fresh', rackStandingFor(nine([0, 0]).concat([]), R, 9, 0), FULL);
eq('rack: 10th after strike -> full rack', rackStandingFor(nine([0, 0]).concat([[10]]), R, 9, 1), FULL);
eq('rack: 10th after 7 -> 3', rackStandingFor(nine([0, 0]).concat([[7]]), R, 9, 1), [1, 2, 3]);
eq('rack: 10th spare -> full rack (rule wins over recorded)',
  rackStandingFor(nine([0, 0]).concat([[7, 3]]), [[[], []]], 9, 2), FULL);
eq('rack: 10th after X 7 -> recorded 3', rackStandingFor(nine([0, 0]).concat([[10, 7]]), [[[], [1, 2, 3]]], 9, 2), [1, 2, 3]);
eq('rack: 10th X X -> full rack (rule)', rackStandingFor(nine([0, 0]).concat([[10, 10]]), [[[], []]], 9, 2), FULL);
eq('rack: 10th X 7 -> roll 3 sees the 3 standing pins (not a fresh rack)',
  rackStandingFor(nine([0, 0]).concat([[10, 7]]), [[[], [1, 2, 3]]], 9, 2), [1, 2, 3]);
eq('rack: user scenario — 4, tapped {7,8,9,10}, roll 2 shows the 6 actually left',
  rackStandingFor([[4], ...nine([0, 0]).slice(0, 8), [0, 0]], [[[1, 2, 3, 4, 5, 6]]], 0, 1), [1, 2, 3, 4, 5, 6]);
eq('rack: user scenario — 4, tapped {4,5,6,1}, roll 2 shows {2,3,7,8,9,10}',
  rackStandingFor([[4], ...nine([0, 0]).slice(0, 8), [0, 0]], [[[2, 3, 7, 8, 9, 10]]], 0, 1), [2, 3, 7, 8, 9, 10]);

// rack layout: standard triangle, back row (7 8 9 10) first, head pin 1 last
// (regression — v14 rendered 4 5 6 1 / 10 2 3 / 8 9 / 7)
eq('rack rows layout', RACK_ROWS, [[6, 7, 8, 9], [3, 4, 5], [1, 2], [0]]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
