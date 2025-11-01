import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';
import { initializeFTS } from './migrate-add-fts.js';

async function scrapeBroadcasts() {
  try {
    // Get days parameter from command line (default 30)
    const args = process.argv.slice(2);
    const daysBack = args[0] ? parseInt(args[0]) : 30;

    if (isNaN(daysBack) || daysBack < 1 || daysBack > 365) {
      logger.error('Invalid days parameter. Must be between 1 and 365');
      process.exit(1);
    }

    logger.info(`Starting broadcast scraping for the last ${daysBack} days`);
    logger.info('Initializing database...');
    
    db.initialize();
    
    logger.info('Initializing scraper...');
    await broadcastScraper.initialize();
    
    logger.info('Starting historical scrape...');
    await broadcastScraper.scrapeHistoricalBroadcasts(daysBack);
    
    logger.info('Scraping complete!');
    
    // Show statistics
    const broadcasts = db.getAllBroadcasts(100000);
    const programKeys = db.getAllProgramKeys();
    
    logger.info(`Total broadcasts stored: ${broadcasts.length}`);
    logger.info(`Total program keys: ${programKeys.length}`);
    
    // Initialize Full-Text Search after scraping
    logger.info('');
    logger.info('Initializing Full-Text Search (FTS5)...');
    const ftsSuccess = await initializeFTS(false);
    
    if (ftsSuccess) {
      logger.info('Full-Text Search is ready! The /api/search endpoint is now available.');
    } else {
      logger.warn('Full-Text Search initialization failed. Search functionality may not work.');
    }
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Scraping failed:', error);
    db.close();
    process.exit(1);
  }
}

logger.info('FM4 Broadcast Scraper');
logger.info('Usage: node scrape-broadcasts.js [days]');
logger.info('Example: node scrape-broadcasts.js 30');
logger.info('');

scrapeBroadcasts();
