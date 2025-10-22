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

function marketCircuitBreaker({ change1hPct = 0, change5mPct = 0, orderbookImbalance = 0, volatilitySpike = false, correlationBreakdown = false }) {
  if (Math.abs(change1hPct) > 8) return true;
  if (Math.abs(change5mPct) > 3.5) return true;
  if (Math.abs(orderbookImbalance) > 0.8) return true;
  if (volatilitySpike) return true;
  if (correlationBreakdown) return true;
  return false;
}

function calculateCorrelation(returns1, returns2) {
  if (returns1.length !== returns2.length || returns1.length < 2) return 0;
  
  const n = returns1.length;
  const sum1 = returns1.reduce((a, b) => a + b, 0);
  const sum2 = returns2.reduce((a, b) => a + b, 0);
  const sum1Sq = returns1.reduce((a, b) => a + b * b, 0);
  const sum2Sq = returns2.reduce((a, b) => a + b * b, 0);
  const pSum = returns1.reduce((acc, val, i) => acc + val * returns2[i], 0);
  
  const num = pSum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1Sq - sum1 * sum1 / n) * (sum2Sq - sum2 * sum2 / n));
  
  return den === 0 ? 0 : num / den;
}

function analyzePortfolioCorrelation(positions, priceHistory) {
  const symbols = Object.keys(positions);
  if (symbols.length < 2) return { avgCorrelation: 0, maxCorrelation: 0, riskConcentration: 0 };
  
  const correlations = [];
  
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const sym1 = symbols[i];
      const sym2 = symbols[j];
      
      const returns1 = priceHistory[sym1] || [];
      const returns2 = priceHistory[sym2] || [];
      
      if (returns1.length >= 10 && returns2.length >= 10) {
        const corr = calculateCorrelation(returns1.slice(-20), returns2.slice(-20));
        correlations.push(Math.abs(corr));
      }
    }
  }
  
  const avgCorrelation = correlations.length > 0 ? correlations.reduce((a, b) => a + b, 0) / correlations.length : 0;
  const maxCorrelation = correlations.length > 0 ? Math.max(...correlations) : 0;
  
  // Risk concentration: sum of squared position weights
  const totalValue = Object.values(positions).reduce((sum, pos) => sum + Math.abs(pos.notionalValue || 0), 0);
  const weights = Object.values(positions).map(pos => Math.abs(pos.notionalValue || 0) / totalValue);
  const riskConcentration = weights.reduce((sum, w) => sum + w * w, 0);
  
  return { avgCorrelation, maxCorrelation, riskConcentration };
}

function advancedRiskCheck({ positions, priceHistory, currentDrawdown, volatilityMetrics }) {
  const correlation = analyzePortfolioCorrelation(positions, priceHistory);
  
  // Circuit breaker conditions
  const correlationBreakdown = correlation.maxCorrelation > 0.8; // High correlation risk
  const concentrationRisk = correlation.riskConcentration > 0.6; // Too concentrated
  const volatilitySpike = (volatilityMetrics?.currentVol || 0) > (volatilityMetrics?.avgVol || 0) * 2;
  const drawdownLimit = currentDrawdown > 0.08; // 8% drawdown limit
  
  return {
    correlation,
    riskFlags: {
      correlationBreakdown,
      concentrationRisk,
      volatilitySpike,
      drawdownLimit
    },
    shouldHalt: correlationBreakdown || concentrationRisk || volatilitySpike || drawdownLimit
  };
}

module.exports = {
  capOrderSizeUsd,
  shouldHaltTrading,
  computeStops,
  detectRegime,
  kellyFraction,
  positionSizeUsd,
  marketCircuitBreaker,
  advancedRiskCheck,
  analyzePortfolioCorrelation
};
