/* Aerial pricing: the single source for the page (window.AerialPricing) and the payment API
   (require). The API recomputes every amount from here and never trusts a price from the browser. */
(function (root) {
  // € per level climbed INTO each rank (Platino I → II is one level; each level has 4 in-game
  // divisions). 2v2 piloted base; a list sets I, II, III separately.
  // Market, Nov 2026 (NeuralBoost, Boosting Games, BuyBoosting, PlayHub, GG Clan):
  //   Diamond I → Champion I $13.5–27, Champion I → GC I $28–42, GC I → SSL $80–105.
  // Pitched low but sustainable: at or just above the cheapest sellers, well under the median.
  const TIERS = [
    ['Bronzo', '#D9A178', '#9A5B33', 1], ['Argento', '#E9EDF3', '#9AA5B8', 1.2], ['Oro', '#FFD978', '#D7961A', 1.6],
    ['Platino', '#A8EEFF', '#3BA5CC', 2.4], ['Diamante', '#9DBBFF', '#3463E6', 4], ['Campione', '#D9B3FF', '#8048DE', 8],
    ['Gran Campione', '#FF9EB1', '#D42953', [12, 16, 26]],
  ];
  const RANKS = [];
  TIERS.forEach(([n, c1, c2, step], t) => ['I', 'II', 'III'].forEach((d, i) =>
    RANKS.push({ label: `${n} ${d}`, c1, c2, step: Array.isArray(step) ? step[i] : step, tier: t })));
  RANKS.push({ label: 'Leggenda Supersonica', c1: '#FFFFFF', c2: '#8E9BC4', step: 48, tier: 7 });

  const PLAYLISTS = { '1v1': 1.10, '2v2': 1, '3v3': 1.05 };
  const EXTRAS = {
    duo:    { x: 0.35, label: 'Gioca con il booster' },   // market +33–50%
    prio:   { x: 0.20, label: 'Priorità' },
    stream: { x: 0.10, label: 'Diretta' },
  };
  const BUNDLE = { from: 6, off: 0.10 };   // 10% off orders of 6+ levels
  const COACHING = {
    single: { label: 'Coaching: sessione singola', eur: 19 },
    five:   { label: 'Coaching: cinque sessioni', eur: 85 },
    season: { label: 'Coaching: stagione, primo mese', eur: 99 },
  };

  // What the page shows is what gets charged: under 100 € to the cent, from 100 € in whole euros.
  const toCents = eur => (eur >= 100 ? Math.round(eur) * 100 : Math.round(eur * 100));

  function boost({ from, to, playlist, extras = [] }) {
    let base = 0, hours = 0;
    for (let i = from; i < to; i++) {
      const r = RANKS[i + 1];
      base += r.step;
      hours += r.tier === 7 ? 16 : 1.2 + r.tier * 0.8;   // SSL is a long, slow climb
    }
    const extra = extras.reduce((sum, k) => sum + EXTRAS[k].x, 0);
    const levels = to - from, bundle = levels >= BUNDLE.from;
    const full = base * PLAYLISTS[playlist] * (1 + extra);
    const cents = toCents(full * (bundle ? 1 - BUNDLE.off : 1));
    return { full, cents, levels, bundle, hours };
  }

  const api = { TIERS, RANKS, PLAYLISTS, EXTRAS, BUNDLE, COACHING, toCents, boost };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AerialPricing = api;
})(typeof self !== 'undefined' ? self : this);
