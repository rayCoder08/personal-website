My personal website, showcasing projects I've created (both hardware and software), which will be updated from time to time.

## Preview and deploy

Serve the `docs` directory over HTTP, for example with `python -m http.server 4173 --directory docs` from the repository root. Open `http://127.0.0.1:4173/`. The graph loads its local catalog over HTTP.

GitHub Pages serves `docs` from `main`, with no build step. Merge the portfolio branch into `main` and push to publish.

## Aerochronix graph

The hero uses 12 cases and seven factors from the [deployed Aerochronix catalog](https://aerochronix.netlify.app/#/graph). The checked-in catalog preserves the 30 documented associations in the subset. Its desktop and mobile coordinates come from Aerochronix’s original D3 force layout, fitted to the portfolio canvas.

`docs/graph-model.js` ports the original relationship index, edge paths, and camera functions from `rayCoder08/near-miss`. `docs/hero-graph.js` adapts the original SVG nodes and selection patterns to the static site. The portfolio serves its own catalog and thumbnails, with credits in the incident details.
