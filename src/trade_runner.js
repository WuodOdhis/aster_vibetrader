'use strict';

require('dotenv').config();
const { AsterApiClient } = require('./aster/api_client');
const { AsterWebSocket } = require('./aster/websocket_handler');
const { decideTrade } = require('./ai/decision_engine');
const { trading } = require('../config/trading_config');
const logger = require('./utils/logger');

async function main() {
  const api = new AsterApiClient();
  const ws = new AsterWebSocket();

  const candles5m = new Map();
  const candles1h = new Map();
  const candles4h = new Map();

  let pollingStarted = false;

  async function decideForSymbol(symbol) {
    try {
      const [c5, c1, c4] = await Promise.all([
        api.getCandles(symbol, '5m', 120),
        api.getCandles(symbol, '1h', 240),
        api.getCandles(symbol, '4h', 240)
      ]);
      candles5m.set(symbol, c5);
      candles1h.set(symbol, c1);
      candles4h.set(symbol, c4);
      const positions = await getAccountPositions(api);
      const events = await collectSignals();
      const decision = await decideTrade({ symbol, candles: c1, positions, events, multiTf: { candles5m: c5, candles1h: c1, candles4h: c4 } });
      
      // Log decision with full transparency
      const loggedDecision = logger.logDecision(decision);
      
      // Emit to dashboard if available
      try {
        const { io } = require('./dashboard/server');
        io.emit('new-decision', loggedDecision);
      } catch (e) {
        // Dashboard not running, continue
      }

      const DRY_RUN = String(process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
      if (!DRY_RUN && (decision.action === 'buy' || decision.action === 'sell') && decision.sizeUsd > 0) {
        const qty = await estimateQuantity(api, symbol, decision.sizeUsd, c1);
        if (qty > 0) {
          const side = decision.action.toUpperCase();
          const order = { symbol, side, type: 'MARKET', quantity: qty };
          try {
            const res = await api.placeOrder(order);
            
            // Log successful trade
            const trade = {
              symbol,
              side: decision.action.toUpperCase(),
              quantity: qty,
              price: c1[c1.length - 1]?.close || 0,
              orderId: res.orderId || res.id,
              status: 'filled',
              equity: positions.equityUsd || 0
            };
            
            const loggedTrade = logger.logTrade(trade);
            
            // Emit to dashboard
            try {
              const { io } = require('./dashboard/server');
              io.emit('new-trade', loggedTrade);
              io.emit('performance-update', logger.getPerformanceMetrics());
            } catch (e) {
              // Dashboard not running, continue
            }
            
            logger.info('Order placed successfully', { orderId: res.orderId || res.id, symbol, qty });
          } catch (e) {
            logger.error('Order failed', { 
              symbol, 
              error: e?.response?.data || e.message,
              order 
            });
          }
        }
      }
    } catch (e) {
      logger.error('Decision loop error', { symbol, error: e.message, stack: e.stack });
    }
  }

  function startPolling() {
    if (pollingStarted) return;
    pollingStarted = true;
    // eslint-disable-next-line no-console
    console.log('Starting REST polling fallback');
    for (const symbol of trading.symbols) {
      decideForSymbol(symbol);
      setInterval(() => decideForSymbol(symbol), 10000);
    }
  }

  ws.on('open', () => {
    for (const symbol of trading.symbols) {
      ws.subscribe('ticker', { symbol });
      ws.subscribe('orderbook', { symbol, depth: 10 });
    }
  });

  ws.on('message', async (msg) => {
    if (msg.channel === 'ticker' && msg.data?.symbol) {
      const { symbol } = msg.data;
      decideForSymbol(symbol);
    }
  });

  ws.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('WebSocket error:', err?.message || err);
    startPolling();
  });

  ws.on('close', () => {
    startPolling();
  });

  ws.connect();
}
async function getAccountPositions(api) {
  try {
    if (process.env.ASTER_VENDOR === 'binance') {
      // Try futures account balance endpoint
      const account = await api.requestSigned('GET', '/fapi/v2/balance');
      // balance returns [{asset, balance, crossWalletBalance, ...}]
      const usdt = Array.isArray(account) ? account.find((b) => b.asset === 'USDT') : null;
      const equityUsd = usdt ? Number(usdt.balance || usdt.crossWalletBalance || 0) : 0;
      return { equityUsd, raw: account };
    }
    return await api.getPositions();
  } catch (_) {
    return { equityUsd: 10000 };
  }
}

async function collectSignals() {
  try {
    const { collectSocial, collectOnChain, collectMarketStructure } = require('./strategies/sentiment_engine');
    const [social, onchain, market] = await Promise.all([
      collectSocial(),
      collectOnChain(),
      collectMarketStructure()
    ]);
    return { social, onchain, market };
  } catch (_) {
    return { social: {}, onchain: {}, market: {} };
  }
}

async function estimateQuantity(api, symbol, sizeUsd, candles1h) {
  const last = candles1h?.[candles1h.length - 1]?.close;
  if (!last || !sizeUsd) return 0;
  const price = Number(last);
  let qty = sizeUsd / price;
  if (process.env.ASTER_VENDOR === 'binance') {
    try {
      const filters = await api.getSymbolFilters(symbol);
      const lot = filters.LOT_SIZE;
      if (lot) {
        const step = Number(lot.stepSize || 0.001);
        const minQty = Number(lot.minQty || 0);
        const maxQty = Number(lot.maxQty || Number.MAX_VALUE);
        qty = Math.max(minQty, Math.min(maxQty, Math.floor(qty / step) * step));
      }
      const minNotional = filters.MIN_NOTIONAL;
      if (minNotional) {
        const minN = Number(minNotional.notional || minNotional.minNotional || 0);
        if (qty * price < minN) qty = 0;
      }
    } catch (_) {
      // fallback rounding
      const s = String(symbol).toUpperCase();
      if (s.startsWith('BTC')) qty = Math.max(0, Number(qty.toFixed(3)));
      else if (s.startsWith('ETH')) qty = Math.max(0, Number(qty.toFixed(2)));
      else qty = Math.max(0, Number(qty.toFixed(4)));
    }
  } else {
    qty = Math.max(0, Number(qty.toFixed(6)));
  }
  return qty;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


