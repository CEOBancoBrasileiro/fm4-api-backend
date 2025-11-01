import db from '../database/database.js';
import logger from '../utils/logger.js';

async function migrateAddOffsetsDuration() {
  try {
    logger.info('Starting migration: Add offsets and duration columns');
    
    db.initialize();
    
    // Check broadcasts table
    const broadcastsTableInfo = db.db.prepare("PRAGMA table_info(broadcasts)").all();
    const hasDuration = broadcastsTableInfo.some(col => col.name === 'duration');
    
    if (!hasDuration) {
      logger.info('Adding "duration" column to broadcasts table...');
      db.db.prepare('ALTER TABLE broadcasts ADD COLUMN duration INTEGER').run();
      logger.info('Added duration column to broadcasts table');
    } else {
      logger.info('Column "duration" already exists in broadcasts table');
    }
    
    // Check broadcast_items table
    const itemsTableInfo = db.db.prepare("PRAGMA table_info(broadcast_items)").all();
    const hasStartOffset = itemsTableInfo.some(col => col.name === 'start_offset');
    const hasEndOffset = itemsTableInfo.some(col => col.name === 'end_offset');
    
    if (!hasStartOffset) {
      logger.info('Adding "start_offset" column to broadcast_items table...');
      db.db.prepare('ALTER TABLE broadcast_items ADD COLUMN start_offset INTEGER').run();
      logger.info('Added start_offset column to broadcast_items table');
    } else {
      logger.info('Column "start_offset" already exists in broadcast_items table');
    }
    
    if (!hasEndOffset) {
      logger.info('Adding "end_offset" column to broadcast_items table...');
      db.db.prepare('ALTER TABLE broadcast_items ADD COLUMN end_offset INTEGER').run();
      logger.info('Added end_offset column to broadcast_items table');
    } else {
      logger.info('Column "end_offset" already exists in broadcast_items table');
    }
    
    // Calculate and update existing broadcasts duration
    logger.info('Calculating duration for existing broadcasts...');
    const broadcasts = db.db.prepare(`
      SELECT id, start_time, end_time 
      FROM broadcasts 
      WHERE start_time IS NOT NULL AND end_time IS NOT NULL
    `).all();
    
    let updatedBroadcasts = 0;
    for (const broadcast of broadcasts) {
      const duration = broadcast.end_time - broadcast.start_time;
      db.db.prepare('UPDATE broadcasts SET duration = ? WHERE id = ?').run(duration, broadcast.id);
      updatedBroadcasts++;
    }
    logger.info(`Updated duration for ${updatedBroadcasts} broadcasts`);
    
    // Calculate and update existing broadcast items offsets
    logger.info('Calculating offsets for existing broadcast items...');
    const items = db.db.prepare(`
      SELECT bi.id, bi.broadcast_id, bi.start_time, bi.end_time, b.start_time as broadcast_start
      FROM broadcast_items bi
      JOIN broadcasts b ON bi.broadcast_id = b.id
      WHERE bi.start_time IS NOT NULL AND b.start_time IS NOT NULL
    `).all();
    
    let updatedItems = 0;
    for (const item of items) {
      const startOffset = item.start_time - item.broadcast_start;
      const endOffset = item.end_time ? item.end_time - item.broadcast_start : null;
      
      db.db.prepare(`
        UPDATE broadcast_items 
        SET start_offset = ?, end_offset = ? 
        WHERE id = ?
      `).run(startOffset, endOffset, item.id);
      updatedItems++;
    }
    logger.info(`Updated offsets for ${updatedItems} broadcast items`);
    
    logger.info('Migration complete!');
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

logger.info('FM4 Database Migration: Add Offsets and Duration');
logger.info('This migration adds duration to broadcasts and start_offset/end_offset to broadcast items');
logger.info('');

migrateAddOffsetsDuration();
