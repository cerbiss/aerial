// GET /api/paypal-return?token=<order id> — PayPal sends the buyer here after approval.
// Authorize (hold) the payment server side, then show the thank-you page.
const { siteUrl, paypalAuthorize, notify, redirect } = require('./_lib/pay.js');

module.exports = async (req, res) => {
  const site = siteUrl(req);
  const id = new URL(req.url, site).searchParams.get('token') || '';
  if (!/^[A-Z0-9]{8,40}$/.test(id)) return redirect(res, `${site}/annullato?errore=1`);
  try {
    const d = await paypalAuthorize(id);
    const unit = (d.purchase_units || [])[0] || {};
    const auth = (((unit.payments || {}).authorizations) || [])[0] || {};
    await notify(`Nuovo ordine (PayPal, da catturare): ${unit.description || '?'} · ${(auth.amount || {}).value || '?'} € · ${unit.custom_id || ''} · ordine ${id}`);
    return redirect(res, `${site}/grazie?pagamento=paypal`);
  } catch (e) {
    console.error('[paypal-return]', e);
    return redirect(res, `${site}/annullato?errore=1`);
  }
};
