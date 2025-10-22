'use strict';

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;
    
    if (this.enableFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.decisions = [];
    this.trades = [];
    this.performance = {
      totalTrades: 0,
      winningTrades: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      peakEquity: 0
    };
  }

  _timestamp() {
    return new Date().toISOString();
  }

  _writeToFile(filename, data) {
    if (!this.enableFile) return;
    const filepath = path.join(this.logDir, filename);
    const logEntry = `${this._timestamp()} ${JSON.stringify(data)}\n`;
    fs.appendFileSync(filepath, logEntry);
  }

  _log(level, message, data = {}) {
    const logData = { level, message, ...data, timestamp: this._timestamp() };
    
    if (this.enableConsole) {
      const color = {
        ERROR: '\x1b[31m',
        WARN: '\x1b[33m',
        INFO: '\x1b[36m',
        DEBUG: '\x1b[37m'
      }[level] || '\x1b[0m';
      console.log(`${color}[${level}] ${message}\x1b[0m`, data.details ? data.details : '');
    }
    
    this._writeToFile('app.log', logData);
    return logData;
  }

  error(message, details) {
    return this._log('ERROR', message, { details });
  }

  warn(message, details) {
    return this._log('WARN', message, { details });
  }

  info(message, details) {
    return this._log('INFO', message, { details });
  }

  debug(message, details) {
    return this._log('DEBUG', message, { details });
  }

  logDecision(decision) {
    const entry = {
      ...decision,
      timestamp: this._timestamp(),
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.decisions.unshift(entry);
    if (this.decisions.length > 1000) this.decisions = this.decisions.slice(0, 1000);
    
    this._writeToFile('decisions.log', entry);
    this.info('AI Decision', { symbol: decision.symbol, action: decision.action, confidence: decision.confidence });
    
    return entry;
  }

  logTrade(trade) {
    const entry = {
      ...trade,
      timestamp: this._timestamp(),
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.trades.unshift(entry);
    if (this.trades.length > 1000) this.trades = this.trades.slice(0, 1000);
    
    // Update performance metrics
    this.performance.totalTrades++;
    if (trade.pnl > 0) this.performance.winningTrades++;
    this.performance.totalPnl += trade.pnl || 0;
    
    if (trade.equity) {
      if (trade.equity > this.performance.peakEquity) {
        this.performance.peakEquity = trade.equity;
      }
      const drawdown = (this.performance.peakEquity - trade.equity) / this.performance.peakEquity;
      if (drawdown > this.performance.maxDrawdown) {
        this.performance.maxDrawdown = drawdown;
      }
    }
    
    this._writeToFile('trades.log', entry);
    this.info('Trade Executed', { symbol: trade.symbol, side: trade.side, quantity: trade.quantity, pnl: trade.pnl });
    
    return entry;
  }

  getRecentDecisions(limit = 50) {
    return this.decisions.slice(0, limit);
  }

  getRecentTrades(limit = 50) {
    return this.trades.slice(0, limit);
  }

  getPerformanceMetrics() {
    return {
      ...this.performance,
      winRate: this.performance.totalTrades > 0 ? this.performance.winningTrades / this.performance.totalTrades : 0,
      avgPnl: this.performance.totalTrades > 0 ? this.performance.totalPnl / this.performance.totalTrades : 0
    };
  }
}

module.exports = new Logger();
