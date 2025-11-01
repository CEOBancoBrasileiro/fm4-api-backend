import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';

async function testHistoricalScrapingOffsets() {
  try {
    logger.info('Testing offsets calculation during historical scraping');
    
    db.initialize();
    await broadcastScraper.initialize();
    
    // Scrape last 2 days
    logger.info('\nScraping last 2 days...');
    await broadcastScraper.scrapeHistoricalBroadcasts(2);
    
    // Check a sample of broadcasts
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayDay = parseInt(
      `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`
    );
    
    logger.info(`\nChecking broadcasts from ${yesterdayDay}...`);
    const broadcasts = db.getBroadcastsByDateRange(yesterdayDay, yesterdayDay);
    
    logger.info(`Found ${broadcasts.length} broadcasts`);
    
    let totalItems = 0;
    let itemsWithOffsets = 0;
    let broadcastsWithDuration = 0;
    
    broadcasts.forEach(broadcast => {
      if (broadcast.duration !== null) {
        broadcastsWithDuration++;
      }
      
      const items = db.getBroadcastItems(broadcast.id);
      totalItems += items.length;
      
      items.forEach(item => {
        if (item.start_offset !== null) {
          itemsWithOffsets++;
        }
      });
    });
    
    logger.info(`\n=== RESULTS ===`);
    logger.info(`Broadcasts with duration: ${broadcastsWithDuration} / ${broadcasts.length}`);
    logger.info(`Items with offsets: ${itemsWithOffsets} / ${totalItems}`);
    
    // Show a sample broadcast
    if (broadcasts.length > 0) {
      const sample = broadcasts[0];
      const items = db.getBroadcastItems(sample.id);
      
      logger.info(`\n=== SAMPLE BROADCAST ===`);
      logger.info(`Title: ${sample.title}`);
      logger.info(`Program Key: ${sample.program_key}/${sample.broadcast_day}`);
      logger.info(`Duration: ${sample.duration}ms`);
      logger.info(`Items: ${items.length}`);
      
      if (items.length > 0) {
        logger.info('\nFirst 2 items:');
        items.slice(0, 2).forEach((item, index) => {
          logger.info(`  [${index + 1}] ${item.type}: ${item.title || 'N/A'}`);
          logger.info(`      Start Offset: ${item.start_offset}ms`);
          logger.info(`      End Offset: ${item.end_offset}ms`);
        });
      }
    }
    
    if (itemsWithOffsets === totalItems && broadcastsWithDuration === broadcasts.length) {
      logger.info('\n========================================');
      logger.info('✓ SUCCESS: All broadcasts have duration');
      logger.info('✓ SUCCESS: All items have offsets');
      logger.info('Historical scraping works correctly! ✓');
      logger.info('========================================\n');
    } else {
      logger.warn('\n========================================');
      logger.warn('⚠ WARNING: Some items missing offsets or duration');
      logger.warn('========================================\n');
    }
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

testHistoricalScrapingOffsets();
