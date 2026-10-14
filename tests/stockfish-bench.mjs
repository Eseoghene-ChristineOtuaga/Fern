// Run with: STOCKFISH_BIN=/path/to/stockfish node tests/stockfish-bench.mjs
// Requires a native Stockfish UCI binary; not the browser Web Worker build.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const binary = process.env.STOCKFISH_BIN;
if (!binary) {
  console.error('Set STOCKFISH_BIN to a native Stockfish executable. No engine was run.');
  process.exit(2);
}
const cases = JSON.parse(readFileSync(new URL('./positions.json', import.meta.url), 'utf8')).cases;
const engine = spawn(binary, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '', waiting = null, lines = [];
engine.stdout.setEncoding('utf8');
engine.stdout.on('data', chunk => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    lines.push(line);
    if (waiting?.done(line)) {
      const current = waiting;
      waiting = null;
      current.resolve([...lines]);
    }
  }
});
function command(cmd, done, timeout = 30000) {
  if (waiting) throw new Error('Concurrent UCI command');
  lines = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (waiting) waiting = null;
      reject(new Error('Timeout: ' + cmd));
    }, timeout);
    waiting = { done, resolve: value => { clearTimeout(timer); resolve(value); } };
    engine.stdin.write(cmd + '\n');
  });
}
try {
  await command('uci', line => line === 'uciok');
  engine.stdin.write('setoption name UCI_ShowWDL value true\\n');
  await command('isready', line => line === 'readyok');
  const results = [];
  for (const item of cases) {
    for (const depth of item.depths) {
      engine.stdin.write('position fen ' + item.fen + '\n');
      const output = await command('go depth ' + depth, line => line.startsWith('bestmove '), 60000);
      const best = output.findLast(line => line.startsWith('bestmove '))?.split(' ')[1];
      const info = output.filter(line => line.startsWith('info ') && line.includes(' score ') && !/\b(lowerbound|upperbound)\b/.test(line)).at(-1);
      const score = info?.match(/score (cp|mate) (-?\d+)/);
      const result = { id: item.id, depth, bestMove: best, scoreType: score?.[1] ?? null, score: score ? Number(score[2]) : null };
      results.push(result);
      console.log(JSON.stringify(result));
      if (item.expectedBestMove) assert.equal(best, item.expectedBestMove, item.id + ' at depth ' + depth);
    }
  }
  console.log('PASS: ' + results.length + ' Stockfish depth checks');
} catch (error) {
  console.error('FAIL:', error.message);
  process.exitCode = 1;
} finally {
  engine.stdin.write('quit\n');
  engine.stdin.end();
}
