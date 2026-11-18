// Stripe and PayPal over their REST APIs (no SDKs, no build step). Both only AUTHORIZE the
// payment: the amount is held on the buyer's card or PayPal and captured from the Stripe or
// PayPal dashboard once a booster or coach accepts the order ("pay only when a booster accepts").

const env = k => process.env[k] || '';

function siteUrl(req) {
  if (env('SITE_URL')) return env('SITE_URL').replace(/\/+$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `https://${host}`;
}

// ---------- Stripe ----------
async function stripeCheckout(order, site) {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Stripe non è configurato.');
  const form = new URLSearchParams({
    mode: 'payment',
    locale: 'it',
    customer_email: order.email,
    success_url: `${site}/grazie?pagamento=stripe&ordine={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/annullato`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(order.cents),
    'line_items[0][price_data][product_data][name]': order.name,
    'payment_intent_data[capture_method]': 'manual',   // hold now, charge when the order is accepted
    'payment_intent_data[description]': order.name,
    'payment_intent_data[metadata][epic]': order.epic,
    'metadata[epic]': order.epic,
    'metadata[order]': order.name,
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const d = await r.json();
  if (!r.ok || !d.url) throw new Error(`Stripe: ${(d.error && d.error.message) || r.status}`);
  return d.url;
}

// ---------- PayPal ----------
const paypalBase = () => (env('PAYPAL_ENV') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

async function paypalToken() {
  const id = env('PAYPAL_CLIENT_ID'), secret = env('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new Error('PayPal non è configurato.');
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error(`PayPal token: ${r.status}`);
  return d.access_token;
}

async function paypalCheckout(order, site) {
  const token = await paypalToken();
  const r = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'AUTHORIZE',   // hold now, capture when the order is accepted
      purchase_units: [{
        amount: { currency_code: 'EUR', value: (order.cents / 100).toFixed(2) },
        description: order.name.slice(0, 127),
        custom_id: `${order.epic} | ${order.email}`.slice(0, 127),
      }],
      payment_source: { paypal: { experience_context: {
        brand_name: 'Aerial', locale: 'it-IT', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW',
        return_url: `${site}/api/paypal-return`, cancel_url: `${site}/annullato`,
      } } },
    }),
  });
  const d = await r.json();
  const link = (d.links || []).find(l => l.rel === 'payer-action');
  if (!r.ok || !link) throw new Error(`PayPal: ${d.message || r.status}`);
  return link.href;
}

// After the buyer approves on PayPal: authorize the order (the hold), server side.
async function paypalAuthorize(orderId) {
  const token = await paypalToken();
  const r = await fetch(`${paypalBase()}/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const d = await r.json();
  if (!r.ok || d.status !== 'COMPLETED') throw new Error(`PayPal authorize: ${d.message || d.status || r.status}`);
  return d;
}

// ---------- order notifications (Discord or any webhook that takes { content }) ----------
async function notify(text) {
  console.log('[order]', text);
  const url = env('ORDER_WEBHOOK_URL');
  if (!url) return;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900) }) });
  } catch (e) { console.error('[order] notify failed', e); }
}

// ---------- tiny http helpers ----------
async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = typeof req.body === 'string' ? req.body : await readRaw(req);
  if (raw.length > 10000) throw new Error('too large');
  return JSON.parse(raw || '{}');
}
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

module.exports = { siteUrl, stripeCheckout, paypalCheckout, paypalAuthorize, notify, readRaw, readJson, send, redirect };
