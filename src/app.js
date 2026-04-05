'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();

app.use(express.json());

const isTest = process.env.NODE_ENV === 'test';

// Strict rate limit for auth endpoints (prevent brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => isTest,
});

// General rate limit for all API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => isTest,
});

// Health check (no rate limit needed)
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'PremierTaxiTracker' }));

// Apply rate limits
app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', apiLimiter);

// API v1 routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/vehicles', require('./routes/vehicles'));
app.use('/api/v1/drivers', require('./routes/drivers'));
app.use('/api/v1/locations', require('./routes/locations'));
app.use('/api/v1/alerts', require('./routes/alerts'));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Central error handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
