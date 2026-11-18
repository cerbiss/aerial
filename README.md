# Aerial — Rocket League boosting

A single-page, scroll-driven site for a Rocket League boosting and coaching service. The Octane sits at the centre of the page in a live 3D scene and moves with the scroll.

No build step: it is one static `index.html` plus the 3D model. Libraries (three.js, Lenis, Archivo font) load from public CDNs.

## Run locally

```bash
npx serve .
```

Open the printed URL. The page has to be served over HTTP (not opened as a file) so the model can load.

## Deploy on Vercel

Import this repository at vercel.com/new. Framework preset: **Other**, no build command, output directory `.`. Every push to `main` redeploys.

## What's in the page

- Scroll choreography: the car drives in on load, turns with each section, crosses the screen in "How it works", jumps out of frame in "Coaching" and comes back for the final call to action.
- Drag to rotate the car in the hero, paint swatches, boost flame and wheel spin tied to scroll speed.
- Boost calculator with rank sliders, playlist and extras (placeholder prices, checkout not connected).
- Responsive down to phones; respects reduced-motion settings.

## Editing

- Prices: the `TIERS` table and extras in `index.html`.
- Car framing per section: the `DESK` (desktop) and `MOB` (phone) tables in `index.html`.
- Model: the `MODEL` object in `index.html` (path, forward axis, wheel nodes, paint material, boost nozzle).

## Credits

- "Octane - Rocket League Car" 3D model by [Jako](https://sketchfab.com/fairlight51), from [Sketchfab](https://sketchfab.com/3d-models/octane-rocket-league-car-9910f0a5d158425bbc7deb60c7a81f69), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Compressed with glTF-Transform (meshopt geometry, WebP textures); no other changes.
- Aerial is not affiliated with, endorsed or sponsored by Psyonix LLC or Epic Games. Rocket League and Octane are trademarks of Psyonix LLC.
