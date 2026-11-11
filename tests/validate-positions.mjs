import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';

const { cases } = JSON.parse(readFileSync(new URL('./positions.json', import.meta.url), 'utf8'));
for (const item of cases) {
  const game = new Chess(item.fen);
  assert.ok(!game.isGameOver(), item.id + ': expected a playable position');
  if (item.expectedBestMove) {
    const uci = item.expectedBestMove;
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    assert.ok(move, item.id + ': expected move must be legal');
    assert.ok(game.isCheckmate(), item.id + ': expected move must deliver checkmate');
  }
  console.log('VALID', item.id);
}
