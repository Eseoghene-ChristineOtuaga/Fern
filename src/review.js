/** Approximate move labels from Stockfish scores, not definitive chess judgments. */
export function scoreForPlayer(position, player) {
  if (!position) return null;
  const { result, turn, outcome } = position;
  if (outcome) {
    if (outcome === 'draw') return 0.5;
    return outcome === player ? 1 : 0;
  }
  if (!result || !Number.isFinite(result.value)) return null;
  if (Array.isArray(result.wdl) && result.wdl.length === 3 && result.wdl.every(Number.isFinite)) {
    // UCI_ShowWDL reports W/D/L permille from the side-to-move perspective.
    const sideToMoveScore = (result.wdl[0] + result.wdl[1] / 2) / 1000;
    return turn === player ? sideToMoveScore : 1 - sideToMoveScore;
  }
  const sign = turn === player ? 1 : -1;
  if (result.type === 'mate') return sign * result.value > 0 ? 1 : 0;
  if (result.type !== 'cp') return null;
  const cp = Math.max(-1500, Math.min(1500, sign * result.value));
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}
export function reviewMove(before, after, move) {
  if (!before || !after || !move) return null;
  const player = before.turn;
  const best = scoreForPlayer(before, player);
  const played = scoreForPlayer(after, player);
  if (best === null || played === null) return null;
  const loss = Math.max(0, best - played);
  const uci = `${move.from}${move.to}${move.promotion || ''}`;
  const isBest = before.result?.bestMove === uci;
  const bestLine = Array.isArray(before.result?.bestLine) ? before.result.bestLine : [];
  const searchDepth = Math.min(before.result?.depth ?? 0, after.result?.depth ?? before.result?.depth ?? 0);
  let label;
  if (isBest) label = 'Best';
  else if (loss < 0.02) label = 'Excellent';
  else if (loss < 0.05) label = 'Good';
  else if (loss < 0.10) label = 'Inaccuracy';
  else if (loss < 0.20) label = 'Mistake';
  else label = 'Blunder';
  return {
    label,
    loss,
    beforeScore: best,
    afterScore: played,
    model: before.result?.wdl && after.result?.wdl ? 'stockfish-wdl-v1' : 'lichess-win-chance-proxy-v1',
    bestMove: before.result?.bestMove || null,
    bestLine,
    searchDepth,
    isBest,
    played: move.san,
    player,
    provisional: true
  };
}
export function summarizeReviews(reviews) {
  const valid = reviews.filter(Boolean);
  const counts = { Best: 0, Excellent: 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0 };
  for (const review of valid) counts[review.label]++;
  const worst = valid.filter(r => ['Mistake', 'Blunder'].includes(r.label)).sort((a, b) => b.loss - a.loss).slice(0, 3);
  return { counts, reviewed: valid.length, worst };
}
export function explainMove(review, suggestedSan) {
  if (!review) return 'Analysis is not available for this move.';
  const { label, played, isBest } = review;
  if (isBest) return `${played} was Stockfish's first choice at this search depth.`;
  if (label === 'Excellent') {
    return `${played} was a strong move. ${suggestedSan && suggestedSan !== played ? `Stockfish slightly preferred ${suggestedSan}, but the position stayed very close.` : 'It kept the position very close to the engine’s top line.'}`;
  }
  if (label === 'Good') {
    return `${played} was a solid move. ${suggestedSan && suggestedSan !== played ? `Stockfish preferred ${suggestedSan}, but the difference was small.` : 'The position only changed a little.'}`;
  }
  const alternative = suggestedSan && suggestedSan !== played ? ` A stronger engine choice was ${suggestedSan}.` : '';
  const severity = label === 'Blunder' ? 'changed the expected result a lot' : label === 'Mistake' ? 'gave away a noticeable part of the position' : 'gave away a little of the position';
  return `${played} ${severity}.${alternative}`;
}
