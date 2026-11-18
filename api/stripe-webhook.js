// POST /api/stripe-webhook — Stripe calls this when a Checkout session completes.
// The signature is checked against STRIPE_WEBHOOK_SECRET before anything is trusted.
const crypto = require('crypto');
const { readRaw, notify, send } = require('./_lib/pay.js');

function verify(raw, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const t = Number(parts.t), sig = parts.v1 || '';
  if (!t || !sig || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return send(res, 503, { error: 'not configured' });
  const raw = await readRaw(req);
  if (!verify(raw, req.headers['stripe-signature'], secret)) return send(res, 400, { error: 'bad signature' });

  const event = JSON.parse(raw);
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object, md = s.metadata || {};
    await notify(`Nuovo ordine (Stripe, da catturare): ${md.order || '?'} · ${(s.amount_total / 100).toFixed(2)} € · ${md.epic || ''} | ${s.customer_email || (s.customer_details || {}).email || ''} · ${s.id}`);
  }
  return send(res, 200, { received: true });
};

// Vercel/Next-style hint: keep the raw body for the signature check.
module.exports.config = { api: { bodyParser: false } };
module.exports.verify = verify;
