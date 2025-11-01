import db from '../database/database.js';
import transformer from '../utils/broadcast-transformer.js';
import logger from '../utils/logger.js';

async function testOffsetsDuration() {
  try {
    logger.info('Testing offsets and duration system');
    
    db.initialize();
    
    // Get a recent broadcast
    const broadcasts = db.getAllBroadcasts(1);
    if (broadcasts.length === 0) {
      logger.warn('No broadcasts found in database');
      db.close();
      return;
    }
    
    const broadcast = broadcasts[0];
    logger.info(`\nBroadcast: ${broadcast.title}`);
    logger.info(`Program Key: ${broadcast.program_key}/${broadcast.broadcast_day}`);
    logger.info(`Duration: ${broadcast.duration}ms (${Math.round(broadcast.duration / 1000 / 60)} minutes)`);
    
    // Transform for API output
    const baseUrl = 'http://localhost:3000';
    const transformed = transformer.transformBroadcast(broadcast, baseUrl, true);
    
    logger.info('\n=== BROADCAST DATA ===');
    logger.info(`Start: ${transformed.startISO}`);
    logger.info(`End: ${transformed.endISO}`);
    logger.info(`Duration: ${transformed.duration}ms`);
    
    if (transformed.items && transformed.items.length > 0) {
      logger.info(`\n=== BROADCAST ITEMS (showing first 5) ===`);
      
      const itemsToShow = transformed.items.slice(0, 5);
      itemsToShow.forEach((item, index) => {
        logger.info(`\n[${index + 1}] ${item.type}: ${item.title || 'N/A'}`);
        if (item.interpreter) {
          logger.info(`    Interpreter: ${item.interpreter}`);
        }
        logger.info(`    Duration: ${item.duration}ms (${Math.round(item.duration / 1000)} seconds)`);
        logger.info(`    Start Offset: ${item.startOffset}ms (${Math.round(item.startOffset / 1000)} seconds from broadcast start)`);
        logger.info(`    End Offset: ${item.endOffset}ms (${Math.round(item.endOffset / 1000)} seconds from broadcast start)`);
        logger.info(`    Start Time: ${item.startISO}`);
        logger.info(`    End Time: ${item.endISO}`);
      });
      
      // Show summary
      logger.info(`\n=== SUMMARY ===`);
      logger.info(`Total items: ${transformed.items.length}`);
      
      const itemsWithOffsets = transformed.items.filter(i => i.startOffset !== null && i.endOffset !== null);
      logger.info(`Items with offsets: ${itemsWithOffsets.length}`);
      
      const itemsWithDuration = transformed.items.filter(i => i.duration !== null);
      logger.info(`Items with duration: ${itemsWithDuration.length}`);
      
      // Calculate total duration of all items
      const totalItemDuration = transformed.items.reduce((sum, item) => {
        return sum + (item.duration || 0);
      }, 0);
      logger.info(`Total duration of all items: ${totalItemDuration}ms (${Math.round(totalItemDuration / 1000 / 60)} minutes)`);
      logger.info(`Broadcast duration: ${transformed.duration}ms (${Math.round(transformed.duration / 1000 / 60)} minutes)`);
    } else {
      logger.info('\nNo items found for this broadcast');
    }
    
    logger.info('\n✅ Test complete!');
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

testOffsetsDuration();
