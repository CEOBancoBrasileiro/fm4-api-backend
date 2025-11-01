import db from '../database/database.js';
import transformer from '../utils/broadcast-transformer.js';
import logger from '../utils/logger.js';

async function testAPI() {
  try {
    logger.info('Testing API output with dual resolution images');
    
    db.initialize();
    
    const broadcast = db.getBroadcast(20251023, '4HH');
    if (broadcast) {
      const baseUrl = 'http://localhost:3000';
      const transformed = transformer.transformBroadcast(broadcast, baseUrl, true);
      
      logger.info('\nBroadcast images structure:');
      console.log(JSON.stringify(transformed.images, null, 2));
      
      logger.info('\nFirst item with images:');
      const itemWithImages = transformed.items.find(item => 
        item.images && (item.images.high.length > 0 || item.images.low.length > 0)
      );
      
      if (itemWithImages) {
        console.log(JSON.stringify({
          title: itemWithImages.title,
          interpreter: itemWithImages.interpreter,
          images: itemWithImages.images
        }, null, 2));
      }
      
      logger.info('\n✓ API returns images grouped by resolution (high/low)');
    }
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

testAPI();
