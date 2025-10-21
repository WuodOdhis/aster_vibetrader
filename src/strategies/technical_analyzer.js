'use strict';

function ema(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaPrev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaPrev = values[i] * k + emaPrev * (1 - k);
  }
  return emaPrev;
}

function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change; else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return null;
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  if (fastEma == null || slowEma == null) return null;
  const macdValue = fastEma - slowEma;
  // Approx signal as EMA of tail by recalculating with macd history light approximation
  const macdSeries = [];
  let emaFast = null;
  let emaSlow = null;
  let macdPrev = 0;
  const k = 2 / (signal + 1);
  for (let i = Math.max(0, values.length - (slow + signal + 20)); i < values.length; i++) {
    const slice = values.slice(0, i + 1);
    emaFast = ema(slice, fast);
    emaSlow = ema(slice, slow);
    if (emaFast != null && emaSlow != null) {
      macdPrev = emaFast - emaSlow;
      macdSeries.push(macdPrev);
    }
  }
  let signalEma = macdSeries.length ? macdSeries[0] : macdValue;
  for (let i = 1; i < macdSeries.length; i++) signalEma = macdSeries[i] * k + signalEma * (1 - k);
  const histogram = macdValue - signalEma;
  return { macd: macdValue, signal: signalEma, histogram };
}

function bollinger(values, period = 20, mult = 2) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { middle: mean, upper: mean + mult * std, lower: mean - mult * std, std };
}

function atr(candles, period = 14) {
  if (!candles || candles.length < period + 1) return null;
  const trs = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1] || cur;
    const high = Number(cur.high ?? cur.h ?? cur[2] ?? cur.high);
    const low = Number(cur.low ?? cur.l ?? cur[3] ?? cur.low);
    const closePrev = Number(prev.close ?? prev.c ?? prev[4] ?? prev.close);
    const tr = Math.max(high - low, Math.abs(high - closePrev), Math.abs(low - closePrev));
    trs.push(tr);
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

function volumeProfile(candles, bins = 12) {
  if (!candles || !candles.length) return { nodes: [], poc: null };
  const prices = candles.map((c) => Number(c.close ?? c.c ?? c[4] ?? c.close));
  const vols = candles.map((c) => Number(c.volume ?? c.v ?? c[5] ?? 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const step = (max - min) / bins || 1;
  const nodes = new Array(bins).fill(0);
  for (let i = 0; i < prices.length; i++) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((prices[i] - min) / step)));
    nodes[idx] += vols[i] || 0;
  }
  const pocIdx = nodes.indexOf(Math.max(...nodes));
  const poc = min + pocIdx * step + step / 2;
  return { nodes, poc, range: { min, max } };
}

function normalize(x, a, b) {
  if (b === a) return 0;
  return Math.max(0, Math.min(1, (x - a) / (b - a)));
}

function analyzeMultiTimeframe({ candles5m, candles1h, candles4h }) {
  const toCloses = (cs) => (cs || []).map((c) => Number(c.close ?? c.c ?? c[4] ?? c));
  const closes5 = toCloses(candles5m || []);
  const closes1h = toCloses(candles1h || []);
  const closes4h = toCloses(candles4h || []);

  const rsi5 = rsi(closes5, 14);
  const rsi1 = rsi(closes1h, 14);
  const rsi4 = rsi(closes4h, 14);

  const macd1 = macd(closes1h);
  const macd4 = macd(closes4h);

  const bb5 = bollinger(closes5, 20, 2);
  const bb1 = bollinger(closes1h, 20, 2);

  const ema9 = ema(closes1h, 9);
  const ema21 = ema(closes1h, 21);
  const ema50 = ema(closes1h, 50);

  const atr1 = atr(candles1h || [], 14);
  const vp1 = volumeProfile(candles1h || [], 16);

  const last5 = closes5[closes5.length - 1];
  const last1 = closes1h[closes1h.length - 1];

  // Mean reversion on 5m
  let mrBias = 0; // -1 sell, +1 buy
  let mrReason = '';
  if (bb5 && last5 != null) {
    if (last5 > bb5.upper && rsi5 && rsi5 > 70) {
      mrBias = -1;
      mrReason = 'Price outside upper band with overbought RSI on 5m';
    } else if (last5 < bb5.lower && rsi5 && rsi5 < 30) {
      mrBias = 1;
      mrReason = 'Price outside lower band with oversold RSI on 5m';
    }
  }
  const reversionTarget = bb5 ? bb5.middle : last5;

  // Trend following on 1h/4h
  let trendBias = 0; // -1 sell, +1 buy
  let trendReason = '';
  if (ema9 != null && ema21 != null && ema50 != null) {
    if (ema9 > ema21 && ema21 > ema50 && (macd1?.histogram ?? 0) > 0) {
      trendBias = 1;
      trendReason = 'EMA 9>21>50 and positive MACD on 1h';
    } else if (ema9 < ema21 && ema21 < ema50 && (macd1?.histogram ?? 0) < 0) {
      trendBias = -1;
      trendReason = 'EMA 9<21<50 and negative MACD on 1h';
    }
  }

  // Combine biases with regime awareness via ATR
  const volNorm = normalize(atr1 || 0, 0, last1 ? last1 * 0.03 : 1); // 0..1 up to ~3% ATR
  const mrWeight = 0.45 * (1 - volNorm);
  const trendWeight = 0.55 * (0.5 + volNorm / 2);
  const bias = mrBias * mrWeight + trendBias * trendWeight;

  let action = 'HOLD';
  if (bias > 0.1) action = 'BUY';
  else if (bias < -0.1) action = 'SELL';

  const confidence = Math.min(0.99, Math.abs(bias));
  const size = Math.max(0.05, Math.min(0.5, 0.25 * (0.5 + volNorm / 2))); // 5% to 50% notional scale factor

  const rationale = [mrReason, trendReason].filter(Boolean).join(' | ');

  const signals = {
    action,
    confidence: Number(confidence.toFixed(2)),
    size: Number(size.toFixed(2)),
    rationale,
    context: {
      rsi: { '5m': rsi5, '1h': rsi1, '4h': rsi4 },
      macd: { '1h': macd1, '4h': macd4 },
      bb: { '5m': bb5, '1h': bb1 },
      ema: { '1h': { ema9, ema21, ema50 } },
      atr: { '1h': atr1 },
      volumeProfile1h: vp1,
      reversionTarget
    }
  };
  return signals;
}

module.exports = { analyzeMultiTimeframe };
