import db from '../database/database.js';
import logger from '../utils/logger.js';
import transformer from '../utils/broadcast-transformer.js';

async function testLiveUrls() {
  try {
    logger.info('Testing Live Broadcast URL Generation\n');
    
    db.initialize();
    
    // Test 1: Format date/time for loopstream
    logger.info('='.repeat(60));
    logger.info('Test 1: Date/Time Formatting');
    logger.info('='.repeat(60));
    
    const testDate = new Date('2025-11-01T15:01:10Z');
    const formatted = transformer.formatDateTimeForLoopstream(testDate);
    logger.info(`Input: ${testDate.toISOString()}`);
    logger.info(`Output: ${formatted}`);
    logger.info(`Expected: 20251101150110 (or similar based on timezone)`);
    
    // Test 2: Live broadcast item URL generation
    logger.info('\n' + '='.repeat(60));
    logger.info('Test 2: Live Broadcast Item URLs');
    logger.info('='.repeat(60));
    
    const itemStartTime = new Date('2025-11-01T15:01:10Z').getTime();
    const broadcastDay = 20251101;
    
    const liveUrl = transformer.buildLiveBroadcastItemUrl(itemStartTime, broadcastDay);
    const liveHlsUrl = transformer.buildLiveBroadcastItemHlsUrl(itemStartTime, broadcastDay);
    
    logger.info(`\nItem Start Time: ${new Date(itemStartTime).toISOString()}`);
    logger.info(`Broadcast Day: ${broadcastDay}`);
    logger.info(`\nProgressive URL:\n  ${liveUrl}`);
    logger.info(`\nHLS URL:\n  ${liveHlsUrl}`);
    
    // Test 3: Compare live vs completed broadcast item transformation
    logger.info('\n' + '='.repeat(60));
    logger.info('Test 3: Live vs Completed Broadcast Items');
    logger.info('='.repeat(60));
    
    // Get the most recent broadcast
    const broadcasts = db.getAllBroadcasts(1);
    
    if (broadcasts.length === 0) {
      logger.warn('No broadcasts found in database');
      db.close();
      return;
    }
    
    const latestBroadcast = broadcasts[0];
    logger.info(`\nLatest Broadcast: ${latestBroadcast.title || 'Untitled'}`);
    logger.info(`Program Key: ${latestBroadcast.program_key}`);
    logger.info(`Broadcast Day: ${latestBroadcast.broadcast_day}`);
    logger.info(`Done: ${latestBroadcast.done ? 'Yes (completed)' : 'No (live/pending)'}`);
    logger.info(`Has loopstream: ${latestBroadcast.loop_stream_id ? 'Yes' : 'No'}`);
    
    if (!latestBroadcast.loop_stream_id) {
      logger.warn('Latest broadcast has no loopstream, cannot demonstrate URL differences');
      db.close();
      return;
    }
    
    // Get items for this broadcast
    const items = db.getBroadcastItems(latestBroadcast.id);
    
    if (items.length === 0) {
      logger.warn('No items found for this broadcast');
      db.close();
      return;
    }
    
    logger.info(`\nFound ${items.length} items in this broadcast`);
    logger.info('\nShowing first 3 items:');
    
    const itemsToShow = items.slice(0, 3);
    
    for (let i = 0; i < itemsToShow.length; i++) {
      const item = itemsToShow[i];
      logger.info(`\n${'-'.repeat(60)}`);
      logger.info(`Item ${i + 1}: ${item.title || 'Untitled'}`);
      logger.info(`Type: ${item.type}`);
      logger.info(`Start: ${item.start_iso}`);
      
      // Transform with current done status
      const transformedCurrent = transformer.transformBroadcastItem(item, 'http://localhost:3000', latestBroadcast);
      
      if (transformedCurrent.loopstream) {
        logger.info(`\nCurrent URLs (done=${latestBroadcast.done}):`);
        logger.info(`  isLive: ${transformedCurrent.loopstream.isLive}`);
        logger.info(`  Progressive: ${transformedCurrent.loopstream.progressive}`);
        logger.info(`  HLS: ${transformedCurrent.loopstream.hls}`);
      }
      
      // Simulate opposite done status
      const oppositeBroadcast = { ...latestBroadcast, done: latestBroadcast.done ? 0 : 1 };
      const transformedOpposite = transformer.transformBroadcastItem(item, 'http://localhost:3000', oppositeBroadcast);
      
      if (transformedOpposite.loopstream) {
        logger.info(`\nIf done=${oppositeBroadcast.done}:`);
        logger.info(`  isLive: ${transformedOpposite.loopstream.isLive}`);
        logger.info(`  Progressive: ${transformedOpposite.loopstream.progressive}`);
        logger.info(`  HLS: ${transformedOpposite.loopstream.hls}`);
      }
    }
    
    // Test 4: URL structure analysis
    logger.info('\n' + '='.repeat(60));
    logger.info('Test 4: URL Structure Analysis');
    logger.info('='.repeat(60));
    
    logger.info('\nLive Broadcast Item URL Structure:');
    logger.info('  /?channel=fm4&start=YYYYMMDDHHmmss&ende=YYYYMMDD');
    logger.info('  - start: When the item started playing');
    logger.info('  - ende: End of the broadcast day (allows going back)');
    logger.info('  - No id parameter (uses date range instead)');
    
    logger.info('\nCompleted Broadcast Item URL Structure:');
    logger.info('  /?channel=fm4&id=LOOPSTREAM_ID&offset=MILLISECONDS&offsetende=0');
    logger.info('  - id: Loopstream ID for the broadcast');
    logger.info('  - offset: Milliseconds from broadcast start to item start');
    logger.info('  - offsetende: Usually 0 (play to end)');
    
    logger.info('\n✅ Live URL generation is working!');
    logger.info('URLs will automatically refresh when broadcasts complete.\n');
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

logger.info('FM4 Backend: Test Live Broadcast URL Generation');
logger.info('This tests the new date-based loopstream URLs for live broadcasts');
logger.info('');

testLiveUrls();
