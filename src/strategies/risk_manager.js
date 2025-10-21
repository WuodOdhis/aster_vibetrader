'use strict';

const { trading } = require('../../config/trading_config');

function capOrderSizeUsd(desiredUsd) {
  const max = trading.risk.maxPositionUsd;
  return Math.max(0, Math.min(desiredUsd, max));
}

function shouldHaltTrading({ realizedPnlTodayUsd, drawdownFromPeakPct = 0, circuitBreaker = false }) {
  if (circuitBreaker) return true;
  if (realizedPnlTodayUsd <= -Math.abs(trading.risk.maxDailyLossUsd)) return true;
  if (drawdownFromPeakPct >= 10) return true; // 10% from peak
  return false;
}

function computeStops(entryPrice, side, atrValue) {
  const slBps = trading.risk.stopLossBps;
  const tpBps = trading.risk.takeProfitBps;
  const bps = (p) => p / 10000;
  let stopLoss;
  let takeProfit;
  if (atrValue && entryPrice) {
    const multSL = 1.2; // dynamic cushion
    const multTP = 2.0;
    if (side === 'buy') {
      stopLoss = entryPrice - atrValue * multSL;
      takeProfit = entryPrice + atrValue * multTP;
    } else {
      stopLoss = entryPrice + atrValue * multSL;
      takeProfit = entryPrice - atrValue * multTP;
    }
  } else {
    if (side === 'buy') {
      stopLoss = entryPrice * (1 - bps(slBps));
      takeProfit = entryPrice * (1 + bps(tpBps));
    } else {
      stopLoss = entryPrice * (1 + bps(slBps));
      takeProfit = entryPrice * (1 - bps(tpBps));
    }
  }
  return { stopLoss, takeProfit };
}

function detectRegime({ atrPct, emaSlope, liquidityScore }) {
  const highVol = atrPct > 0.02; // >2% daily-like ATR on 1h proxy
  const trending = Math.abs(emaSlope) > 0.0005; // slope threshold
  const liquid = (liquidityScore ?? 0.5) > 0.5;
  return { highVol, trending, liquid };
}

function kellyFraction(winProb, winLossRatio) {
  // Kelly f* = p - (1-p)/R
  const p = Math.max(0, Math.min(1, winProb));
  const R = Math.max(0.01, winLossRatio);
  const f = p - (1 - p) / R;
  return Math.max(0, Math.min(0.25, f)); // cap at 25%
}

function positionSizeUsd({ accountEquityUsd, confidence, atrPct, maxRiskPctPerTrade = 0.02 }) {
  const volAdj = Math.max(0.25, 1 - (atrPct / 0.04)); // reduce size when vol high
  const kelly = kellyFraction(confidence, 1.5);
  const raw = accountEquityUsd * Math.min(maxRiskPctPerTrade, kelly) * 5; // notional multiplier
  return raw * volAdj;
}

function marketCircuitBreaker({ change1hPct = 0, change5mPct = 0, orderbookImbalance = 0 }) {
  if (Math.abs(change1hPct) > 8) return true;
  if (Math.abs(change5mPct) > 3.5) return true;
  if (Math.abs(orderbookImbalance) > 0.8) return true;
  return false;
}

module.exports = {
  capOrderSizeUsd,
  shouldHaltTrading,
  computeStops,
  detectRegime,
  kellyFraction,
  positionSizeUsd,
  marketCircuitBreaker
};
