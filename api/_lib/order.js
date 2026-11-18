// Validates a checkout request from the browser and prices it on the server.
// Everything here is untrusted input: only known keys, bounded strings, prices from pricing.js.
const P = require('../../pricing.js');

const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);

class OrderError extends Error {}
const fail = msg => { throw new OrderError(msg); };

function buildOrder(body) {
  if (!body || typeof body !== 'object') fail('Richiesta non valida.');

  const email = String(body.email || '').trim();
  if (email.length > 254 || !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail('Inserisci un’email valida.');

  const epic = String(body.epic || '').trim();
  if (!/^[\p{L}\p{N} ._-]{3,32}$/u.test(epic)) fail('Inserisci il tuo nome Epic Games (3–32 caratteri).');

  if (body.consent !== true) fail('Conferma di avere 18 anni o il consenso di un genitore.');

  const method = body.method;
  if (method !== 'stripe' && method !== 'paypal') fail('Metodo di pagamento non valido.');

  const o = body.order || {};
  let cents, name;
  if (o.kind === 'boost') {
    const { from, to, playlist } = o;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > P.RANKS.length - 1 || from >= to) fail('Ranghi non validi.');
    if (!has(P.PLAYLISTS, playlist)) fail('Playlist non valida.');
    const extras = Array.isArray(o.extras) ? [...new Set(o.extras)] : [];
    if (extras.some(k => !has(P.EXTRAS, k))) fail('Extra non validi.');
    cents = P.boost({ from, to, playlist, extras }).cents;
    name = `Boost ${P.RANKS[from].label} → ${P.RANKS[to].label}, ${playlist}`
      + (extras.length ? ` (${extras.map(k => P.EXTRAS[k].label).join(', ')})` : '');
  } else if (o.kind === 'coaching') {
    if (!has(P.COACHING, o.plan)) fail('Piano non valido.');
    cents = P.toCents(P.COACHING[o.plan].eur);
    name = P.COACHING[o.plan].label;
  } else {
    fail('Ordine non valido.');
  }
  if (!(cents >= 50)) fail('Importo non valido.');   // Stripe's minimum charge in EUR

  return { email, epic, method, cents, name };
}

module.exports = { buildOrder, OrderError };
