import { reviewMove, summarizeReviews, explainMove } from './review.js';
import { createEngine, describeEvaluation, describeBestMove } from './engine.js';
import React,{useMemo,useState,useEffect,useRef} from 'react';
import {Chess} from 'chess.js';
import {Chessboard} from 'react-chessboard';
import {ArrowLeft,ArrowRight,BookOpen,Check,ChevronLeft,ChevronRight,Clipboard,FileUp,FlipHorizontal,Leaf,RotateCcw,Trash2} from 'lucide-react';

const SAMPLE=`[Event "Fern sample game"]
[Site "Local"]
[Date "2026.10.14"]
[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 *`;
const STORAGE='fern-saved-games-v1';
const ANALYSIS_MODES={quick:{label:'Quick',depth:10},standard:{label:'Standard',depth:12},deep:{label:'Deep',depth:16}};
function parsePgn(source){const game=new Chess();game.loadPgn(source.trim());return{moves:game.history({verbose:true}),headers:game.header(),pgn:game.pgn()};}
function readSaved(){try{const x=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(x)?x:[]}catch{return []}}
function FernMark(){return <span className="fern-mark" aria-hidden="true"><svg viewBox="0 0 46 46" fill="none"><path d="M9 34c1-14 13-25 29-26-1 17-12 29-27 28" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="M13 34 33 14M21 27l-3-9m10 2 9 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg></span>}
export default function App(){
 const [input,setInput]=useState('');const [loaded,setLoaded]=useState(null);const [index,setIndex]=useState(0);const [error,setError]=useState('');const [orientation,setOrientation]=useState('white');const [saved,setSaved]=useState(readSaved);
 const engineRef=useRef(null);
 const runRef=useRef(0);
 const [analysis,setAnalysis]=useState({status:'idle',positions:[],message:''});
 const [analysisMode,setAnalysisMode]=useState('standard');
 useEffect(()=>()=>{runRef.current++;engineRef.current?.dispose()},[]);
 const analyzeGame=async()=>{
   if(!loaded || analysis.status==='running')return;
   const run=++runRef.current;
   engineRef.current?.dispose();
   const engine=createEngine();engineRef.current=engine;
   const board=new Chess();
   const positions=[];
   const mode=ANALYSIS_MODES[analysisMode];
   setAnalysis({status:'running',positions:[],message:'Starting Stockfish…'});
   try{
     // Analyse after every move, and the initial position, at the same depth.
     for(let i=0;i<=loaded.moves.length;i++){
       if(run!==runRef.current)return;
       setAnalysis({status:'running',positions:[...positions],message:`Analysing position ${i+1} of ${loaded.moves.length+1}…`});
       const fen=board.fen();
       const turn=board.turn();
       const outcome=board.isGameOver() ? (board.isDraw() ? 'draw' : board.turn() === 'w' ? 'b' : 'w') : null;
       const result=outcome?null:await engine.analyse(fen,mode.depth);
       positions.push({fen,turn,result,outcome});
       if(i<loaded.moves.length)board.move(loaded.moves[i].san);
     }
     if(run===runRef.current)setAnalysis({status:'done',positions,message:'Engine analysis complete.'});
   }catch(e){if(run===runRef.current)setAnalysis({status:'error',positions:[],message:e.message||'Engine analysis failed.'})}
   finally{if(run===runRef.current){engine.dispose();engineRef.current=null}}
 };
 const stopAnalysis=()=>{runRef.current++;engineRef.current?.dispose();engineRef.current=null;setAnalysis({status:'idle',positions:[],message:'Analysis cancelled.'})};
 const current=useMemo(()=>{const game=new Chess();if(loaded)loaded.moves.slice(0,index).forEach(m=>game.move(m.san));return game},[loaded,index]);
 const total=loaded?.moves.length||0;
 const load=(pgn)=>{try{const parsed=parsePgn(pgn);if(!parsed.moves.length)throw Error('This PGN has no moves.');stopAnalysis();setLoaded(parsed);setInput(pgn);setIndex(parsed.moves.length);setError('')}catch(e){setError('Could not read that PGN. Check the move notation and try again.');}};
 const save=()=>{if(!loaded)return;const item={id:crypto.randomUUID(),title:[loaded.headers.White||'White',loaded.headers.Black||'Black'].join(' vs '),date:new Date().toISOString(),pgn:loaded.pgn,moves:loaded.moves.length};const next=[item,...saved].slice(0,25);setSaved(next);localStorage.setItem(STORAGE,JSON.stringify(next))};
 const remove=(id)=>{const next=saved.filter(x=>x.id!==id);setSaved(next);localStorage.setItem(STORAGE,JSON.stringify(next))};
 const onFile=async(e)=>{const file=e.target.files?.[0];if(file){if(file.size>1024*1024){setError('Please choose a PGN smaller than 1 MB.');return;}load(await file.text());}e.target.value=''};
 const boardOptions={position:current.fen(),boardOrientation:orientation,allowDragging:false,animationDurationInMs:170,boardStyle:{borderRadius:'8px',boxShadow:'none'},darkSquareStyle:{backgroundColor:'#789b78'},lightSquareStyle:{backgroundColor:'#ecf0de'}};
 const turn=index?loaded.moves[index-1]:null;
 const reviews=useMemo(()=>loaded?.moves.map((move,i)=>reviewMove(analysis.positions[i],analysis.positions[i+1],move))||[],[loaded,analysis.positions]);
 const currentReview=index>0?reviews[index-1]:null;
 const summary=useMemo(()=>summarizeReviews(reviews),[reviews]);
 const suggested=useMemo(()=>{
   if(!loaded||index===0||!analysis.positions[index-1])return null;
   const position=analysis.positions[index-1];
   return describeBestMove(position.fen,position.result?.bestMove);
 },[loaded,index,analysis.positions]);

 return <div className="app"><header className="site-header"><div className="shell nav"><div className="brand"><FernMark/><span>fern<span className="brand-dot">.</span></span></div><span className="nav-note">A quieter way to understand your chess.</span><span className="version">EARLY ACCESS / 01</span></div></header>
 <main className="shell"><section className="hero"><div className="eyebrow"><span className="eyebrow-line"/> YOUR PERSONAL CHESS STUDY</div><h1>Every move<br/>has a <em>story.</em></h1><p>Bring a game. Replay the moments. Learn to see the board differently, one move at a time.</p></section>
 <div className="workspace"><section className="board-panel"><div className="panel-heading"><div><span className="kicker">01 / THE BOARD</span><h2>{loaded?'Your game':'A place to begin'}</h2></div><button className="icon-button" title="Flip board" aria-label="Flip board" onClick={()=>setOrientation(v=>v==='white'?'black':'white')}><FlipHorizontal size={18}/></button></div><div className="board-wrap"><Chessboard options={boardOptions}/></div><div className="board-bottom"><span>{loaded? `${loaded.headers.White||'White'}  ·  ${loaded.headers.Black||'Black'}`:'Starting position'}</span><span>{loaded? `${index} / ${total} half-moves`:'Ready when you are'}</span></div><div className="playback"><button aria-label="First move" disabled={!loaded||index===0} onClick={()=>setIndex(0)}><RotateCcw size={17}/></button><button aria-label="Previous move" disabled={!loaded||index===0} onClick={()=>setIndex(i=>i-1)}><ChevronLeft size={22}/></button><div className="move-indicator">{turn?`${Math.ceil(index/2)}${index%2?'.':'...'} ${turn.san}`:'Start'}</div><button aria-label="Next move" disabled={!loaded||index===total} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={22}/></button><button aria-label="Last move" disabled={!loaded||index===total} onClick={()=>setIndex(total)}><ArrowRight size={17}/></button></div></section>
 <div className="side-column"><section className="card import-card"><span className="kicker">02 / BRING YOUR GAME</span><h2>Let's take a look.</h2><p>Paste a PGN from a game you've played, or upload a <code>.pgn</code> file.</p><textarea aria-label="Paste PGN" value={input} onChange={e=>setInput(e.target.value)} placeholder={'[Event "My game"]\n\n1. e4 e5 2. Nf3 ...'} spellCheck={false}/>{error&&<p className="error" role="alert">{error}</p>}<div className="import-actions"><label className="file-button"><FileUp size={17}/> Upload PGN<input type="file" accept=".pgn,.txt" onChange={onFile} hidden/></label><button className="primary-button" onClick={()=>load(input)} disabled={!input.trim()}>Open game <ArrowRight size={17}/></button></div><button className="sample-link" onClick={()=>load(SAMPLE)}>Or explore a sample game <ArrowRight size={14}/></button></section>
 <section className="card analysis-card"><span className="kicker">03 / STOCKFISH ENGINE</span><h2>Read the position.</h2><p>Stockfish 19 Lite runs privately in your browser. Choose how deeply Fern should inspect the game.</p><div className="engine-actions" role="group" aria-label="Analysis intensity">{Object.entries(ANALYSIS_MODES).map(([key,mode])=><button key={key} type="button" className={analysisMode===key?'primary-button':'file-button'} disabled={analysis.status==='running'} onClick={()=>setAnalysisMode(key)}>{mode.label}</button>)}</div><p className="engine-status">Standard is the default. Deeper analysis takes longer.</p><div className="engine-actions"><button className="primary-button" disabled={!loaded||analysis.status==='running'} onClick={analyzeGame}>Analyse game</button>{analysis.status==='running'&&<button className="file-button" onClick={stopAnalysis}>Cancel</button>}</div><p className="engine-status" role="status">{analysis.message||'Load a game to begin.'}</p>{analysis.positions[index]&&<div className="engine-result"><strong>{describeEvaluation(analysis.positions[index].result,analysis.positions[index].turn)}</strong><span>{analysis.positions[index].result?.bestMove?`Engine suggestion: ${describeBestMove(analysis.positions[index].fen,analysis.positions[index].result.bestMove)}`:'Game over / no legal moves'}</span><small>Depth {analysis.positions[index].result?.depth??'—'} · Evaluation is for the displayed position, not a move-quality grade.</small></div>}</section>
 <section className="card review-card"><span className="kicker">04 / MOVE REVIEW</span><h2>What changed?</h2>{analysis.status==='done'?<><p>{summary.reviewed} of {total} moves reviewed. Grades are approximate and depend on engine search depth.</p><div className="review-stats">{Object.entries(summary.counts).map(([label,count])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div>{currentReview?<div className="review-detail"><strong>{Math.ceil(index/2)}{index%2?'.':'...'} {turn?.san} · {currentReview.label}</strong><p>{explainMove(currentReview,suggested)}</p></div>:<p>Use the move arrows to inspect an individual move.</p>}{summary.worst.length>0&&<div className="review-moments"><strong>Moments to revisit</strong>{summary.worst.map(r=>{const i=reviews.indexOf(r);return <button key={i} onClick={()=>setIndex(i+1)}>{Math.ceil((i+1)/2)}{i%2?'...':'.'} {r.played} · {r.label} <ArrowRight size={14}/></button>})}</div>}</>:<p>Run Stockfish analysis above to review moves and find positions worth revisiting.</p>}</section>
 <section className="card insight-card"><div className="insight-head"><div className="small-leaf"><Leaf size={20}/></div><span className="kicker">FERN'S NOTEBOOK</span></div><h2>Look closer, not faster.</h2><p>{loaded?'Your game is ready to explore. Use the arrows to walk through each move. Stockfish now provides approximate move-quality grades and short, rule-based explanations. Deeper tactical explanations will follow.':'Good chess analysis starts with curiosity. Import a game to begin exploring what happened on the board.'}</p>{loaded&&<div className="loaded-meta"><Check size={16}/> {total} half-moves loaded successfully</div>}{loaded&&<button className="save-button" onClick={save}><BookOpen size={16}/> Save to this browser</button>}</section>
 </div></div>
 <section className="history-section"><div className="history-heading"><div><span className="kicker">03 / YOUR LIBRARY</span><h2>Games worth revisiting.</h2></div><span className="history-count">{saved.length} saved</span></div>{saved.length?<div className="history-list">{saved.map(item=><div className="history-row" key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.date).toLocaleDateString()} · {item.moves} half-moves</span></div><div className="history-actions"><button onClick={()=>load(item.pgn)}>Open <ArrowRight size={15}/></button><button aria-label="Delete saved game" onClick={()=>remove(item.id)}><Trash2 size={17}/></button></div></div>)}</div>:<div className="empty-history"><BookOpen size={21}/><span>No saved games yet. Your studies will live here.</span></div>}</section>
 <footer><span>fern.</span><span>Built for thoughtful players.</span><span>Chess is a practice, not a verdict.</span></footer></main></div>
}