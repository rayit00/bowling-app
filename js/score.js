// js/score.js
// contract:
//   scoreGame(frames) -> {valid, error, total, frameScores}  (frameScores = running totals)
//   frameStats(frames) -> {strikes, spares, splits, openFrames, spareAttempts, spareConversions, conversionPct}
//
// frames = array of 10 arrays of roll values (ints 0-10)
//   frames 1-9: [10] (strike) or [a, b] with a+b <= 10
//   frame 10:   [10, x, y] | [a, 10-a, z] | [a, b] with a+b < 10

export function scoreGame(frames) {
  const v = validateFrames(frames);
  if (!v.valid) return { valid: false, error: v.error, total: 0, frameScores: [] };

  const rolls = frames.flat();
  const frameScores = [];
  let total = 0;
  let ri = 0;

  for (let f = 0; f < 10; f++) {
    const fr = frames[f];
    if (f < 9) {
      let pts;
      if (fr[0] === 10) {
        pts = 10 + (rolls[ri + 1] || 0) + (rolls[ri + 2] || 0);
        ri += 1;
      } else if (fr[0] + fr[1] === 10) {
        pts = 10 + (rolls[ri + 2] || 0);
        ri += 2;
      } else {
        pts = fr[0] + fr[1];
        ri += 2;
      }
      total += pts;
      frameScores.push(total);
    } else {
      total += fr.reduce((a, b) => a + b, 0);
      frameScores.push(total);
    }
  }
  return { valid: true, error: null, total, frameScores };
}

function validateFrames(frames) {
  if (!Array.isArray(frames) || frames.length !== 10)
    return { valid: false, error: 'Game must have exactly 10 frames' };
  for (let f = 0; f < 9; f++) {
    const fr = frames[f];
    if (!Array.isArray(fr) || fr.length < 1 || fr.length > 2)
      return { valid: false, error: `Frame ${f + 1} has an invalid roll count` };
    for (const r of fr)
      if (!Number.isInteger(r) || r < 0 || r > 10)
        return { valid: false, error: `Frame ${f + 1} has an invalid roll value` };
    if (fr.length === 1 && fr[0] !== 10)
      return { valid: false, error: `Frame ${f + 1} is incomplete` };
    if (fr.length === 2 && fr[0] !== 10 && fr[0] + fr[1] > 10)
      return { valid: false, error: `Frame ${f + 1} pins exceed 10` };
  }
  const ten = frames[9];
  if (!Array.isArray(ten) || ten.length === 0)
    return { valid: false, error: 'Frame 10 is incomplete' };
  for (const r of ten)
    if (!Number.isInteger(r) || r < 0 || r > 10)
      return { valid: false, error: 'Frame 10 has an invalid roll value' };
  if (ten[0] === 10) {
    if (ten.length !== 3)
      return { valid: false, error: 'Frame 10 strike needs exactly 2 more rolls' };
    if (ten[1] !== 10 && ten[1] + ten[2] > 10)
      return { valid: false, error: 'Frame 10 pins exceed 10' };
  } else if (ten[0] + ten[1] === 10) {
    if (ten.length !== 3)
      return { valid: false, error: 'Frame 10 spare needs exactly 1 more roll' };
  } else if (ten.length !== 2) {
    return { valid: false, error: 'Frame 10 open frame must have exactly 2 rolls' };
  }
  return { valid: true, error: null };
}

export function frameStats(frames) {
  const s = {
    strikes: 0, spares: 0, splits: 0, openFrames: 0,
    spareAttempts: 0, spareConversions: 0, conversionPct: null,
  };
  if (!Array.isArray(frames) || frames.length !== 10) return s;
  for (let f = 0; f < 10; f++) {
    const fr = frames[f];
    if (f < 9) {
      if (fr[0] === 10) {
        s.strikes++;
        continue;
      }
      if (fr[0] + fr[1] === 10) {
        s.spares++;
        s.spareAttempts++;
        if (fr[0] !== 0) s.splits++;
        if (frames[f + 1] && frames[f + 1][0] === 10) s.spareConversions++;
      } else {
        s.openFrames++;
      }
    } else {
      for (const r of fr) if (r === 10) s.strikes++;
      if (fr[0] !== 10 && fr[0] + fr[1] === 10) {
        s.spares++;
        s.spareAttempts++;
        if (fr[0] !== 0) s.splits++;
        if (fr.length === 3 && fr[2] === 10) s.spareConversions++;
      } else if (fr[0] === 10 && fr.length === 3 && fr[1] !== 10 && fr[1] + fr[2] === 10) {
        // spare after strike in 10th (e.g. X / 4); X X 0 does NOT count as a spare
        s.spares++;
        s.spareAttempts++;
        if (fr[1] !== 0) s.splits++;
        if (fr[2] === 10) s.spareConversions++;
      }
    }
  }
  if (s.spareAttempts > 0)
    s.conversionPct = Math.round((100 * s.spareConversions) / s.spareAttempts);
  return s;
}
