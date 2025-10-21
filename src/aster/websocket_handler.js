'use strict';

const WebSocket = require('ws');
const EventEmitter = require('events');
const { aster } = require('../../config/trading_config');

class AsterWebSocket extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || aster.wsUrl;
    this.apiKey = options.apiKey || aster.apiKey;
    this.authHeader = options.authHeader || aster.authHeader;
    this.authScheme = options.authScheme || aster.authScheme;
    this.vendor = options.vendor || process.env.ASTER_VENDOR || (this.url.includes('fstream.') ? 'binance' : 'aster');
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 15000;
    this.reconnectBaseMs = options.reconnectBaseMs || 1000;
    this.reconnectMaxMs = options.reconnectMaxMs || 15000;
    this._socket = null;
    this._heartbeat = null;
    this._shouldReconnect = true;
    this._backoff = this.reconnectBaseMs;
    this._subscriptions = new Set();
  }

  connect() {
    if (String(process.env.ENABLE_WS || 'true').toLowerCase() === 'false') {
      this.emit('close');
      return;
    }
    const headers = {};
    if (this.apiKey) {
      headers[this.authHeader] = `${this.authScheme} ${this.apiKey}`;
    }
    const socket = new WebSocket(this.url, { headers });
    this._socket = socket;

    socket.on('open', () => {
      this._backoff = this.reconnectBaseMs;
      this._startHeartbeat();
      this._resubscribe();
      this.emit('open');
    });

    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.emit('message', msg);
        if (msg.type === 'pong') {
          // Heartbeat acknowledgement
        } else if (msg.type === 'error') {
          this.emit('error', new Error(msg.error || 'WebSocket error'));
        } else if (msg.type) {
          this.emit(msg.type, msg);
        }
      } catch (e) {
        this.emit('error', e);
      }
    });

    socket.on('close', () => {
      this._stopHeartbeat();
      this.emit('close');
      if (this._shouldReconnect) {
        setTimeout(() => this.connect(), this._backoff);
        this._backoff = Math.min(this._backoff * 2, this.reconnectMaxMs);
      }
    });

    socket.on('error', (err) => {
      this.emit('error', err);
    });
  }

  disconnect() {
    this._shouldReconnect = false;
    this._stopHeartbeat();
    try {
      this._socket?.close();
    } catch (_) {}
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeat = setInterval(() => {
      this._send({ type: 'ping', ts: Date.now() });
    }, this.heartbeatIntervalMs);
  }

  _stopHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
  }

  _send(payload) {
    if (this._socket && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify(payload));
    }
  }

  subscribe(channel, params = {}) {
    if (this.vendor === 'binance') {
      // binance futures combined streams: e.g., btcusdt@ticker
      const sym = String((params.symbol || '')).toLowerCase().replace('-', '').replace('usd', 'usdt');
      let stream = '';
      if (channel === 'ticker') stream = `${sym}@ticker`;
      else if (channel === 'orderbook') stream = `${sym}@depth10@100ms`;
      this._subscriptions.add(JSON.stringify({ channel: 'stream', params: { stream } }));
      this._send({ method: 'SUBSCRIBE', params: [stream], id: Date.now() });
      return;
    }
    this._subscriptions.add(JSON.stringify({ channel, params }));
    this._send({ action: 'subscribe', channel, params });
  }

  unsubscribe(channel, params = {}) {
    if (this.vendor === 'binance') {
      const sym = String((params.symbol || '')).toLowerCase().replace('-', '').replace('usd', 'usdt');
      let stream = '';
      if (channel === 'ticker') stream = `${sym}@ticker`;
      else if (channel === 'orderbook') stream = `${sym}@depth10@100ms`;
      this._subscriptions.delete(JSON.stringify({ channel: 'stream', params: { stream } }));
      this._send({ method: 'UNSUBSCRIBE', params: [stream], id: Date.now() });
      return;
    }
    this._subscriptions.delete(JSON.stringify({ channel, params }));
    this._send({ action: 'unsubscribe', channel, params });
  }

  _resubscribe() {
    for (const s of this._subscriptions) {
      const { channel, params } = JSON.parse(s);
      if (this.vendor === 'binance' && channel === 'stream') {
        this._send({ method: 'SUBSCRIBE', params: [params.stream], id: Date.now() });
      } else {
        this._send({ action: 'subscribe', channel, params });
      }
    }
  }
}

module.exports = { AsterWebSocket };
