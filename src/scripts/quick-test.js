import db from '../database/database.js';
import broadcastScraper from '../services/broadcast-scraper.js';
import logger from '../utils/logger.js';

async function quickTest() {
  try {
    logger.info('Quick test of dual resolution system');
    
    db.initialize();
    await broadcastScraper.initialize();
    
    // Scrape a known broadcast with images
    logger.info('Scraping broadcast 4HH/20251023...');
    await broadcastScraper.scrapeBroadcast('4HH', 20251023, true);
    
    // Check the results
    const broadcast = db.getBroadcast(20251023, '4HH');
    if (broadcast) {
      logger.info(`Found broadcast: ${broadcast.title}`);
      
      const images = db.getImageReferences('broadcast', broadcast.id);
      logger.info(`Total image records: ${images.length}`);
      
      images.forEach(img => {
        logger.info(`  - ${img.resolution_type}: ${img.hash.substring(0, 12)}... (${img.width}x${img.height})`);
      });
      
      // Check broadcast items
      const items = db.getBroadcastItems(broadcast.id);
      logger.info(`\nBroadcast items: ${items.length}`);
      
      if (items.length > 0) {
        const firstItem = items[0];
        const itemImages = db.getImageReferences('broadcast_item', firstItem.id);
        logger.info(`First item: ${firstItem.title}`);
        logger.info(`Item images: ${itemImages.length}`);
        
        itemImages.forEach(img => {
          logger.info(`  - ${img.resolution_type}: ${img.hash.substring(0, 12)}... (${img.width}x${img.height})`);
        });
      }
    } else {
      logger.warn('Broadcast not found');
    }
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

quickTest();
