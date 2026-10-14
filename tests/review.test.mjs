import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreForPlayer, reviewMove, summarizeReviews, explainMove } from '../src/review.js';
const pos=(turn,value,bestMove='e2e4')=>({turn,result:{type:'cp',value,bestMove}});
const move={san:'e4',from:'e2',to:'e4'};
test('normalizes evaluation from side-to-move perspective',()=>{
 assert.ok(scoreForPlayer(pos('w',200),'w') > 0.7);
 assert.ok(scoreForPlayer(pos('b',-200),'w') > 0.7);
 assert.ok(scoreForPlayer(pos('b',200),'w') < 0.3);
});
test('identifies engine first-choice move',()=>{
 assert.equal(reviewMove(pos('w',40),pos('b',-40),move).label,'Best / excellent');
});
test('flags large loss and supplies honest explanation',()=>{
 const r=reviewMove(pos('w',250,'d2d4'),pos('b',300),move);
 assert.equal(r.label,'Blunder');
 assert.match(explainMove(r,'d4'),/preferred d4/);
});
test('mate and terminal draw evaluations',()=>{
 assert.equal(scoreForPlayer({turn:'b',result:{type:'mate',value:-3}},'w'),1);
 assert.equal(scoreForPlayer({turn:'w',outcome:'draw'},'w'),0.5);
 assert.equal(scoreForPlayer({turn:'w',outcome:'b'},'w'),0);
});
test('summarizes grades',()=>{
 const a=reviewMove(pos('w',250,'d2d4'),pos('b',300),move);
 assert.equal(summarizeReviews([a,null]).counts.Blunder,1);
});
