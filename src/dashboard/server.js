'use strict';

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { server } = require('../../config/trading_config');

const app = express();
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

// Minimal in-memory store (placeholder)
const state = {
  lastDecision: null,
  lastPrices: {}
};

app.get('/api/state', (_req, res) => res.json(state));

const port = server.port;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Dashboard listening on http://localhost:${port}`);
});

module.exports = app;
