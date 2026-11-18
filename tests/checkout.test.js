// Run: node --test tests
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../pricing.js');
const { buildOrder, OrderError } = require('../api/_lib/order.js');

const ok = { email: 'player@example.com', epic: 'Player One', consent: true, method: 'stripe' };
const boost = (o = {}) => ({ ...ok, order: { kind: 'boost', from: 10, to: 14, playlist: '2v2', extras: [], ...o } });

test('prices match the page: Platino II → Diamante III in 2v2 is 14,40 €', () => {
  assert.equal(buildOrder(boost()).cents, 1440);
});

test('market anchors: Diamante I → Campione I 16 €, Campione I → GC I 28 €, GC I → SSL 90 €', () => {
  assert.equal(buildOrder(boost({ from: 12, to: 15 })).cents, 1600);
  assert.equal(buildOrder(boost({ from: 15, to: 18 })).cents, 2800);
  assert.equal(buildOrder(boost({ from: 18, to: 21 })).cents, 9000);
});

test('6+ levels get 10% off, and from 100 € the charge is in whole euros like the display', () => {
  const q = P.boost({ from: 0, to: 21, playlist: '3v3', extras: [] });
  assert.ok(q.bundle);
  assert.equal(q.cents % 100, 0);
  assert.equal(buildOrder(boost({ from: 0, to: 21, playlist: '3v3' })).cents, q.cents);
});

test('extras add up and are named', () => {
  const o = buildOrder(boost({ extras: ['duo', 'prio', 'duo'] }));
  assert.equal(o.cents, P.toCents(14.4 * 1.55));
  assert.match(o.name, /Gioca con il booster, Priorità/);
});

test('coaching plans use the table price', () => {
  assert.equal(buildOrder({ ...ok, order: { kind: 'coaching', plan: 'five' } }).cents, 8500);
});

test('rejects tampered or bad input', () => {
  const bad = [
    { ...ok, email: 'nope', order: boost().order },
    { ...ok, epic: 'a', order: boost().order },
    { ...ok, consent: 'yes', order: boost().order },
    { ...ok, method: 'crypto', order: boost().order },
    boost({ from: 14, to: 10 }),
    boost({ from: -1 }),
    boost({ to: 22 }),
    boost({ from: 1.5 }),
    boost({ playlist: '__proto__' }),
    boost({ playlist: 'toString' }),
    boost({ extras: ['free'] }),
    { ...ok, order: { kind: 'coaching', plan: 'constructor' } },
    { ...ok, order: { kind: 'gift' } },
    null,
  ];
  for (const b of bad) assert.throws(() => buildOrder(b), OrderError, JSON.stringify(b));
});

// ---------- handlers, with fetch mocked ----------
function mockRes() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b = '') { this.body = b; } };
}
const req = (body, extra = {}) => ({ method: 'POST', headers: { host: 'aerial.test' }, body, ...extra });

test('checkout → Stripe session with a manual-capture hold for the server-side amount', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_x';
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/x' }) }; };
  const res = mockRes();
  await require('../api/checkout.js')(req({ ...boost(), order: { ...boost().order, price: 1 } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).url, 'https://checkout.stripe.com/c/pay/x');
  const form = new URLSearchParams(calls[0].init.body.toString());
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '1440');   // the client's "price" is ignored
  assert.equal(form.get('payment_intent_data[capture_method]'), 'manual');
  assert.equal(form.get('customer_email'), 'player@example.com');
});

test('checkout → PayPal order with intent AUTHORIZE', async () => {
  process.env.PAYPAL_CLIENT_ID = 'id'; process.env.PAYPAL_CLIENT_SECRET = 'secret'; delete process.env.PAYPAL_ENV;
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 'tok' }) };
    return { ok: true, json: async () => ({ links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ABC' }] }) };
  };
  const res = mockRes();
  await require('../api/checkout.js')(req({ ...boost(), method: 'paypal' }), res);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.intent, 'AUTHORIZE');
  assert.equal(body.purchase_units[0].amount.value, '14.40');
  assert.match(calls[1].url, /api-m\.sandbox\.paypal\.com/);
});

test('checkout answers 400 with a readable message on bad input, 405 on GET', async () => {
  let res = mockRes();
  await require('../api/checkout.js')(req({ ...boost(), email: 'x' }), res);
  assert.equal(res.statusCode, 400);
  assert.match(JSON.parse(res.body).error, /email/);
  res = mockRes();
  await require('../api/checkout.js')({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('Stripe webhook signature check', () => {
  const { verify } = require('../api/stripe-webhook.js');
  const raw = '{"type":"x"}', t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_1').update(`${t}.${raw}`).digest('hex');
  assert.ok(verify(raw, `t=${t},v1=${sig}`, 'whsec_1'));
  assert.ok(!verify(raw, `t=${t},v1=${sig}`, 'whsec_2'));
  assert.ok(!verify(raw + ' ', `t=${t},v1=${sig}`, 'whsec_1'));
  assert.ok(!verify(raw, `t=${t - 3600},v1=${sig}`, 'whsec_1'));
});
