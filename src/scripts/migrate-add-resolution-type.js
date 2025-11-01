import db from '../database/database.js';
import logger from '../utils/logger.js';

async function migrateAddResolutionType() {
  try {
    logger.info('Starting migration: Add resolution_type to images and image_references tables');
    
    db.initialize();
    
    // Check if column already exists in images table
    const imagesTableInfo = db.db.prepare("PRAGMA table_info(images)").all();
    const hasResolutionType = imagesTableInfo.some(col => col.name === 'resolution_type');
    
    if (hasResolutionType) {
      logger.info('Column "resolution_type" already exists in images table');
    } else {
      // Add the resolution_type column to images table
      logger.info('Adding "resolution_type" column to images table...');
      db.db.prepare('ALTER TABLE images ADD COLUMN resolution_type TEXT NOT NULL DEFAULT "high"').run();
      logger.info('Added resolution_type column to images table');
      
      // Drop the old UNIQUE constraint and create a new one that includes resolution_type
      logger.info('Recreating images table with new UNIQUE constraint...');
      
      // SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table
      db.db.exec(`
        -- Create temporary table with new schema
        CREATE TABLE images_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hash TEXT NOT NULL,
          resolution_type TEXT NOT NULL DEFAULT 'high',
          original_hash_code INTEGER,
          alt TEXT,
          text TEXT,
          category TEXT,
          copyright TEXT,
          mode TEXT,
          file_path TEXT,
          width INTEGER,
          height INTEGER,
          file_size INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          UNIQUE(hash, resolution_type)
        );
        
        -- Copy data from old table
        INSERT INTO images_new SELECT 
          id, hash, resolution_type, original_hash_code, alt, text, 
          category, copyright, mode, file_path, width, height, 
          file_size, created_at 
        FROM images;
        
        -- Drop old table
        DROP TABLE images;
        
        -- Rename new table
        ALTER TABLE images_new RENAME TO images;
        
        -- Recreate index
        CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
      `);
      
      logger.info('Successfully recreated images table with UNIQUE(hash, resolution_type)');
    }
    
    // Check if column already exists in image_references table
    const refsTableInfo = db.db.prepare("PRAGMA table_info(image_references)").all();
    const refsHasResolutionType = refsTableInfo.some(col => col.name === 'resolution_type');
    
    if (refsHasResolutionType) {
      logger.info('Column "resolution_type" already exists in image_references table');
    } else {
      // Add the resolution_type column to image_references table
      logger.info('Adding "resolution_type" column to image_references table...');
      db.db.prepare('ALTER TABLE image_references ADD COLUMN resolution_type TEXT NOT NULL DEFAULT "high"').run();
      logger.info('Added resolution_type column to image_references table');
      
      // Recreate the table with new UNIQUE constraint
      logger.info('Recreating image_references table with new UNIQUE constraint...');
      
      db.db.exec(`
        -- Create temporary table with new schema
        CREATE TABLE image_references_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          image_id INTEGER NOT NULL,
          resolution_type TEXT NOT NULL DEFAULT 'high',
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
          UNIQUE(entity_type, entity_id, image_id, resolution_type)
        );
        
        -- Copy data from old table
        INSERT INTO image_references_new SELECT 
          id, entity_type, entity_id, image_id, resolution_type, created_at 
        FROM image_references;
        
        -- Drop old table
        DROP TABLE image_references;
        
        -- Rename new table
        ALTER TABLE image_references_new RENAME TO image_references;
        
        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_image_references_entity ON image_references(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_image_references_image ON image_references(image_id);
      `);
      
      logger.info('Successfully recreated image_references table with UNIQUE(entity_type, entity_id, image_id, resolution_type)');
    }
    
    logger.info('Migration complete! Resolution type system is now active');
    logger.info('All existing images are marked as "high" resolution');
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

logger.info('FM4 Database Migration: Add Resolution Type');
logger.info('This migration adds resolution_type columns to images and image_references tables');
logger.info('');

migrateAddResolutionType();
