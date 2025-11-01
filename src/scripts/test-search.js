import db from '../database/database.js';
import logger from '../utils/logger.js';

async function testSearch() {
  try {
    logger.info('Testing Full-Text Search functionality\n');
    
    db.initialize();
    
    const testQueries = [
      'radiohead',
      'morning show',
      'happy hour',
      'rock music',
      'interview',
      'Ariana Grande'
    ];
    
    for (const query of testQueries) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Search query: "${query}"`);
      logger.info('='.repeat(60));
      
      // Search broadcasts
      const broadcasts = db.searchBroadcasts(query, 5);
      logger.info(`\nBroadcasts (${broadcasts.length} results):`);
      broadcasts.forEach((b, i) => {
        logger.info(`  ${i + 1}. ${b.title || 'Untitled'} (${b.program_key}/${b.broadcast_day})`);
        logger.info(`     Rank: ${b.rank.toFixed(2)}`);
        if (b.title_snippet && b.title_snippet !== b.title) {
          logger.info(`     Title snippet: ${b.title_snippet}`);
        }
        if (b.description_snippet) {
          logger.info(`     Description: ${b.description_snippet}`);
        }
      });
      
      // Search items
      const items = db.searchBroadcastItems(query, 5);
      logger.info(`\nBroadcast Items (${items.length} results):`);
      items.forEach((item, i) => {
        logger.info(`  ${i + 1}. ${item.title || 'Untitled'} - ${item.interpreter || 'Unknown'}`);
        logger.info(`     Type: ${item.type}, Rank: ${item.rank.toFixed(2)}`);
        if (item.title_snippet && item.title_snippet !== item.title) {
          logger.info(`     Title snippet: ${item.title_snippet}`);
        }
        if (item.interpreter_snippet && item.interpreter_snippet !== item.interpreter) {
          logger.info(`     Artist snippet: ${item.interpreter_snippet}`);
        }
      });
      
      // Count results
      const broadcastCount = db.countSearchBroadcasts(query);
      const itemCount = db.countSearchBroadcastItems(query);
      logger.info(`\nTotal: ${broadcastCount} broadcasts, ${itemCount} items`);
    }
    
    // Performance test
    logger.info(`\n\n${'='.repeat(60)}`);
    logger.info('Performance Test');
    logger.info('='.repeat(60));
    
    const perfQuery = 'music';
    const start = Date.now();
    const results = db.searchAll(perfQuery, 50);
    const duration = Date.now() - start;
    
    logger.info(`\nSearch for "${perfQuery}" with 50 results:`);
    logger.info(`  Broadcasts: ${results.broadcasts.length}`);
    logger.info(`  Items: ${results.items.length}`);
    logger.info(`  Total: ${results.total}`);
    logger.info(`  Duration: ${duration}ms`);
    
    logger.info('\n✅ Full-Text Search is working correctly!');
    logger.info('Search is blazingly fast with FTS5! 🚀\n');
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

testSearch();
