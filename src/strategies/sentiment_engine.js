'use strict';

// Inputs are expected from upstream collectors; here we fuse them.
// social: { twitterScore:-1..1, telegramScore:-1..1, trendsScore:-1..1, newsScore:-1..1 }
// onchain: { whaleInflowUsd, whaleOutflowUsd, exchangeNetflow: -1..1, gasPriceGwei, activeAddrsDelta:-1..1 }
// market: { supports:[price], resistances:[price], liquidationClusters:[{price, size}], orderbook:{ bidDepth, askDepth, imbalance:-1..1 } }

function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

function scoreSocial(social = {}) {
  const { twitterScore = 0, telegramScore = 0, trendsScore = 0, newsScore = 0 } = social;
  const weighted = 0.35 * twitterScore + 0.2 * telegramScore + 0.25 * newsScore + 0.2 * trendsScore;
  return clamp(Math.round((weighted * 50) + 50), 0, 100); // map -1..1 to 0..100
}

function scoreOnChain(onchain = {}) {
  const { whaleInflowUsd = 0, whaleOutflowUsd = 0, exchangeNetflow = 0, gasPriceGwei = 0, activeAddrsDelta = 0 } = onchain;
  const whaleNetUsd = whaleInflowUsd - whaleOutflowUsd; // positive => accumulation
  const whaleTerm = Math.tanh(whaleNetUsd / 1_000_000); // scale big flows
  const flowTerm = clamp(exchangeNetflow, -1, 1); // -1 outflows bullish, +1 inflows bearish
  const gasTerm = Math.tanh((gasPriceGwei - 20) / 50); // elevated gas may mean activity
  const addrTerm = clamp(activeAddrsDelta, -1, 1);
  const weighted = 0.45 * whaleTerm - 0.25 * flowTerm + 0.15 * gasTerm + 0.15 * addrTerm;
  return clamp(Math.round((weighted * 50) + 50), 0, 100);
}

function scoreMarketStructure(market = {}, lastPrice) {
  const { supports = [], resistances = [], liquidationClusters = [], orderbook = {} } = market;
  const { imbalance = 0, bidDepth = 0, askDepth = 0 } = orderbook;
  let clusterBias = 0;
  if (liquidationClusters.length && lastPrice) {
    const nearest = liquidationClusters.reduce((best, c) => {
      const d = Math.abs(c.price - lastPrice);
      if (!best || d < best.d) return { d, side: c.price > lastPrice ? 'above' : 'below', size: c.size };
      return best;
    }, null);
    if (nearest) clusterBias = Math.tanh((nearest.side === 'above' ? -nearest.size : nearest.size) / 1_000_000);
  }
  const depthBias = Math.tanh(((bidDepth - askDepth) / Math.max(1, bidDepth + askDepth)) * 3) + clamp(imbalance, -1, 1) * 0.5;
  // proximity to support/resistance
  let srBias = 0;
  if (lastPrice && (supports.length || resistances.length)) {
    const closestSupport = supports.reduce((p, s) => Math.min(p, Math.abs(s - lastPrice)), Infinity);
    const closestResistance = resistances.reduce((p, r) => Math.min(p, Math.abs(r - lastPrice)), Infinity);
    const nearS = closestSupport / lastPrice; // lower better
    const nearR = closestResistance / lastPrice;
    srBias = Math.tanh((nearR - nearS) * 5); // nearer to support => bullish, to resistance => bearish
  }
  const weighted = 0.5 * depthBias + 0.5 * srBias + 0.3 * clusterBias;
  return clamp(Math.round((weighted * 50) + 50), 0, 100);
}

function fuseSentiment({ social, onchain, market, lastPrice }) {
  const socialScore = scoreSocial(social);
  const onchainScore = scoreOnChain(onchain);
  const structureScore = scoreMarketStructure(market, lastPrice);
  const score = Math.round(0.45 * socialScore + 0.35 * onchainScore + 0.2 * structureScore);
  const label = score > 60 ? 'bullish' : score < 40 ? 'bearish' : 'neutral';
  return {
    score,
    label,
    breakdown: { socialScore, onchainScore, structureScore }
  };
}

async function collectSocial() {
  // placeholders: wire actual APIs later
  return { twitterScore: 0, telegramScore: 0, trendsScore: 0, newsScore: 0 };
}

async function collectOnChain() {
  return { whaleInflowUsd: 0, whaleOutflowUsd: 0, exchangeNetflow: 0, gasPriceGwei: 0, activeAddrsDelta: 0 };
}

async function collectMarketStructure() {
  return { supports: [], resistances: [], liquidationClusters: [], orderbook: { bidDepth: 0, askDepth: 0, imbalance: 0 } };
}

module.exports = { fuseSentiment, collectSocial, collectOnChain, collectMarketStructure };
