'use strict';

const { decideTrade } = require('../ai/decision_engine');
const logger = require('./logger');

class TradingSimulator {
  constructor(options = {}) {
    this.initialBalance = options.initialBalance || 10000;
    this.balance = this.initialBalance;
    this.positions = {};
    this.trades = [];
    this.equity = this.initialBalance;
    this.peakEquity = this.initialBalance;
    this.maxDrawdown = 0;
    this.fees = options.fees || 0.001; // 0.1% per trade
  }

  async backtest(historicalData, symbols, startDate, endDate) {
    const results = {
      trades: [],
      performance: {
        totalReturn: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        totalTrades: 0
      },
      equity: []
    };

    // Sort data by timestamp
    const sortedData = this.prepareHistoricalData(historicalData, symbols, startDate, endDate);
    
    for (let i = 0; i < sortedData.length; i++) {
      const dataPoint = sortedData[i];
      const { timestamp, symbol, candles } = dataPoint;
      
      try {
        // Simulate decision making
        const decision = await decideTrade({
          symbol,
          candles,
          positions: this.getPositionsForSymbol(symbol),
          events: { social: 50, onChain: 50, market: 50 }, // Neutral sentiment for backtest
          multiTf: { candles5m: candles, candles1h: candles, candles4h: candles }
        });

        // Execute simulated trade
        if (decision.action !== 'hold' && decision.sizeUsd > 0) {
          const trade = this.executeTrade(symbol, decision, candles[candles.length - 1], timestamp);
          if (trade) {
            results.trades.push(trade);
            this.updateEquity();
          }
        }

        // Record equity snapshot
        results.equity.push({
          timestamp,
          equity: this.equity,
          drawdown: (this.peakEquity - this.equity) / this.peakEquity
        });

      } catch (error) {
        logger.error('Backtest error', { symbol, timestamp, error: error.message });
      }
    }

    // Calculate final performance metrics
    results.performance = this.calculatePerformance();
    
    return results;
  }

  prepareHistoricalData(historicalData, symbols, startDate, endDate) {
    const data = [];
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    symbols.forEach(symbol => {
      const symbolData = historicalData[symbol] || [];
      symbolData.forEach(candle => {
        const timestamp = new Date(candle.openTime).getTime();
        if (timestamp >= start && timestamp <= end) {
          data.push({
            timestamp,
            symbol,
            candles: [candle] // Simplified for simulation
          });
        }
      });
    });

    return data.sort((a, b) => a.timestamp - b.timestamp);
  }

  executeTrade(symbol, decision, currentCandle, timestamp) {
    const price = parseFloat(currentCandle.close);
    const quantity = decision.sizeUsd / price;
    const side = decision.action.toLowerCase();
    
    // Calculate fees
    const feeAmount = decision.sizeUsd * this.fees;
    
    if (side === 'buy') {
      if (this.balance < decision.sizeUsd + feeAmount) {
        return null; // Insufficient balance
      }
      
      this.balance -= (decision.sizeUsd + feeAmount);
      this.positions[symbol] = (this.positions[symbol] || 0) + quantity;
      
    } else if (side === 'sell') {
      const currentPosition = this.positions[symbol] || 0;
      if (currentPosition <= 0) {
        return null; // No position to sell
      }
      
      const sellQuantity = Math.min(quantity, currentPosition);
      const sellValue = sellQuantity * price;
      
      this.balance += (sellValue - feeAmount);
      this.positions[symbol] = currentPosition - sellQuantity;
      
      if (this.positions[symbol] <= 0) {
        delete this.positions[symbol];
      }
    }

    const trade = {
      id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      symbol,
      side: side.toUpperCase(),
      quantity,
      price,
      value: decision.sizeUsd,
      fee: feeAmount,
      confidence: decision.confidence,
      rationale: decision.rationale
    };

    this.trades.push(trade);
    return trade;
  }

  updateEquity() {
    // For simulation, we'll use a simplified equity calculation
    // In reality, this would need current market prices for all positions
    this.equity = this.balance; // + value of all positions at current prices
    
    if (this.equity > this.peakEquity) {
      this.peakEquity = this.equity;
    }
    
    const currentDrawdown = (this.peakEquity - this.equity) / this.peakEquity;
    if (currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = currentDrawdown;
    }
  }

  getPositionsForSymbol(symbol) {
    return {
      [symbol]: {
        size: this.positions[symbol] || 0,
        notionalValue: (this.positions[symbol] || 0) * 100 // Simplified
      },
      equityUsd: this.equity
    };
  }

  calculatePerformance() {
    const totalReturn = (this.equity - this.initialBalance) / this.initialBalance;
    const winningTrades = this.trades.filter(t => t.pnl && t.pnl > 0).length;
    const winRate = this.trades.length > 0 ? winningTrades / this.trades.length : 0;
    
    // Calculate Sharpe ratio (simplified)
    const returns = this.trades.map(t => t.pnl || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const returnStd = this.calculateStandardDeviation(returns);
    const sharpeRatio = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(252) : 0;

    return {
      totalReturn,
      sharpeRatio,
      maxDrawdown: this.maxDrawdown,
      winRate,
      totalTrades: this.trades.length,
      finalEquity: this.equity,
      totalPnl: this.equity - this.initialBalance
    };
  }

  calculateStandardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  reset() {
    this.balance = this.initialBalance;
    this.positions = {};
    this.trades = [];
    this.equity = this.initialBalance;
    this.peakEquity = this.initialBalance;
    this.maxDrawdown = 0;
  }
}

module.exports = { TradingSimulator };
