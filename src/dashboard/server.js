'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { server } = require('../../config/trading_config');
const { Server } = require('socket.io');
const http = require('http');
const logger = require('../utils/logger');

const app = express();
const server_instance = http.createServer(app);
const io = new Server(server_instance, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use('/api/', apiLimiter);

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// Static dashboard
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// API Routes
app.get('/api/decisions', (_req, res) => {
  const limit = parseInt(_req.query.limit) || 50;
  res.json(logger.getRecentDecisions(limit));
});

app.get('/api/trades', (_req, res) => {
  const limit = parseInt(_req.query.limit) || 50;
  res.json(logger.getRecentTrades(limit));
});

app.get('/api/performance', (_req, res) => {
  res.json(logger.getPerformanceMetrics());
});

app.get('/api/state', (_req, res) => {
  res.json({
    decisions: logger.getRecentDecisions(10),
    trades: logger.getRecentTrades(10),
    performance: logger.getPerformanceMetrics(),
    timestamp: new Date().toISOString()
  });
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info('Dashboard client connected', { socketId: socket.id });
  
  socket.emit('initial-data', {
    decisions: logger.getRecentDecisions(50),
    trades: logger.getRecentTrades(50),
    performance: logger.getPerformanceMetrics()
  });
  
  socket.on('disconnect', () => {
    logger.info('Dashboard client disconnected', { socketId: socket.id });
  });
});

const port = server.port;
server_instance.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard listening on http://localhost:${port}`);
});

// Export both app and io for use in other modules
module.exports = { app, io, logger };

