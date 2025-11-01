import express from 'express';
import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';
import imageService from '../services/image-service.js';
import { asyncHandler, validateInteger, validateBroadcastDay, validateProgramKey } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';

const router = express.Router();

// POST /admin/scrape/full - Trigger full historical scrape
router.post('/scrape/full', 
  validateInteger('days', 'body', { optional: true, min: 1, max: 365 }),
  asyncHandler(async (req, res) => {
    const daysBack = req.body.days || 30;

    logger.info(`Admin triggered full scrape for ${daysBack} days`);
    
    // Run in background
    setImmediate(async () => {
      try {
        await broadcastScraper.scrapeHistoricalBroadcasts(daysBack);
        logger.info(`Admin full scrape completed`);
      } catch (error) {
        logger.error(`Admin full scrape failed: ${error.message}`);
      }
    });

    res.json({ 
      message: `Full scrape initiated for ${daysBack} days`,
      status: 'running'
    });
  })
);

// POST /admin/scrape/recent - Trigger recent broadcasts scrape
router.post('/scrape/recent', asyncHandler(async (req, res) => {
  logger.info('Admin triggered recent scrape');
  
  // Run in background
  setImmediate(async () => {
    try {
      await broadcastScraper.scrapeRecentBroadcasts();
      logger.info('Admin recent scrape completed');
    } catch (error) {
      logger.error(`Admin recent scrape failed: ${error.message}`);
    }
  });

  res.json({ 
    message: 'Recent scrape initiated',
    status: 'running'
  });
}));

// POST /admin/scrape/broadcast - Scrape specific broadcast
router.post('/scrape/broadcast',
  validateProgramKey('programKey', 'body'),
  validateBroadcastDay('broadcastDay', 'body'),
  asyncHandler(async (req, res) => {
    const { programKey, broadcastDay } = req.body;

    logger.info(`Admin triggered scrape for ${programKey}/${broadcastDay}`);
    
    // Run in background
    setImmediate(async () => {
      try {
        await broadcastScraper.scrapeBroadcast(programKey, broadcastDay);
        logger.info(`Admin broadcast scrape completed: ${programKey}/${broadcastDay}`);
      } catch (error) {
        logger.error(`Admin broadcast scrape failed: ${error.message}`);
      }
    });

    res.json({ 
      message: `Broadcast scrape initiated for ${programKey}/${broadcastDay}`,
      status: 'running'
    });
  })
);

// POST /admin/discover-keys - Discover new program keys
router.post('/discover-keys', async (req, res) => {
  try {
    logger.info('Admin triggered program key discovery');
    
    // Run in background
    setImmediate(async () => {
      try {
        await broadcastScraper.discoverProgramKeys();
        logger.info('Admin program key discovery completed');
      } catch (error) {
        logger.error(`Admin program key discovery failed: ${error.message}`);
      }
    });

    res.json({ 
      message: 'Program key discovery initiated',
      status: 'running'
    });
  } catch (error) {
    logger.error(`Failed to start discovery: ${error.message}`);
    res.status(500).json({ error: 'Failed to start discovery' });
  }
});

// POST /admin/cleanup - Manually trigger cleanup
router.post('/cleanup', asyncHandler(async (req, res) => {
  logger.info('Admin triggered cleanup');
  
  // Run in background
  setImmediate(async () => {
    try {
      await broadcastScraper.cleanupOldBroadcasts();
      logger.info('Admin cleanup completed');
    } catch (error) {
      logger.error(`Admin cleanup failed: ${error.message}`);
    }
  });

  res.json({ 
    message: 'Cleanup initiated',
    status: 'running'
  });
}));

// GET /admin/stats - Get database statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const broadcasts = db.getAllBroadcasts(1000000);
  const programKeys = db.getAllProgramKeys();
  
  const stmt = db.db.prepare('SELECT COUNT(*) as count FROM images');
  const imageCount = stmt.get().count;
  
  const refStmt = db.db.prepare('SELECT COUNT(*) as count FROM image_references');
  const refCount = refStmt.get().count;

  res.json({
    broadcasts: broadcasts.length,
    programKeys: programKeys.length,
    images: imageCount,
    imageReferences: refCount,
    oldestBroadcast: broadcasts[broadcasts.length - 1]?.broadcast_day || null,
    newestBroadcast: broadcasts[0]?.broadcast_day || null
  });
}));

// GET /admin/live-monitor - Get live monitor status
router.get('/live-monitor', async (req, res) => {
  try {
    const liveMonitor = (await import('../services/live-monitor.js')).default;
    
    const monitoredBroadcasts = Array.from(liveMonitor.monitoredBroadcasts.entries()).map(([id, data]) => ({
      broadcastId: id,
      programKey: data.programKey,
      broadcastDay: data.broadcastDay,
      state: data.state,
      lastCheck: new Date(data.lastCheck).toISOString()
    }));

    const monitoredItems = Array.from(liveMonitor.monitoredItems.entries()).map(([id, data]) => ({
      itemId: id,
      broadcastId: data.broadcastId,
      programKey: data.programKey,
      broadcastDay: data.broadcastDay,
      state: data.state,
      endTime: new Date(data.endTime).toISOString()
    }));

    // Get cache statistics
    const processedItemsCache = {};
    let totalCachedItems = 0;
    for (const [broadcastId, items] of liveMonitor.processedItems.entries()) {
      processedItemsCache[broadcastId] = items.size;
      totalCachedItems += items.size;
    }

    res.json({
      isRunning: liveMonitor.intervalId !== null,
      checkInterval: liveMonitor.checkInterval,
      monitoredBroadcasts,
      monitoredItems,
      totalMonitored: monitoredBroadcasts.length + monitoredItems.length,
      cache: {
        broadcastsWithCache: Object.keys(processedItemsCache).length,
        totalCachedItems,
        details: processedItemsCache
      }
    });
  } catch (error) {
    logger.error(`Failed to get live monitor status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get live monitor status' });
  }
});

// POST /admin/rotate-logs - Manually trigger log rotation (for testing)
router.post('/rotate-logs', asyncHandler(async (req, res) => {
  const logRotation = (await import('../utils/log-rotation.js')).default;
  logger.info('Admin triggered manual log rotation');
  
  await logRotation.rotateLog();
  
  res.json({ 
    message: 'Log rotation triggered successfully',
    status: 'complete'
  });
}));

export default router;
