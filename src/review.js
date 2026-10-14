/** Approximate move labels from Stockfish scores, not definitive chess judgments. */
export function scoreForPlayer(position, player) {
  if (!position) return null;
  const { result, turn, outcome } = position;
  if (outcome) {
    if (outcome === 'draw') return 0.5;
    return outcome === player ? 1 : 0;
  }
  if (!result || !Number.isFinite(result.value)) return null;
  const sign = turn === player ? 1 : -1;
  if (result.type === 'mate') return sign * result.value > 0 ? 1 : 0;
  if (result.type !== 'cp') return null;
  const cp = Math.max(-1500, Math.min(1500, sign * result.value));
  return 1 / (1 + Math.exp(-cp / 220));
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
  if (isBest || loss < 0.035) label = 'Best / excellent';
  else if (loss < 0.085) label = 'Good';
  else if (loss < 0.17) label = 'Inaccuracy';
  else if (loss < 0.30) label = 'Mistake';
  else label = 'Blunder';
  return { label, loss, bestMove: before.result?.bestMove || null, bestLine, searchDepth, isBest, played: move.san, player, provisional: true };
}
export function summarizeReviews(reviews) {
  const valid = reviews.filter(Boolean);
  const counts = { 'Best / excellent': 0, Good: 0, Inaccuracy: 0, Mistake: 0, Blunder: 0 };
  for (const review of valid) counts[review.label]++;
  const worst = valid.filter(r => ['Mistake', 'Blunder'].includes(r.label)).sort((a, b) => b.loss - a.loss).slice(0, 3);
  return { counts, reviewed: valid.length, worst };
}
export function explainMove(review, suggestedSan) {
  if (!review) return 'Analysis is not available for this move.';
  const { label, played, isBest } = review;
  if (isBest) return `${played} matches the engine's first choice at this search depth.`;
  if (label === 'Best / excellent') return `${played} keeps the position close to the engine's preferred evaluation.`;
  if (label === 'Good') return `${played} is a reasonable continuation. The engine sees only a small change in the position.`;
  const alternative = suggestedSan && suggestedSan !== played ? ` The engine preferred ${suggestedSan} in the position before this move.` : '';
  const severity = label === 'Blunder' ? 'a substantial' : label === 'Mistake' ? 'a noticeable' : 'a modest';
  return `${played} leads to ${severity} drop in the estimated result for the player who moved.${alternative} Review the suggested continuation to understand the difference.`;
}
