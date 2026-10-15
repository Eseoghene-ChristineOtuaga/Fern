import { reviewMove, summarizeReviews, explainMove } from './review.js';
import { createEngine, describeEvaluation, describeBestMove } from './engine.js';
import React,{useMemo,useState,useEffect,useRef} from 'react';
import {Chess} from 'chess.js';
import {Chessboard} from 'react-chessboard';
import {ArrowRight,BookOpen,ChevronLeft,ChevronRight,FileUp,FlipHorizontal,RotateCcw,Trash2} from 'lucide-react';

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
function PawnMark(){return <span className="fern-mark" aria-hidden="true"><svg viewBox="0 0 46 46" fill="none"><circle cx="23" cy="14" r="6" stroke="currentColor" strokeWidth="2.6"/><path d="M17 23h12l3 7H14l3-7Zm-6 14h24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
function gradeClass(label=''){return label.toLowerCase().replace(/\s+/g,'-')}

export default function App(){
 const [input,setInput]=useState('');
 const [loaded,setLoaded]=useState(null);
 const [index,setIndex]=useState(0);
 const [error,setError]=useState('');
 const [orientation,setOrientation]=useState('white');
 const [saved,setSaved]=useState(readSaved);
 const [section,setSection]=useState('study');
 const [analysisMode,setAnalysisMode]=useState('standard');
 const [guideIndex,setGuideIndex]=useState(0);
 const engineRef=useRef(null);
 const runRef=useRef(0);
 const [analysis,setAnalysis]=useState({status:'idle',positions:[],message:''});

 useEffect(()=>()=>{runRef.current++;engineRef.current?.dispose()},[]);
 useEffect(()=>{setGuideIndex(0)},[analysis.status,loaded]);

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
     for(let i=0;i<=loaded.moves.length;i++){
       if(run!==runRef.current)return;
       setAnalysis({status:'running',positions:[...positions],message:`Analysing ${i+1} of ${loaded.moves.length+1} positions…`});
       const fen=board.fen();
       const turn=board.turn();
       const outcome=board.isGameOver() ? (board.isDraw() ? 'draw' : board.turn() === 'w' ? 'b' : 'w') : null;
       const result=outcome?null:await engine.analyse(fen,mode.depth);
       positions.push({fen,turn,result,outcome});
       if(i<loaded.moves.length)board.move(loaded.moves[i].san);
     }
     if(run===runRef.current)setAnalysis({status:'done',positions,message:`${mode.label} analysis complete.`});
   }catch(e){if(run===runRef.current)setAnalysis({status:'error',positions:[],message:e.message||'Engine analysis failed.'})}
   finally{if(run===runRef.current){engine.dispose();engineRef.current=null}}
 };

 const stopAnalysis=()=>{runRef.current++;engineRef.current?.dispose();engineRef.current=null;setAnalysis({status:'idle',positions:[],message:'Analysis cancelled.'})};
 const current=useMemo(()=>{const game=new Chess();if(loaded)loaded.moves.slice(0,index).forEach(m=>game.move(m.san));return game},[loaded,index]);
 const total=loaded?.moves.length||0;
 const load=(pgn)=>{try{const parsed=parsePgn(pgn);if(!parsed.moves.length)throw Error('This PGN has no moves.');stopAnalysis();setLoaded(parsed);setInput(pgn);setIndex(parsed.moves.length);setSection('study');setError('')}catch(e){setError('Could not read that PGN. Check the move notation and try again.');}};
 const save=()=>{if(!loaded)return;const item={id:crypto.randomUUID(),title:[loaded.headers.White||'White',loaded.headers.Black||'Black'].join(' vs '),date:new Date().toISOString(),pgn:loaded.pgn,moves:loaded.moves.length};const next=[item,...saved].slice(0,25);setSaved(next);localStorage.setItem(STORAGE,JSON.stringify(next))};
 const remove=(id)=>{const next=saved.filter(x=>x.id!==id);setSaved(next);localStorage.setItem(STORAGE,JSON.stringify(next))};
 const onFile=async(e)=>{const file=e.target.files?.[0];if(file){if(file.size>1024*1024){setError('Please choose a PGN smaller than 1 MB.');return;}load(await file.text());}e.target.value=''};

 const boardOptions={position:current.fen(),boardOrientation:orientation,allowDragging:false,animationDurationInMs:170,showNotation:true,boardStyle:{borderRadius:'8px',boxShadow:'none',overflow:'hidden'},darkSquareStyle:{backgroundColor:'#789b78'},lightSquareStyle:{backgroundColor:'#ecf0de'},alphaNotationStyle:{fontSize:'clamp(8px,1.6vw,11px)',fontWeight:700,padding:'2px 3px'},numericNotationStyle:{fontSize:'clamp(8px,1.6vw,11px)',fontWeight:700,padding:'2px 3px'}};
 const turn=index?loaded?.moves[index-1]:null;
 const reviews=useMemo(()=>loaded?.moves.map((move,i)=>reviewMove(analysis.positions[i],analysis.positions[i+1],move))||[],[loaded,analysis.positions]);
 const currentReview=index>0?reviews[index-1]:null;
 const summary=useMemo(()=>summarizeReviews(reviews),[reviews]);
 const guidedMoments=summary.worst;
 const guidedReview=guidedMoments[guideIndex]||null;
 const guidedMoveIndex=guidedReview?reviews.indexOf(guidedReview):-1;
 const suggested=useMemo(()=>{
   if(!loaded||index===0||!analysis.positions[index-1])return null;
   const position=analysis.positions[index-1];
   return describeBestMove(position.fen,position.result?.bestMove);
 },[loaded,index,analysis.positions]);

 const nav=(name,label)=><button className={section===name?'section-tab active':'section-tab'} onClick={()=>setSection(name)}>{label}</button>;

 return <div className="app">
   <header className="site-header">
     <div className="shell nav">
       <div className="brand"><PawnMark/><span>fern<span className="brand-dot">.</span></span></div>
       <nav className="section-tabs" aria-label="Fern sections">{nav('study','Study')}{nav('review','Review')}{nav('library','Library')}</nav>
       <span className="nav-note">A quieter way to understand your chess.</span>
     </div>
   </header>

   <main className="shell">
     {section==='study'&&<>
       <section className="hero compact-hero">
         <div className="eyebrow">YOUR PERSONAL CHESS STUDY</div>
         <h1>Every move has a <em>story.</em></h1>
         <p>Bring a game, replay it at your pace, and let Fern surface the moments worth understanding.</p>
       </section>

       <div className="study-layout">
         <section className="board-panel">
           <div className="panel-heading"><div><span className="kicker">THE BOARD</span><h2>{loaded?'Your game':'A place to begin'}</h2></div><button className="icon-button" title="Flip board" aria-label="Flip board" onClick={()=>setOrientation(v=>v==='white'?'black':'white')}><FlipHorizontal size={18}/></button></div>
           <div className="board-wrap"><Chessboard options={boardOptions}/></div>
           <div className="board-bottom"><span>{loaded? `${loaded.headers.White||'White'} · ${loaded.headers.Black||'Black'}`:'Starting position'}</span><span>{loaded? `${index} / ${total} half-moves`:'Ready when you are'}</span></div>
           <div className="playback">
             <button aria-label="First move" disabled={!loaded||index===0} onClick={()=>setIndex(0)}><RotateCcw size={17}/></button>
             <button aria-label="Previous move" disabled={!loaded||index===0} onClick={()=>setIndex(i=>i-1)}><ChevronLeft size={22}/></button>
             <div className="move-indicator">{turn?`${Math.ceil(index/2)}${index%2?'.':'...'} ${turn.san}`:'Start'}</div>
             <button aria-label="Next move" disabled={!loaded||index===total} onClick={()=>setIndex(i=>i+1)}><ChevronRight size={22}/></button>
             <button aria-label="Last move" disabled={!loaded||index===total} onClick={()=>setIndex(total)}><ArrowRight size={17}/></button>
           </div>
         </section>

         <aside className="study-sidebar">
           {!loaded?<section className="card import-card"><span className="kicker">BRING YOUR GAME</span><h2>Let's take a look.</h2><p>Paste a PGN from a game you've played, or upload a <code>.pgn</code> file.</p><textarea aria-label="Paste PGN" value={input} onChange={e=>setInput(e.target.value)} placeholder={'[Event "My game"]\n\n1. e4 e5 2. Nf3 ...'} spellCheck={false}/>{error&&<p className="error" role="alert">{error}</p>}<div className="import-actions"><label className="file-button"><FileUp size={17}/> Upload PGN<input type="file" accept=".pgn,.txt" onChange={onFile} hidden/></label><button className="primary-button" onClick={()=>load(input)} disabled={!input.trim()}>Open game <ArrowRight size={17}/></button></div><button className="sample-link" onClick={()=>load(SAMPLE)}>Or explore a sample game <ArrowRight size={14}/></button></section>
           :<section className="card move-list-card"><div className="card-head-row"><div><span className="kicker">MOVES</span><h2>Replay the game.</h2></div><button className="text-button" onClick={()=>{stopAnalysis();setLoaded(null);setInput('');setIndex(0)}}>New game</button></div><div className="move-list">{loaded.moves.map((m,i)=>{const r=reviews[i];return <button className={index===i+1?'move-row active':''||'move-row'} key={i} onClick={()=>setIndex(i+1)}><span>{Math.ceil((i+1)/2)}{i%2?'...':'.'}</span><strong>{m.san}</strong><em className={r?.label?`grade-badge ${gradeClass(r.label)}`:''}>{r?.label||''}</em></button>})}</div></section>}

           <section className="card analysis-card">
             <span className="kicker">ANALYSIS</span><h2>Read the position.</h2>
             <div className="mode-switch" role="group" aria-label="Analysis intensity">{Object.entries(ANALYSIS_MODES).map(([key,mode])=><button key={key} type="button" className={analysisMode===key?'active':''} disabled={analysis.status==='running'} onClick={()=>setAnalysisMode(key)}>{mode.label}</button>)}</div>
             <p className="mode-note">Standard is the default. Deeper analysis takes longer.</p>
             <div className="engine-actions"><button className="primary-button" disabled={!loaded||analysis.status==='running'} onClick={analyzeGame}>Analyse game</button>{analysis.status==='running'&&<button className="file-button" onClick={stopAnalysis}>Cancel</button>}</div>
             <p className="engine-status" role="status">{analysis.message||'Load a game to begin.'}</p>
             {analysis.positions[index]&&<div className="engine-result"><strong>{describeEvaluation(analysis.positions[index].result,analysis.positions[index].turn)}</strong><span>{analysis.positions[index].result?.bestMove?`Engine suggestion: ${describeBestMove(analysis.positions[index].fen,analysis.positions[index].result.bestMove)}`:'Game over / no legal moves'}</span></div>}
           </section>

           {analysis.status==='done'&&currentReview&&<section className="card current-review-card"><span className="kicker">THIS MOVE</span><div className="current-grade"><strong className={`grade-badge large ${gradeClass(currentReview.label)}`}>{currentReview.label}</strong><span>{turn?.san}</span></div><p>{explainMove(currentReview,suggested)}</p><button className="text-button" onClick={()=>setSection('review')}>Open full review <ArrowRight size={14}/></button></section>}
         </aside>
       </div>
     </>}

     {section==='review'&&<section className="review-page">
       <div className="page-heading"><div><span className="kicker">REVIEW</span><h1>Understand the turning points.</h1></div>{loaded&&<button className="text-button" onClick={()=>setSection('study')}>Back to board</button>}</div>
       {!loaded?<div className="empty-state"><BookOpen size={22}/><h2>No game open yet.</h2><p>Open a game in Study first, then come back here for the report.</p><button className="primary-button" onClick={()=>setSection('study')}>Go to Study</button></div>
       :analysis.status!=='done'?<div className="empty-state"><h2>Your review isn't ready yet.</h2><p>Run Stockfish analysis in Study to generate move classifications and turning points.</p><button className="primary-button" onClick={()=>setSection('study')}>Analyse this game</button></div>
       :<div className="review-grid">
         <section className="card report-card"><span className="kicker">FULL REPORT</span><h2>{summary.reviewed} moves reviewed.</h2><div className="review-stats">{Object.entries(summary.counts).map(([label,count])=><div className={`stat-${gradeClass(label)}`} key={label}><strong>{count}</strong><span>{label}</span></div>)}</div><p>Fern compares the position before and after each move, using Stockfish evidence rather than guessing from notation alone.</p></section>
         <section className="card guided-card"><span className="kicker">REVIEW WITH FERN</span><h2>One important moment at a time.</h2>{guidedReview?<div className="guided-step"><div className="guided-progress">Moment {guideIndex+1} of {guidedMoments.length}</div><div className="guided-move"><span>{Math.ceil((guidedMoveIndex+1)/2)}{guidedMoveIndex%2?'...':'.'} {guidedReview.played}</span><strong className={`grade-badge ${gradeClass(guidedReview.label)}`}>{guidedReview.label}</strong></div><p>{explainMove(guidedReview,describeBestMove(analysis.positions[guidedMoveIndex]?.fen,analysis.positions[guidedMoveIndex]?.result?.bestMove))}</p><div className="guided-actions"><button className="text-button" disabled={guideIndex===0} onClick={()=>setGuideIndex(i=>Math.max(0,i-1))}>Previous</button><button className="primary-button" onClick={()=>{setIndex(guidedMoveIndex+1);setSection('study')}}>Show on board <ArrowRight size={14}/></button><button className="text-button" disabled={guideIndex===guidedMoments.length-1} onClick={()=>setGuideIndex(i=>Math.min(guidedMoments.length-1,i+1))}>Next</button></div></div>:<p>No major turning points found. This game was unusually steady.</p>}</section>
       </div>}
     </section>}

     {section==='library'&&<section className="library-page">
       <div className="page-heading"><div><span className="kicker">LIBRARY</span><h1>Games worth revisiting.</h1></div>{loaded&&<button className="save-button" onClick={save}><BookOpen size={16}/> Save current game</button>}</div>
       {saved.length?<div className="history-list">{saved.map(item=><div className="history-row" key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.date).toLocaleDateString()} · {item.moves} half-moves</span></div><div className="history-actions"><button onClick={()=>{load(item.pgn);setSection('study')}}>Open <ArrowRight size={15}/></button><button aria-label="Delete saved game" onClick={()=>remove(item.id)}><Trash2 size={17}/></button></div></div>)}</div>:<div className="empty-history"><BookOpen size={21}/><span>No saved games yet. Your studies will live here.</span></div>}
     </section>}

     <footer><span>fern.</span><span>Even Levy blunders.</span><span>Chess is fun.</span></footer>
   </main>
 </div>
}