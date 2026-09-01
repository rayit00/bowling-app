// js/io.js
// contract:
//   exportJSON(games) — download a backup file
//   importJSON(file, cb) — parse + validate a backup file, cb(games) on success
export function exportJSON(games) {
  const blob = new Blob(
    [JSON.stringify({ app: 'bowltrack', version: 1, exported: new Date().toISOString(), games }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bowltrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importJSON(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const games = Array.isArray(data) ? data : data.games;
      if (!Array.isArray(games)) throw new Error('no games array');
      const clean = games
        .filter((g) => g && Array.isArray(g.frames) && g.frames.length === 10)
        .map((g) => ({
          id: Number(g.id) || Date.now(),
          date: String(g.date || ''),
          player: String(g.player || ''),
          alley: String(g.alley || ''),
          lane: String(g.lane || ''),
          session: String(g.session || ''),
          notes: String(g.notes || ''),
          frames: g.frames,
          total: Number(g.total) || 0,
        }));
      cb(clean);
    } catch (e) {
      alert('Import failed: not a valid BowlTrack backup file.');
    }
  };
  reader.readAsText(file);
}
