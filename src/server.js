import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import config from './config/config.js';
import { swaggerSpec } from './config/swagger.js';
import logger from './utils/logger.js';
import db from './database/database.js';
import broadcastScraper from './services/broadcast-scraper.js';
import scheduledTasks from './services/scheduled-tasks.js';
import apiRoutes from './routes/api.js';
import imageRoutes from './routes/images.js';
import adminRoutes from './routes/admin.js';
import { validateJson } from './middleware/validation.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { initializeFTS } from './scripts/migrate-add-fts.js';

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for Swagger UI
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Set body size limit
app.use(validateJson); // Validate JSON before routes

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'FM4 Backend API Documentation',
}));

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health Check
 *     description: Check if the API server is running and healthy
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api', apiRoutes);
app.use('/images', imageRoutes);
app.use('/admin', adminRoutes);

/**
 * @openapi
 * /:
 *   get:
 *     summary: API Information
 *     description: Get information about available API endpoints
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                 version:
 *                   type: string
 *                 documentation:
 *                   type: string
 *                 endpoints:
 *                   type: object
 */
app.get('/', (req, res) => {
  res.json({
    name: 'FM4 Backend API',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      live: '/api/live',
      broadcasts: '/api/broadcasts',
      broadcastsByDay: '/api/broadcasts/:day',
      broadcast: '/api/broadcast/:programKey/:day',
      broadcastItem: '/api/item/:id',
      search: '/api/search',
      programKeys: '/api/program-keys',
      images: '/images/:hash',
      health: '/health',
      apiDocs: '/api-docs'
    }
  });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Graceful shutdown
let isShuttingDown = false;
let httpServer = null;

const shutdown = async (signal) => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal');
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal} signal - shutting down gracefully...`);

  // Set a timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 30 seconds, forcing exit');
    process.exit(1);
  }, 30000); // 30 seconds max

  try {
    // Step 1: Stop accepting new requests
    if (httpServer) {
      logger.info('Closing HTTP server (no new connections accepted)...');
      await new Promise((resolve) => {
        httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });
    }

    // Step 2: Stop scheduled tasks (scraping, monitoring)
    logger.info('Stopping scheduled tasks...');
    scheduledTasks.stop();
    logger.info('Scheduled tasks stopped');

    // Step 3: Wait for any pending operations (give them 5 seconds)
    logger.info('Waiting for pending operations to complete...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Close database connections
    logger.info('Closing database connections...');
    db.close();
    logger.info('Database closed');

    // Step 5: Final cleanup
    clearTimeout(forceShutdownTimeout);
    logger.info('Graceful shutdown completed successfully');
    
    // Exit cleanly
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`, { stack: error.stack });
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

// Handle various shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM')); // Kubernetes, Docker, systemd
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C
process.on('SIGHUP', () => shutdown('SIGHUP'));   // Terminal closed
process.on('SIGBREAK', () => shutdown('SIGBREAK')); // Windows Ctrl+Break

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', { reason, promise });
  shutdown('unhandledRejection');
});

// Start server
const startServer = async () => {
  try {
    // Initialize database
    logger.info('Initializing database...');
    db.initialize();

    // Initialize Full-Text Search (creates tables if they don't exist)
    logger.info('Initializing Full-Text Search...');
    await initializeFTS(false);

    // Check if this is first run (no broadcasts in database)
    const existingBroadcasts = db.getAllBroadcasts(1);
    const isFirstRun = existingBroadcasts.length === 0;

    if (isFirstRun) {
      logger.info('First run detected - no broadcasts in database');
      logger.info('Will trigger initial scrape after server starts...');
    }

    // Initialize broadcast scraper
    logger.info('Initializing broadcast scraper...');
    await broadcastScraper.initialize();

    // Start scheduled tasks
    logger.info('Starting scheduled tasks...');
    scheduledTasks.start();

    // If first run, trigger initial scrape in background after server is up
    if (isFirstRun) {
      setImmediate(async () => {
        try {
          logger.info('=== Starting Initial Bootstrap Scrape ===');
          const daysToScrape = config.scraper.keepHistoryDays;
          logger.info(`Will scrape last ${daysToScrape} days using optimized strategy`);
          await broadcastScraper.scrapeHistoricalBroadcasts(daysToScrape);
          logger.info('=== Initial Bootstrap Scrape Complete ===');
        } catch (error) {
          logger.error(`Initial bootstrap scrape failed: ${error.message}`);
        }
      });
    }

    // Start Express server
    httpServer = app.listen(config.port, () => {
      logger.info(`FM4 Backend API server running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API Base URL: ${config.fm4.apiBaseUrl}`);
      logger.info(`Keeping ${config.scraper.keepHistoryDays} days of history`);
      logger.info(`API Documentation: http://localhost:${config.port}/api-docs`);
    });

    httpServer.on('error', (error) => {
      logger.error(`Server error: ${error.message}`);
      process.exit(1);
    });

    // Set keep-alive timeout for proper connection handling
    httpServer.keepAliveTimeout = 65000; // 65 seconds
    httpServer.headersTimeout = 66000; // 66 seconds (should be > keepAliveTimeout)
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
