// ─────────────────────────────────────────────────────────────
//  FINB Platimarkets — fully automatic, server-free price engine.
//  Prices are a deterministic function of (stock, day, tick). Every
//  player sees the same prices; nobody can set them by hand, and
//  there is nothing to cheat. Intraday ticks every 20 seconds,
//  one trading "session" per UTC day.
// ─────────────────────────────────────────────────────────────
// Per-tick (20s) values. 4320 ticks per day: daily stdev ≈ vol × √4320,
// so vol ~0.0008 gives a lively but believable ±4–6% daily range.
export const STOCKS = [
  { id: 'NEB',  name: 'Nebula Robotics',  base: 120, drift: 0.000022, vol: 0.00080, color: '#8ea7ff' },
  { id: 'PLX',  name: 'Platinum Xchange', base: 340, drift: 0.000016, vol: 0.00060, color: '#c8d6ff' },
  { id: 'QKR',  name: 'Quark Labs',       base: 85,  drift: 0.000026, vol: 0.00110, color: '#7ee0d8' },
  { id: 'ZPH',  name: 'Zephyr Mobility',  base: 210, drift: 0.000014, vol: 0.00085, color: '#a990ff' },
  { id: 'CRS',  name: 'Crisp Foods',      base: 42,  drift: 0.000010, vol: 0.00050, color: '#ffd488' },
  { id: 'LMR',  name: 'Lumora Energy',    base: 165, drift: 0.000018, vol: 0.00095, color: '#88e0a0' },
  { id: 'VYR',  name: 'Vyrus Arcade',     base: 64,  drift: 0.000030, vol: 0.00125, color: '#ff9ecb' },
  { id: 'ORB',  name: 'Orbit Telecom',    base: 98,  drift: 0.000012, vol: 0.00070, color: '#9fd0ff' },
];

export const TICK_MS = 20_000;
export const TICKS_PER_DAY = Math.floor((24 * 60 * 60 * 1000) / TICK_MS); // 4320

// Small deterministic PRNG (mulberry32), seeded per stock & per UTC day.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayKey(now = Date.now()) {
  return Math.floor(now / 86_400_000);
}

export function currentTick(now = Date.now()) {
  const dayStart = dayKey(now) * 86_400_000;
  return Math.min(TICKS_PER_DAY - 1, Math.floor((now - dayStart) / TICK_MS));
}

// Price of a stock at a given tick today. Uses a geometric random walk with
// gentle upward drift, so the market feels alive without ever collapsing to 0.
export function priceAt(stock, tick, now = Date.now()) {
  const seed = hashString(`${stock.id}-${dayKey(now)}`);
  const rnd = mulberry32(seed);
  let price = stock.base * (0.97 + 0.06 * mulberry32(seed ^ 0x9e3779b9)()); // daily open jitter
  for (let t = 0; t <= tick; t++) {
    const shock = (rnd() - 0.5) * 2 * stock.vol;
    const pull = Math.log(stock.base / price) * 0.004; // soft mean reversion
    price = Math.max(2, price * (1 + stock.drift + pull + shock));
  }
  return Math.round(price * 100) / 100;
}

export function currentPrices(now = Date.now()) {
  const tick = currentTick(now);
  const out = {};
  for (const s of STOCKS) out[s.id] = priceAt(s, tick, now);
  return { tick, prices: out };
}

// Sparkline series for charts (sampled for performance).
export function intradaySeries(stock, samples = 48, now = Date.now()) {
  const tick = currentTick(now);
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const t = Math.round((tick * i) / Math.max(1, samples - 1));
    pts.push(priceAt(stock, Math.min(t, tick), now));
  }
  return pts;
}

// Day change vs open (tick 0).
export function dayChange(stock, now = Date.now()) {
  const open = priceAt(stock, 0, now);
  const nowp = priceAt(stock, currentTick(now), now);
  return { open, now: nowp, pct: ((nowp - open) / open) * 100 };
}
