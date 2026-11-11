import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4186;
const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
  '--port', String(port), '--strictPort'
], { stdio: 'ignore' });
const origin = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ready() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Fern Vite server did not start.');
}

let browser;
try {
  await ready();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole('button', { name: /explore a sample game/i }).click();
  await page.getByRole('button', { name: 'Analyse game' }).waitFor();
  await page.getByRole('button', { name: 'First move' }).click();
  await page.getByText('0 / 16').waitFor();
  await page.getByRole('button', { name: 'Next move' }).click();
  await page.getByText('1 / 16').waitFor();
  await page.getByRole('button', { name: /Save game/i }).first().click();
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByText('White vs Black').waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByText('White vs Black').waitFor();
  if (errors.length) throw new Error('Browser runtime errors: ' + errors.join('; '));
  console.log('PASS: sample PGN import, move replay, save and library persistence.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
