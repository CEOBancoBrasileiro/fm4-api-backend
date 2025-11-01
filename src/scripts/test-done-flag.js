import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';

async function testDoneFlag() {
  try {
    logger.info('\n=== Testing Done Flag System ===\n');
    
    db.initialize();
    await broadcastScraper.initialize();
    
    // Find an old completed broadcast
    const oldBroadcast = db.db.prepare(`
      SELECT * FROM broadcasts 
      WHERE broadcast_day < 20251023 
      AND end_time < ? 
      ORDER BY end_time DESC 
      LIMIT 1
    `).get(Date.now());
    
    if (!oldBroadcast) {
      logger.error('No old broadcasts found to test');
      process.exit(1);
    }
    
    logger.info(`Testing with broadcast: ${oldBroadcast.program_key}/${oldBroadcast.broadcast_day}`);
    logger.info(`  Title: ${oldBroadcast.title}`);
    logger.info(`  End time: ${new Date(oldBroadcast.end_time).toISOString()}`);
    logger.info(`  Initial done status: ${oldBroadcast.done ? 'YES' : 'NO'}`);
    
    // Force scrape it (should mark as done since it's ended)
    logger.info('\n1. Force scraping completed broadcast (should mark as done)...');
    const result1 = await broadcastScraper.scrapeBroadcast(
      oldBroadcast.program_key, 
      oldBroadcast.broadcast_day, 
      true // force fetch
    );
    
    // Check if it was marked as done
    const afterFirstScrape = db.getBroadcast(oldBroadcast.broadcast_day, oldBroadcast.program_key);
    logger.info(`  After scrape - done status: ${afterFirstScrape.done ? 'YES ✓' : 'NO ✗'}`);
    
    if (!afterFirstScrape.done) {
      logger.error('FAIL: Broadcast should have been marked as done!');
    } else {
      logger.info('PASS: Broadcast correctly marked as done!');
    }
    
    // Try to scrape it again (should skip)
    logger.info('\n2. Attempting to scrape same broadcast again (should skip)...');
    const startTime = Date.now();
    const result2 = await broadcastScraper.scrapeBroadcast(
      oldBroadcast.program_key, 
      oldBroadcast.broadcast_day, 
      false // don't force
    );
    const duration = Date.now() - startTime;
    
    logger.info(`  Scrape completed in ${duration}ms`);
    if (duration < 100) {
      logger.info('PASS: Broadcast was skipped (completed very fast)!');
    } else {
      logger.warn('WARNING: Scrape took longer than expected, might not have been skipped');
    }
    
    // Check items weren't duplicated
    const items = db.getBroadcastItems(afterFirstScrape.id);
    const itemIds = items.map(item => item.item_id);
    const uniqueItemIds = new Set(itemIds);
    
    logger.info(`\n3. Checking for duplicate items...`);
    logger.info(`  Total items: ${items.length}`);
    logger.info(`  Unique item IDs: ${uniqueItemIds.size}`);
    
    if (items.length === uniqueItemIds.size) {
      logger.info('PASS: No duplicate items!');
    } else {
      logger.error(`FAIL: Found ${items.length - uniqueItemIds.size} duplicate items!`);
    }
    
    // Summary
    logger.info('\n=== Test Summary ===');
    logger.info(`Broadcast: ${oldBroadcast.program_key}/${oldBroadcast.broadcast_day}`);
    logger.info(`Done flag: ${afterFirstScrape.done ? '✓' : '✗'}`);
    logger.info(`No duplicates: ${items.length === uniqueItemIds.size ? '✓' : '✗'}`);
    logger.info(`Skip on re-scrape: ${duration < 100 ? '✓' : '?'}`);
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Test failed:', error);
    db.close();
    process.exit(1);
  }
}

testDoneFlag();
