// POST /api/checkout → { url } of the Stripe or PayPal page where the buyer approves the payment.
const { buildOrder, OrderError } = require('./_lib/order.js');
const { siteUrl, stripeCheckout, paypalCheckout, readJson, send } = require('./_lib/pay.js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Metodo non consentito.' }); }
  let order;
  try {
    order = buildOrder(await readJson(req));
  } catch (e) {
    return send(res, 400, { error: e instanceof OrderError ? e.message : 'Richiesta non valida.' });
  }
  try {
    const site = siteUrl(req);
    const url = order.method === 'stripe' ? await stripeCheckout(order, site) : await paypalCheckout(order, site);
    return send(res, 200, { url });
  } catch (e) {
    console.error('[checkout]', e);
    return send(res, 503, { error: 'Il pagamento non è disponibile in questo momento. Riprova tra poco o scegli l’altro metodo.' });
  }
};
