'use strict';

const app = require('./app');
const { getDb } = require('./db/database');

const PORT = process.env.PORT || 3000;

// Ensure DB is initialised before accepting connections
getDb();

app.listen(PORT, () => {
  console.log(`PremierTaxiTracker API running on port ${PORT}`);
});
