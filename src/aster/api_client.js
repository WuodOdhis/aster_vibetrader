'use strict';

const axios = require('axios');
const Bottleneck = require('bottleneck');
const { aster, rateLimit } = require('../../config/trading_config');
const crypto = require('crypto');

class AsterApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || aster.baseUrl;
    this.apiKey = options.apiKey || aster.apiKey;
    this.apiSecret = options.apiSecret || process.env.ASTER_API_SECRET || '';
    this.authHeader = options.authHeader || aster.authHeader;
    this.authScheme = options.authScheme || aster.authScheme;
    this.vendor = options.vendor || process.env.ASTER_VENDOR || (this.baseUrl.includes('fapi.') ? 'binance' : 'aster');

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeoutMs || 10000
    });

    this.limiter = new Bottleneck({
      minTime: Math.ceil(1000 / (options.maxRequestsPerSecond || rateLimit.maxRequestsPerSecond)),
      maxConcurrent: options.maxConcurrent || rateLimit.maxConcurrent,
      reservoir: options.reservoir ?? rateLimit.reservoir,
      reservoirRefreshAmount: options.reservoirRefreshAmount ?? rateLimit.reservoirRefreshAmount,
      reservoirRefreshInterval: options.reservoirRefreshIntervalMs ?? rateLimit.reservoirRefreshIntervalMs
    });

    this.http.interceptors.request.use((config) => {
      if (this.vendor === 'binance') {
        if (!config.headers) config.headers = {};
        config.headers['X-MBX-APIKEY'] = this.apiKey;
        return config;
      } else {
        if (this.apiKey) {
          const headerName = this.authHeader || 'Authorization';
          const scheme = this.authScheme ? `${this.authScheme} ` : '';
          config.headers[headerName] = `${scheme}${this.apiKey}`;
        }
        return config;
      }
    });

    this.http.interceptors.response.use(
      (res) => res,
      async (error) => {
        const status = error.response?.status;
        if (status >= 500 || status === 429) {
          const config = error.config || {};
          config._retryCount = (config._retryCount || 0) + 1;
          if (config._retryCount <= (options.maxRetries || 3)) {
            const waitMs = Math.min(2000 * config._retryCount, 8000);
            await new Promise((r) => setTimeout(r, waitMs));
            return this.http(config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async request(config) {
    return this.limiter.schedule(() => this.http.request(config)).then((r) => r.data);
  }

  async requestSigned(method, path, params = {}) {
    if (this.vendor !== 'binance') {
      return this.request({ method, url: path, params });
    }
    const timestamp = Date.now();
    const payload = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: String(params.recvWindow || 5000) });
    const queryString = payload.toString();
    const signature = crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
    const url = `${path}?${queryString}&signature=${signature}`;
    return this.request({ method, url });
  }

  // Market data
  getTicker(symbol) {
    if (this.vendor === 'binance') {
      const s = this._mapSymbol(symbol);
      return this.request({ method: 'GET', url: `/fapi/v1/ticker/price`, params: { symbol: s } });
    }
    return this.request({ method: 'GET', url: `/v1/market/ticker`, params: { symbol } });
  }

  getOrderBook(symbol, depth = 50) {
    if (this.vendor === 'binance') {
      const s = this._mapSymbol(symbol);
      return this.request({ method: 'GET', url: `/fapi/v1/depth`, params: { symbol: s, limit: depth } });
    }
    return this.request({ method: 'GET', url: `/v1/market/orderbook`, params: { symbol, depth } });
  }

  async getCandles(symbol, interval = '1m', limit = 200) {
    if (this.vendor === 'binance') {
      const s = this._mapSymbol(symbol);
      const data = await this.request({ method: 'GET', url: `/fapi/v1/klines`, params: { symbol: s, interval, limit } });
      // Map to {open, high, low, close, volume}
      return (data || []).map((k) => ({
        openTime: k[0], open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]), closeTime: k[6]
      }));
    }
    return this.request({ method: 'GET', url: `/v1/market/candles`, params: { symbol, interval, limit } });
  }

  async getExchangeInfo() {
    if (this.vendor === 'binance') {
      return this.request({ method: 'GET', url: `/fapi/v1/exchangeInfo` });
    }
    return {};
  }

  async getSymbolFilters(symbol) {
    if (this.vendor !== 'binance') return {};
    const info = await this.getExchangeInfo();
    const s = this._mapSymbol(symbol);
    const sym = (info.symbols || []).find((x) => x.symbol === s);
    if (!sym) return {};
    const map = {};
    for (const f of sym.filters || []) map[f.filterType] = f;
    return map;
  }

  // Orders
  placeOrder(order) {
    if (this.vendor === 'binance') {
      // Expected order: { symbol:'BTC-USD', side:'BUY'|'SELL', type:'MARKET'|'LIMIT', quantity, price?, reduceOnly? }
      const s = this._mapSymbol(order.symbol);
      const side = order.side?.toUpperCase();
      const type = (order.type || 'MARKET').toUpperCase();
      const params = { symbol: s, side, type };
      if (type === 'MARKET') {
        params.quantity = order.quantity;
      } else if (type === 'LIMIT') {
        params.timeInForce = order.timeInForce || 'GTC';
        params.price = order.price;
        params.quantity = order.quantity;
      }
      if (order.reduceOnly != null) params.reduceOnly = Boolean(order.reduceOnly);
      if (order.positionSide) params.positionSide = String(order.positionSide).toUpperCase(); // LONG|SHORT|BOTH
      if (order.newClientOrderId) params.newClientOrderId = order.newClientOrderId;
      return this.requestSigned('POST', '/fapi/v1/order', params);
    }
    return this.request({ method: 'POST', url: `/v1/orders`, data: order });
  }

  cancelOrder(orderId) {
    if (this.vendor === 'binance') {
      return this.requestSigned('DELETE', '/fapi/v1/order', { orderId });
    }
    return this.request({ method: 'DELETE', url: `/v1/orders/${orderId}` });
  }

  getOrder(orderId) {
    if (this.vendor === 'binance') {
      return this.requestSigned('GET', '/fapi/v1/order', { orderId });
    }
    return this.request({ method: 'GET', url: `/v1/orders/${orderId}` });
  }

  listOpenOrders(params = {}) {
    return this.request({ method: 'GET', url: `/v1/orders`, params });
  }

  // Portfolio
  getBalances() {
    if (this.vendor === 'binance') return {};
    return this.request({ method: 'GET', url: `/v1/account/balances` });
  }

  getPositions() {
    if (this.vendor === 'binance') return {};
    return this.request({ method: 'GET', url: `/v1/account/positions` });
  }

  getAccount() {
    return this.request({ method: 'GET', url: `/v1/account` });
  }

  _mapSymbol(symbol) {
    if (!symbol) return symbol;
    const s = String(symbol).toUpperCase();
    if (s.includes('-')) {
      const [base, quote] = s.split('-');
      if (quote === 'USD') return `${base}USDT`;
      return `${base}${quote}`;
    }
    return s;
  }
}

module.exports = { AsterApiClient };
