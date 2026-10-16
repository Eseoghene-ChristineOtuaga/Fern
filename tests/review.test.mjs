import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreForPlayer, reviewMove, summarizeReviews, explainMove } from '../src/review.js';
const pos=(turn,value,bestMove='e2e4')=>({turn,result:{type:'cp',value,bestMove}});
const move={san:'e4',from:'e2',to:'e4'};
test('normalizes evaluation from side-to-move perspective',()=>{
 const whiteEdge=scoreForPlayer(pos('w',200),'w');
 assert.ok(whiteEdge > 0.5);
 assert.equal(scoreForPlayer(pos('b',-200),'w'), whiteEdge);
 assert.ok(scoreForPlayer(pos('b',200),'w') < 0.5);
});
test('identifies engine first-choice move',()=>{
 assert.equal(reviewMove(pos('w',40),pos('b',-40),move).label,'Best');
});
test('flags large loss and supplies honest explanation',()=>{
 const r=reviewMove(pos('w',250,'d2d4'),pos('b',300),move);
 assert.equal(r.label,'Blunder');
 assert.match(explainMove(r,'d4'),/stronger engine choice was d4/);
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

test('retains the full principal variation and marks grades as provisional',()=>{
 const before={turn:'w',result:{type:'cp',value:60,bestMove:'d2d4',bestLine:['d2d4','d7d5','c2c4'],depth:14}};
 const after={turn:'b',result:{type:'cp',value:-30,bestMove:'d7d5',depth:12}};
 const r=reviewMove(before,after,move);
 assert.deepEqual(r.bestLine,['d2d4','d7d5','c2c4']);
 assert.equal(r.searchDepth,12);
 assert.equal(r.provisional,true);
});
test('does not grade moves when engine evidence is missing',()=>{
 assert.equal(reviewMove(pos('w',50),{turn:'b',result:null},move),null);
});

test('win-chance curve is symmetric and treats equal positions as 50%',()=>{
 assert.equal(scoreForPlayer(pos('w',0),'w'),0.5);
 const plus=scoreForPlayer(pos('w',300),'w');
 const minus=scoreForPlayer(pos('w',-300),'w');
 assert.ok(Math.abs(plus+minus-1)<1e-10);
});
test('winning to still winning is less damaging than equal to losing',()=>{
 const safe=reviewMove(pos('w',900,'d2d4'),pos('b',-600),move);
 const swing=reviewMove(pos('w',0,'d2d4'),pos('b',300),move);
 assert.ok(swing.loss>safe.loss);
});

test('uses Stockfish WDL expected score when available',()=>{
 const before={turn:'w',result:{type:'cp',value:0,wdl:[400,400,200],bestMove:'d2d4',depth:12}};
 const after={turn:'b',result:{type:'cp',value:0,wdl:[500,300,200],depth:12}};
 const r=reviewMove(before,after,move);
 // Before: White 0.600. After is Black-to-move 0.650, hence White 0.350.
 assert.ok(Math.abs(r.loss-0.25)<1e-12);
 assert.equal(r.model,'stockfish-wdl-v1');
 assert.equal(r.label,'Blunder');
});
test('WDL normalization is symmetric across side to move',()=>{
 const white={turn:'w',result:{type:'cp',value:0,wdl:[600,300,100]}};
 const black={turn:'b',result:{type:'cp',value:0,wdl:[100,300,600]}};
 assert.equal(scoreForPlayer(white,'w'),scoreForPlayer(black,'w'));
});

test('retains before and after expected scores for transparent grade explanations',()=>{
 const before={turn:'w',result:{type:'cp',value:0,wdl:[600,300,100],bestMove:'d2d4',depth:12}};
 const after={turn:'b',result:{type:'cp',value:0,wdl:[500,300,200],depth:12}};
 const r=reviewMove(before,after,move);
 assert.equal(typeof r.beforeScore,'number');
 assert.equal(typeof r.afterScore,'number');
 assert.ok(r.beforeScore>=r.afterScore);
});
