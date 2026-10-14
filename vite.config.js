import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Serve the matching engine JS and WASM from the same origin on dev and production.
// The lightweight single-threaded build requires no COOP/COEP headers.
function stockfishAssets() {
  const names = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];
  function copy() {
    const dir = resolve('public/engine');
    mkdirSync(dir, { recursive: true });
    for (const name of names) {
      const source = resolve('node_modules/stockfish/bin', name);
      if (!existsSync(source)) throw new Error(`Missing ${source}. Run npm install first.`);
      copyFileSync(source, resolve(dir, name));
    }
  }
  return { name: 'fern-stockfish-assets', buildStart: copy, configureServer: copy };
}
export default defineConfig({ plugins: [react(), stockfishAssets()] });
