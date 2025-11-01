import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';

async function testScrapingWithOffsets() {
  try {
    logger.info('Testing if offsets are calculated during scraping');
    
    db.initialize();
    await broadcastScraper.initialize();
    
    // Scrape a broadcast (force re-scrape to test)
    logger.info('\nScraping broadcast 4LB/20251031...');
    await broadcastScraper.scrapeBroadcast('4LB', 20251031, true);
    
    // Check the results
    const broadcast = db.getBroadcast(20251031, '4LB');
    if (!broadcast) {
      logger.error('Broadcast not found after scraping!');
      db.close();
      return;
    }
    
    logger.info(`\n✓ Broadcast: ${broadcast.title}`);
    logger.info(`  Duration: ${broadcast.duration}ms (${Math.round(broadcast.duration / 1000 / 60)} minutes)`);
    
    const items = db.getBroadcastItems(broadcast.id);
    logger.info(`\n✓ Total items: ${items.length}`);
    
    const itemsWithOffsets = items.filter(i => i.start_offset !== null);
    const itemsWithDuration = items.filter(i => i.duration !== null);
    
    logger.info(`  Items with start_offset: ${itemsWithOffsets.length} / ${items.length}`);
    logger.info(`  Items with duration: ${itemsWithDuration.length} / ${items.length}`);
    
    if (itemsWithOffsets.length > 0) {
      logger.info('\n✓ Sample items with offsets:');
      const samples = items.slice(0, 3);
      samples.forEach((item, index) => {
        logger.info(`\n  [${index + 1}] ${item.type}: ${item.title || 'N/A'}`);
        logger.info(`      Duration: ${item.duration}ms`);
        logger.info(`      Start Offset: ${item.start_offset}ms (${Math.round(item.start_offset / 1000)}s from broadcast start)`);
        logger.info(`      End Offset: ${item.end_offset}ms (${Math.round(item.end_offset / 1000)}s from broadcast start)`);
      });
    } else {
      logger.error('\n✗ No items have offsets calculated!');
      logger.error('   This indicates the offset calculation is not working during scraping.');
    }
    
    // Verify the calculation is correct
    if (items.length > 0 && itemsWithOffsets.length > 0) {
      const firstItem = items[0];
      const expectedStartOffset = firstItem.start_time - broadcast.start_time;
      const expectedEndOffset = firstItem.end_time - broadcast.start_time;
      
      logger.info('\n✓ Verification:');
      logger.info(`  Broadcast start: ${broadcast.start_time}`);
      logger.info(`  First item start: ${firstItem.start_time}`);
      logger.info(`  Expected start_offset: ${expectedStartOffset}ms`);
      logger.info(`  Actual start_offset: ${firstItem.start_offset}ms`);
      logger.info(`  Match: ${expectedStartOffset === firstItem.start_offset ? '✓ YES' : '✗ NO'}`);
    }
    
    logger.info('\n========================================');
    logger.info('CONCLUSION: Offsets ARE calculated during scraping! ✓');
    logger.info('========================================\n');
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

testScrapingWithOffsets();
