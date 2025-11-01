import db from '../database/database.js';
import logger from '../utils/logger.js';

async function migrateAddDoneColumn() {
  try {
    logger.info('Starting migration: Add done column to broadcasts table');
    
    db.initialize();
    
    // Check if column already exists
    const tableInfo = db.db.prepare("PRAGMA table_info(broadcasts)").all();
    const hasDoneColumn = tableInfo.some(col => col.name === 'done');
    
    if (hasDoneColumn) {
      logger.info('Column "done" already exists in broadcasts table, skipping migration');
      db.close();
      process.exit(0);
    }
    
    // Add the done column
    logger.info('Adding "done" column to broadcasts table...');
    db.db.prepare('ALTER TABLE broadcasts ADD COLUMN done BOOLEAN DEFAULT 0').run();
    
    logger.info('Migration complete! Column "done" added successfully');
    logger.info('All existing broadcasts have done = 0 (not done)');
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

logger.info('FM4 Database Migration: Add Done Column');
logger.info('This migration adds a "done" column to the broadcasts table');
logger.info('');

migrateAddDoneColumn();
