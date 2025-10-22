'use strict';

require('dotenv').config();

const config = {
  aster: {
    baseUrl: process.env.ASTER_BASE_URL || 'https://api.aster.exchange',
    wsUrl: process.env.ASTER_WS_URL || 'wss://ws.aster.exchange/stream',
    apiKey: process.env.ASTER_API_KEY || '',
    authHeader: process.env.ASTER_AUTH_HEADER || 'Authorization',
    authScheme: process.env.ASTER_AUTH_SCHEME || 'Bearer'
  },
  trading: {
    symbols: (process.env.SYMBOLS || 'BTC-USD,ETH-USD').split(','),
    maxConcurrentOrders: Number(process.env.MAX_CONCURRENT_ORDERS || 3),
    baseOrderSizeUsd: Number(process.env.BASE_ORDER_SIZE_USD || 100),
    risk: {
      maxPositionUsd: Number(process.env.MAX_POSITION_USD || 5000),
      maxDailyLossUsd: Number(process.env.MAX_DAILY_LOSS_USD || 1000),
      stopLossBps: Number(process.env.STOP_LOSS_BPS || 100),
      takeProfitBps: Number(process.env.TAKE_PROFIT_BPS || 200)
    }
  },
  rateLimit: {
    maxRequestsPerSecond: Number(process.env.RATE_LIMIT_RPS || 5),
    maxConcurrent: Number(process.env.RATE_LIMIT_CONCURRENCY || 2),
    reservoir: Number(process.env.RATE_LIMIT_RESERVOIR || 50),
    reservoirRefreshAmount: Number(process.env.RATE_LIMIT_RESERVOIR_REFRESH_AMOUNT || 50),
    reservoirRefreshIntervalMs: Number(process.env.RATE_LIMIT_RESERVOIR_REFRESH_INTERVAL_MS || 10000)
  },
  server: {
    port: Number(process.env.PORT || 3000)
  }
};

module.exports = config;

