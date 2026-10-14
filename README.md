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

**Not implemented yet:** Stockfish evaluations, mistake classification, AI explanations, Supabase sync. The interface deliberately does not claim that moves have been analysed.

## Next milestone

Integrate the official Stockfish lite single-threaded WASM engine in a Web Worker. Compare the position before and after each move, normalise evaluation to the moving player's perspective, and add accurate per-move insights. Keep optional AI explanations server-side; never expose API keys in the browser.
