import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreForPlayer, reviewMove } from '../src/review.js';
// Synthetic UCI scores verify interpretation, not Stockfish chess strength.
const p=(turn,value,bestMove='e2e4',depth=12)=>({turn,result:{type:'cp',value,bestMove,depth}});
const move={from:'e2',to:'e4',san:'e4'};
const r=(a,b)=>reviewMove(a,b,move);
test('alternating side-to-move signs preserve equal evaluations',()=>{
 const x=r(p('w',80),p('b',-80));
 assert.equal(x.label,'Best');assert.equal(x.loss,0);
});
test('equal-to-losing is worse than winning-to-still-winning',()=>{
 const a=r(p('w',0,'d2d4'),p('b',300));
 const b=r(p('w',900,'d2d4'),p('b',-600));
 assert.ok(a.loss>b.loss);assert.equal(a.label,'Blunder');
});
test('black move perspective',()=>{
 const x=reviewMove(p('b',0,'d7d5'),p('w',300),{from:'e7',to:'e5',san:'e5'});
 assert.equal(x.label,'Blunder');
});
test('terminal loss and drawn outcome',()=>{
 assert.equal(r(p('w',0,'d2d4'),{turn:'b',outcome:'b'}).label,'Blunder');
 assert.equal(r(p('w',400,'d2d4'),{turn:'b',outcome:'draw'}).label,'Blunder');
 assert.equal(scoreForPlayer({turn:'b',result:{type:'mate',value:-1}},'w'),1);
});
test('forced mate dropped to modest advantage is severe',()=>{
 const a={turn:'w',result:{type:'mate',value:3,bestMove:'d2d4',depth:16}};
 assert.equal(r(a,p('b',-20)).label,'Blunder');
});
test('missing evidence is not classified',()=>{
 assert.equal(r(p('w',0),{turn:'b',result:null}),null);
});
