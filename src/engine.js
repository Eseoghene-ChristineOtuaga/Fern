import { Chess } from 'chess.js';

// A single-threaded Stockfish 19 WASM worker, running locally in the browser.
// Only one UCI search may be active at a time. Do not mix responses from searches.
const ENGINE_PATH = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

export function createEngine() {
  let worker;
  let readyPromise;
  let pending;
  let disposed = false;
  let latestInfo = null;

  const send = (command) => worker.postMessage(command);
  const cleanup = () => {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
  };

  function start() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        timer = null;
        reject(new Error('Stockfish took too long to start.'));
      }, 25000);
      try {
        worker = new Worker(ENGINE_PATH);
        worker.onerror = () => {
          if (timer) { clearTimeout(timer); timer = null; reject(new Error('Stockfish failed to load. Check that engine files were deployed.')); }
          if (pending) { pending.reject(new Error('Stockfish worker stopped unexpectedly.')); cleanup(); }
        };
        worker.onmessage = ({ data }) => {
          const lines = String(data).split(/\r?\n/);
          for (const line of lines) {
            if (line === 'uciok') send('isready');
            if (line === 'readyok' && timer) { clearTimeout(timer); timer = null; resolve(); }
            if (!pending) continue;
            if (line.startsWith('info ') && /\bscore (cp|mate) -?\d+/.test(line)) {
              const depth = Number(line.match(/\bdepth (\d+)/)?.[1] || 0);
              const kind = line.match(/\bscore (cp|mate) (-?\d+)/);
              const pv = line.match(/\bpv (.+)$/);
              if (kind && !/\b(lowerbound|upperbound)\b/.test(line) && depth >= (latestInfo?.depth ?? 0)) {
                latestInfo = { depth, type: kind[1], value: Number(kind[2]), bestLine: pv?.[1]?.trim().split(/\s+/) || [] };
              }
            }
            if (line.startsWith('bestmove ')) {
              const move = line.split(' ')[1];
              const result = latestInfo ? { ...latestInfo, bestMove: move && move !== '(none)' ? move : null } : null;
              if (result) pending.resolve(result); else pending.reject(new Error('Stockfish returned no usable evaluation.'));
              cleanup();
            }
          }
        };
        send('uci');
      } catch (e) { if (timer) clearTimeout(timer); reject(e); }
    }).catch(err => { readyPromise = null; worker?.terminate(); worker = null; throw err; });
    return readyPromise;
  }

  async function analyse(fen, depth = 12) {
    if (disposed) throw new Error('Engine has been disposed.');
    await start();
    if (pending) throw new Error('Engine is already analysing a position.');
    latestInfo = null;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Kill rather than reuse a worker after a timeout: late bestmove lines
        // must not be mistaken for the next position's result.
        worker?.terminate(); worker = null; readyPromise = null;
        cleanup(); reject(new Error('Analysis timed out. Please retry.'));
      }, 30000);
      pending = { resolve, reject, timer };
      send(`position fen ${fen}`);
      send(`go depth ${Math.max(6, Math.min(18, depth))}`);
    });
  }
  function dispose() {
    disposed = true;
    if (pending) { pending.reject(new Error('Analysis cancelled.')); cleanup(); }
    worker?.terminate(); worker = null; readyPromise = null;
  }
  return { analyse, dispose };
}

export function describeEvaluation(result, turn) {
  if (!result || !result.type) return 'No evaluation available.';
  if (result.type === 'mate') {
    const winner = result.value > 0 ? turn : (turn === 'w' ? 'b' : 'w');
    return `Mate in ${Math.abs(result.value)} for ${winner === 'w' ? 'White' : 'Black'}`;
  }
  const whiteCp = (turn === 'w' ? 1 : -1) * result.value;
  const lead = Math.abs(whiteCp) < 30 ? 'Approximately equal' : whiteCp > 0 ? 'White is better' : 'Black is better';
  return `${lead} · ${whiteCp >= 0 ? '+' : ''}${(whiteCp / 100).toFixed(2)} (White's perspective)`;
}

export function describeBestMove(fen, uci) {
  if (!uci || uci.length < 4) return null;
  try {
    
    const board = new Chess(fen);
    const move = board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return move?.san || uci;
  } catch { return uci; }
}
