import { readFileSync } from 'node:fs';

const cases = JSON.parse(readFileSync(new URL('./positions.json', import.meta.url), 'utf8')).cases;
const depths = [...new Set(cases.flatMap(item => item.depths))].sort((a,b)=>a-b);

const rows = cases.flatMap(item => item.depths.map(depth => ({
  id: item.id, fen: item.fen, depth
})));

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fern Browser Bench</title></head>
<body><pre id="out">Starting Fern browser benchmark…</pre>
<script>
const jobs = ${JSON.stringify(rows)};
const out = document.getElementById('out');
const worker = new Worker('/engine/stockfish-19-lite-single.js');
let readyResolve, pending, latest;
const ready = new Promise(r => readyResolve=r);
worker.onmessage = ({data}) => {
  for (const line of String(data).split(/\\r?\\n/)) {
    if (line === 'uciok') { worker.postMessage('setoption name UCI_ShowWDL value true'); worker.postMessage('isready'); }
    if (line === 'readyok') readyResolve();
    if (!pending) continue;
    if (line.startsWith('info ') && /\\bscore (cp|mate) -?\\d+/.test(line) && !/\\b(lowerbound|upperbound)\\b/.test(line)) {
      const d=Number(line.match(/\\bdepth (\\d+)/)?.[1]||0), score=line.match(/\\bscore (cp|mate) (-?\\d+)/), w=line.match(/\\bwdl (\\d+) (\\d+) (\\d+)/);
      if (d >= (latest?.depth||0)) latest={depth:d,scoreType:score?.[1]||null,score:score?Number(score[2]):null,wdl:w?w.slice(1).map(Number):null};
    }
    if (line.startsWith('bestmove ')) { const p=pending; pending=null; p.resolve({...latest,bestMove:line.split(' ')[1]}); }
  }
};
worker.postMessage('uci');
async function analyse(job) {
  await ready; latest=null; const started=performance.now();
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending=null;reject(new Error('timeout'));},30000);
    pending={resolve:v=>{clearTimeout(timer);resolve(v)},reject};
    worker.postMessage('position fen '+job.fen); worker.postMessage('go depth '+job.depth);
  });
  return {...job,...result,runtimeMs:Math.round((performance.now()-started)*100)/100};
}
(async()=>{const results=[];try{for(const job of jobs){const row=await analyse(job);results.push(row);out.textContent=JSON.stringify(results,null,2);} window.__FERN_BENCH__={done:true,results};}catch(e){window.__FERN_BENCH__={done:true,error:String(e),results};out.textContent=JSON.stringify(window.__FERN_BENCH__,null,2);}finally{worker.terminate();}})();
</script></body></html>`;
process.stdout.write(html);
