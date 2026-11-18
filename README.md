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
- Boost calculator with rank sliders, playlist and extras, and a checkout through Stripe or PayPal (see Payments).
- Responsive down to phones; respects reduced-motion settings.

## Payments (Stripe and PayPal)

Checkout opens from the calculator, the closing quote card and the coaching plans. The buyer gives an email, their Epic Games display name (never a password) and confirms they are 18+ or have a parent's consent, then pays on Stripe's or PayPal's own page.

- `api/checkout.js` re-prices the order on the server from `pricing.js` (the browser's price is never used) and returns the Stripe Checkout or PayPal URL.
- Both providers only **authorize** the amount: Stripe with `capture_method=manual`, PayPal with `intent=AUTHORIZE` (authorized in `api/paypal-return.js`). Capture it from the Stripe or PayPal dashboard once a booster or coach accepts. Stripe card holds expire after about 7 days; PayPal authorizations have a 3-day honor period.
- `api/stripe-webhook.js` checks Stripe's signature and, like the PayPal return, posts each new order to `ORDER_WEBHOOK_URL` (a Discord channel webhook works) and to the function logs. There is no database: the dashboards are the order record.
- `/grazie` and `/annullato` are the return pages.

Setup on Vercel: add the variables from `.env.example` under Project → Settings → Environment Variables, create the Stripe webhook endpoint `https://<site>/api/stripe-webhook` for `checkout.session.completed`, and test with Stripe test keys and `PAYPAL_ENV=sandbox` before going live. Stripe and PayPal accounts must belong to an adult, and both have rules on gaming-related services: check their terms before going live.

Tests: `node --test tests` (pricing, input validation, the Stripe and PayPal requests with `fetch` mocked, webhook signatures).

## Editing

- Prices: `pricing.js` (rank table, playlists, extras, bundle discount, coaching). The page and the payment API both read it. Coaching prices are also written in the coaching cards in `index.html`.
- Car framing per section: the `DESK` (desktop) and `MOB` (phone) tables in `index.html`.
- Model: the `MODEL` object in `index.html` (path, forward axis, wheel nodes, paint material, boost nozzle).

## Credits

- "Octane - Rocket League Car" 3D model by [Jako](https://sketchfab.com/fairlight51), from [Sketchfab](https://sketchfab.com/3d-models/octane-rocket-league-car-9910f0a5d158425bbc7deb60c7a81f69), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Compressed with glTF-Transform (meshopt geometry, WebP textures); no other changes.
- Aerial is not affiliated with, endorsed or sponsored by Psyonix LLC or Epic Games. Rocket League and Octane are trademarks of Psyonix LLC.
