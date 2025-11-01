import db from '../database/database.js';
import transformer from '../utils/broadcast-transformer.js';
import logger from '../utils/logger.js';

async function demonstrateFeature() {
  try {
    logger.info('\n╔══════════════════════════════════════════════════════════════╗');
    logger.info('║  DUAL RESOLUTION IMAGE SYSTEM - DEMONSTRATION              ║');
    logger.info('╚══════════════════════════════════════════════════════════════╝\n');
    
    db.initialize();
    
    const broadcast = db.getBroadcast(20251023, '4HH');
    if (!broadcast) {
      logger.error('Test broadcast not found. Run: node src/scripts/quick-test.js first');
      db.close();
      return;
    }
    
    const baseUrl = 'http://localhost:3000';
    const transformed = transformer.transformBroadcast(broadcast, baseUrl, true);
    
    logger.info('📻 BROADCAST: ' + transformed.title);
    logger.info('─'.repeat(60));
    
    logger.info('\n🖼️  BROADCAST IMAGES:');
    logger.info(`   High Resolution: ${transformed.images.high.length} image(s)`);
    if (transformed.images.high.length > 0) {
      const img = transformed.images.high[0];
      logger.info(`   ├─ Size: ${img.width}x${img.height}px`);
      logger.info(`   ├─ URL: ${img.url}`);
      logger.info(`   └─ Alt: ${img.alt}`);
    }
    
    logger.info(`\n   Low Resolution: ${transformed.images.low.length} image(s)`);
    if (transformed.images.low.length > 0) {
      const img = transformed.images.low[0];
      logger.info(`   ├─ Size: ${img.width}x${img.height}px`);
      logger.info(`   ├─ URL: ${img.url}`);
      logger.info(`   └─ Alt: ${img.alt}`);
    }
    
    const itemsWithImages = transformed.items.filter(item => 
      item.images && (item.images.high.length > 0 || item.images.low.length > 0)
    );
    
    logger.info(`\n\n🎵 BROADCAST ITEMS: ${transformed.items.length} total`);
    logger.info(`   Items with images: ${itemsWithImages.length}`);
    logger.info('─'.repeat(60));
    
    if (itemsWithImages.length > 0) {
      const sample = itemsWithImages[0];
      logger.info(`\n   Example: "${sample.title}" by ${sample.interpreter}`);
      logger.info(`   ├─ High res: ${sample.images.high.length} image(s)`);
      if (sample.images.high.length > 0) {
        logger.info(`   │  └─ ${sample.images.high[0].width}x${sample.images.high[0].height}px`);
      }
      logger.info(`   └─ Low res: ${sample.images.low.length} image(s)`);
      if (sample.images.low.length > 0) {
        logger.info(`      └─ ${sample.images.low[0].width}x${sample.images.low[0].height}px`);
      }
    }
    
    logger.info('\n\n✅ USE CASES:');
    logger.info('─'.repeat(60));
    logger.info('📱 Mobile/Thumbnails → Use LOW resolution (faster, less bandwidth)');
    logger.info('🖥️  Desktop/Details   → Use HIGH resolution (better quality)');
    logger.info('📊 List Views        → Use LOW resolution');
    logger.info('🎨 Full Screen       → Use HIGH resolution');
    
    logger.info('\n\n📊 STATISTICS:');
    logger.info('─'.repeat(60));
    const stats = db.db.prepare(`
      SELECT 
        resolution_type,
        COUNT(*) as count,
        AVG(width) as avg_width,
        AVG(height) as avg_height,
        SUM(file_size) as total_size
      FROM images
      GROUP BY resolution_type
    `).all();
    
    stats.forEach(stat => {
      const sizeMB = (stat.total_size / 1024 / 1024).toFixed(2);
      logger.info(`   ${stat.resolution_type.toUpperCase()}:`);
      logger.info(`   ├─ Count: ${stat.count} images`);
      logger.info(`   ├─ Avg Size: ${Math.round(stat.avg_width)}x${Math.round(stat.avg_height)}px`);
      logger.info(`   └─ Total Storage: ${sizeMB} MB`);
    });
    
    const savings = stats.find(s => s.resolution_type === 'low')?.total_size || 0;
    const highSize = stats.find(s => s.resolution_type === 'high')?.total_size || 0;
    const savingsPercent = highSize > 0 ? ((1 - savings/highSize) * 100).toFixed(0) : 0;
    
    logger.info(`\n   💡 Using low-res saves ~${savingsPercent}% bandwidth for thumbnails!`);
    
    logger.info('\n\n🎉 IMPLEMENTATION COMPLETE!\n');
    
    db.close();
  } catch (error) {
    logger.error('Error:', error);
    db.close();
  }
}

demonstrateFeature();
