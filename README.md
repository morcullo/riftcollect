# RiftCollect — static web app + serverless TCGCSV proxy

This version does NOT require Node/npm for the user. It is a normal HTML/CSS/JavaScript web app with one serverless API function.

Deploy the folder to Vercel. Vercel runs `api/search.js` automatically; the browser only talks to `/api/search`, while the serverless function talks to TCGCSV.

TCGCSV documents restrictive CORS, so browser-side fetches to TCGCSV are not supported. It also asks applications to use a custom User-Agent and avoid excessive polling. This implementation uses a custom User-Agent and caches the product catalog in the serverless function's warm runtime.

Riftbound category ID: 89.

The app uses TCGCSV's TCGplayer-derived product and market-price data. Market prices are USD and may be null for low-volume products.


## UI redesign
- Light neutral theme
- Subtle turquoise accents
- Smaller floating pill navigation
- Icon-only Home / Collection navigation
- Compact centered Add button


## Navigation refinement
- Wider floating navigation
- Explicit flex centering for all icons
- Slightly larger tap targets while keeping the nav compact


## Vercel
This build uses `api/search.mjs` as a Vercel Web Handler. Vercel automatically serves files in `/api` as functions, so no `/api/search` rewrite is required.
