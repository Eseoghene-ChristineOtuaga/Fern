# Fern

A calm, green chess study app. Paste or upload a PGN, replay moves on a board, and save games locally.

## Run locally

```bash
npm install
npm run dev
```

## Current milestone

- PGN paste and file import (chess.js)
- Move-by-move replay and board flip
- Local saved-game library
- Responsive interface

**Now included:** Stockfish 19 Lite single-threaded WASM position evaluations, suggested moves and depth-10 whole-game analysis. The engine runs locally in a browser Web Worker.\n\n**Not implemented yet:** reliable move-quality classification, AI explanations, Supabase sync. Position evaluations are not automatically move grades. The interface deliberately does not claim that moves have been analysed.

## Next milestone

Add move-quality grading using a consistent perspective, mate-aware evaluation and practical thresholds, plus engine-line explanations. Keep optional AI explanations server-side; never expose API keys in the browser.\n\nThe Vite plugin copies the official engine JS and WASM from the npm package into public/engine on dev and build. The Stockfish engine is GPL-3.0; review redistribution obligations before production release.
