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
  page.on('console', msg => console.log('[browser]', msg.text()));
  page.on('pageerror', err => console.error('[browser error]', err.message));
  const generator = spawn(process.execPath, ['tests/browser-bench-page.mjs'], {stdio:['ignore','pipe','inherit']});
  let html=''; for await (const chunk of generator.stdout) html += chunk;
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.setContent(html);
  await page.waitForFunction(() => window.__FERN_BENCH__?.done === true, null, {timeout:240000});
  const result = await page.evaluate(() => window.__FERN_BENCH__);
  console.log('[benchmark result]', JSON.stringify(result));
  if (!result || typeof result !== 'object') throw new Error('Browser benchmark returned no result object.');
  if (result.error) throw new Error(`Browser benchmark failed: ${result.error}`);
  if (!Array.isArray(result.results)) throw new Error(`Browser benchmark returned invalid results: ${JSON.stringify(result)}`);
  writeFileSync('stockfish19-browser-results.json', JSON.stringify(result.results,null,2)+'\n');
  for (const row of result.results) console.log(JSON.stringify(row));
  console.log(`PASS: ${result.results.length} Stockfish 19 browser depth checks`);
} finally {
  await browser?.close();
  stop();
}
