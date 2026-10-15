import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 4173;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore','pipe','pipe'] });
const stop = () => { if (!server.killed) server.kill('SIGTERM'); };
process.on('exit', stop);

async function waitForServer() {
  for (let i=0;i<60;i++) {
    try { const r=await fetch(`http://127.0.0.1:${port}/`); if (r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,250));
  }
  throw new Error('Vite benchmark server did not start.');
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  const generator = spawn(process.execPath, ['tests/browser-bench-page.mjs'], {stdio:['ignore','pipe','inherit']});
  let html=''; for await (const chunk of generator.stdout) html += chunk;
  await page.setContent(html);
  const result = await page.waitForFunction(() => window.__FERN_BENCH__?.done, null, {timeout:180000}).then(h=>h.jsonValue());
  if (result.error) throw new Error(result.error);
  writeFileSync('stockfish19-browser-results.json', JSON.stringify(result.results,null,2)+'\n');
  for (const row of result.results) console.log(JSON.stringify(row));
  console.log(`PASS: ${result.results.length} Stockfish 19 browser depth checks`);
} finally {
  await browser?.close();
  stop();
}
