'use strict';

const express = require('express');
const app = express();

app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'PremierTaxiTracker' }));

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
