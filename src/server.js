const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { initSchema } = require('./db/schema');
const { seedInitialData } = require('./services/seeder');
const { getDbDialect, isPg } = require('./db/knex');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3999;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend assets
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback to index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Bootstrapping function
async function startServer() {
  try {
    console.log(`[BOOT] Roofing Dashboard starting in ${process.env.NODE_ENV || 'development'} mode...`);
    console.log(`[BOOT] Database dialect: ${getDbDialect().toUpperCase()}${isPg ? ' (PostgreSQL)' : ' (SQLite)'}`);
    
    // Auto-migrate schema
    await initSchema();

    // Auto-seed if database is currently empty
    await seedInitialData(false);

    app.listen(PORT, '0.0.0.0', () => {
      console.log('====================================================');
      console.log(` Roofing Reporting Dashboard is live!`);
      console.log(` Local URL:    http://localhost:${PORT}`);
      console.log(` Network / VM: http://0.0.0.0:${PORT}`);
      console.log(` Database:     ${getDbDialect().toUpperCase()}`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('[FATAL BOOT ERROR]', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, gracefully closing...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, gracefully closing...');
  process.exit(0);
});

startServer();
