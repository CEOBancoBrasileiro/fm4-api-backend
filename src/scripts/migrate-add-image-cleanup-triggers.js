import db from '../database/database.js';
import logger from '../utils/logger.js';

/**
 * Migration: Add triggers to cleanup image_references when broadcasts/items are deleted
 * 
 * This ensures that when a broadcast or broadcast_item is deleted:
 * 1. Its image_references entries are automatically removed
 * 2. Orphaned images can then be detected and cleaned up
 */
async function migrateAddImageCleanupTriggers() {
  try {
    logger.info('Starting migration: Add image reference cleanup triggers');
    
    db.initialize();
    
    // Check if triggers already exist
    const existingTriggers = db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='trigger' 
      AND name IN ('cleanup_broadcast_images', 'cleanup_broadcast_item_images')
    `).all();
    
    if (existingTriggers.length === 2) {
      logger.info('Image cleanup triggers already exist, skipping migration');
      db.close();
      process.exit(0);
    }
    
    logger.info('Creating trigger to cleanup broadcast image references on deletion...');
    
    // When a broadcast is deleted, remove its image references
    db.db.exec(`
      CREATE TRIGGER IF NOT EXISTS cleanup_broadcast_images 
      AFTER DELETE ON broadcasts 
      BEGIN
        DELETE FROM image_references 
        WHERE entity_type = 'broadcast' 
        AND entity_id = OLD.id;
      END;
    `);
    
    logger.info('Creating trigger to cleanup broadcast item image references on deletion...');
    
    // When a broadcast item is deleted, remove its image references
    db.db.exec(`
      CREATE TRIGGER IF NOT EXISTS cleanup_broadcast_item_images 
      AFTER DELETE ON broadcast_items 
      BEGIN
        DELETE FROM image_references 
        WHERE entity_type = 'broadcast_item' 
        AND entity_id = OLD.id;
      END;
    `);
    
    logger.info('✅ Image cleanup triggers created successfully!');
    logger.info('');
    logger.info('Now when broadcasts/items are deleted:');
    logger.info('  1. image_references entries are automatically removed');
    logger.info('  2. deleteUnreferencedImages() can find orphaned image records');
    logger.info('  3. (Still need to manually clean physical files - see enhanced cleanup script)');
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

logger.info('FM4 Database Migration: Add Image Reference Cleanup Triggers');
logger.info('This ensures orphaned image_references are removed when broadcasts/items are deleted');
logger.info('');

migrateAddImageCleanupTriggers();
