import db from '../database/database.js';
import logger from '../utils/logger.js';

/**
 * Initialize FTS tables if they don't exist
 * Can be called from other scripts
 * @param {boolean} closeDb - Whether to close the database connection after (default: false)
 * @returns {boolean} - True if FTS was created/already exists, false on error
 */
export async function initializeFTS(closeDb = false) {
  try {
    // Check if database is initialized
    if (!db.db) {
      db.initialize();
    }
    
    // Check if FTS tables already exist
    const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'broadcasts_fts%'").all();
    
    if (tables.length > 0) {
      logger.info('FTS tables already exist');
      if (closeDb) db.close();
      return true;
    }
    
    logger.info('Starting Full-Text Search (FTS5) initialization...');
    
    logger.info('Creating FTS5 virtual table for broadcasts...');
    
    // Create FTS5 virtual table for broadcasts
    db.db.exec(`
      CREATE VIRTUAL TABLE broadcasts_fts USING fts5(
        program_key,
        title,
        subtitle,
        description,
        moderator,
        program,
        content='broadcasts',
        content_rowid='id',
        tokenize='porter unicode61 remove_diacritics 2'
      );
    `);
    
    logger.info('Creating FTS5 virtual table for broadcast items...');
    
    // Create FTS5 virtual table for broadcast items
    db.db.exec(`
      CREATE VIRTUAL TABLE broadcast_items_fts USING fts5(
        item_id UNINDEXED,
        broadcast_id UNINDEXED,
        type,
        title,
        interpreter,
        description,
        content='broadcast_items',
        content_rowid='id',
        tokenize='porter unicode61 remove_diacritics 2'
      );
    `);
    
    logger.info('Creating triggers to keep FTS tables in sync...');
    
    // Triggers for broadcasts
    db.db.exec(`
      -- Insert trigger
      CREATE TRIGGER broadcasts_fts_insert AFTER INSERT ON broadcasts BEGIN
        INSERT INTO broadcasts_fts(rowid, program_key, title, subtitle, description, moderator, program)
        VALUES (new.id, new.program_key, new.title, new.subtitle, new.description, new.moderator, new.program);
      END;
      
      -- Update trigger
      CREATE TRIGGER broadcasts_fts_update AFTER UPDATE ON broadcasts BEGIN
        UPDATE broadcasts_fts SET 
          program_key = new.program_key,
          title = new.title,
          subtitle = new.subtitle,
          description = new.description,
          moderator = new.moderator,
          program = new.program
        WHERE rowid = new.id;
      END;
      
      -- Delete trigger
      CREATE TRIGGER broadcasts_fts_delete AFTER DELETE ON broadcasts BEGIN
        DELETE FROM broadcasts_fts WHERE rowid = old.id;
      END;
    `);
    
    // Triggers for broadcast_items
    db.db.exec(`
      -- Insert trigger
      CREATE TRIGGER broadcast_items_fts_insert AFTER INSERT ON broadcast_items BEGIN
        INSERT INTO broadcast_items_fts(rowid, item_id, broadcast_id, type, title, interpreter, description)
        VALUES (new.id, new.item_id, new.broadcast_id, new.type, new.title, new.interpreter, new.description);
      END;
      
      -- Update trigger
      CREATE TRIGGER broadcast_items_fts_update AFTER UPDATE ON broadcast_items BEGIN
        UPDATE broadcast_items_fts SET 
          item_id = new.item_id,
          broadcast_id = new.broadcast_id,
          type = new.type,
          title = new.title,
          interpreter = new.interpreter,
          description = new.description
        WHERE rowid = new.id;
      END;
      
      -- Delete trigger
      CREATE TRIGGER broadcast_items_fts_delete AFTER DELETE ON broadcast_items BEGIN
        DELETE FROM broadcast_items_fts WHERE rowid = old.id;
      END;
    `);
    
    logger.info('Populating FTS tables with existing data...');
    
    // Populate broadcasts FTS table
    db.db.exec(`
      INSERT INTO broadcasts_fts(rowid, program_key, title, subtitle, description, moderator, program)
      SELECT id, program_key, title, subtitle, description, moderator, program FROM broadcasts;
    `);
    
    const broadcastCount = db.db.prepare('SELECT COUNT(*) as count FROM broadcasts_fts').get();
    logger.info(`Indexed ${broadcastCount.count} broadcasts`);
    
    // Populate broadcast_items FTS table
    db.db.exec(`
      INSERT INTO broadcast_items_fts(rowid, item_id, broadcast_id, type, title, interpreter, description)
      SELECT id, item_id, broadcast_id, type, title, interpreter, description FROM broadcast_items;
    `);
    
    const itemsCount = db.db.prepare('SELECT COUNT(*) as count FROM broadcast_items_fts').get();
    logger.info(`Indexed ${itemsCount.count} broadcast items`);
    
    logger.info('Full-Text Search initialization complete!');
    logger.info('You can now search broadcasts and items using natural language queries');
    
    if (closeDb) db.close();
    return true;
  } catch (error) {
    logger.error('FTS initialization failed:', error);
    if (closeDb) db.close();
    return false;
  }
}

async function migrateAddFTS() {
  try {
    logger.info('FM4 Database Migration: Add Full-Text Search (FTS5)');
    logger.info('This migration adds FTS5 virtual tables for fast full-text search');
    logger.info('');
    
    const success = await initializeFTS(true);
    process.exit(success ? 0 : 1);
  } catch (error) {
    logger.error('Migration failed:', error);
    db.close();
    process.exit(1);
  }
}

// Only run if this file is being executed directly (not imported)
// Check if process.argv[1] exists and matches this file
const isMainModule = process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  migrateAddFTS();
}
