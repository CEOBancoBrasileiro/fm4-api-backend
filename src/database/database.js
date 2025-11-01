import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { createTables } from './schema.js';

class DatabaseService {
  constructor() {
    this.db = null;
  }

  initialize() {
    try {
      const dbDir = dirname(config.database.path);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(config.database.path);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      createTables(this.db);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  // Broadcast operations
  insertBroadcast(broadcast) {
    // Calculate duration if start and end times are available
    const duration = (broadcast.start && broadcast.end) 
      ? broadcast.end - broadcast.start 
      : null;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO broadcasts (
        id, broadcast_day, program_key, program, title, subtitle, state,
        is_on_demand, is_geo_protected, is_ad_free, start_time, start_iso,
        end_time, end_iso, scheduled_start, scheduled_end, nice_time,
        nice_time_iso, description, moderator, url, loop_stream_id,
        loop_stream_start, loop_stream_end, duration, done, updated_at
      ) VALUES (
        @id, @broadcastDay, @programKey, @program, @title, @subtitle, @state,
        @isOnDemand, @isGeoProtected, @isAdFree, @start, @startISO,
        @end, @endISO, @scheduledStart, @scheduledEnd, @niceTime,
        @niceTimeISO, @description, @moderator, @url, @loopStreamId,
        @loopStreamStart, @loopStreamEnd, @duration, @done, strftime('%s', 'now')
      )
    `);

    return stmt.run({
      id: broadcast.id,
      broadcastDay: broadcast.broadcastDay,
      programKey: broadcast.programKey,
      program: broadcast.program,
      title: broadcast.title,
      subtitle: broadcast.subtitle,
      state: broadcast.state,
      isOnDemand: broadcast.isOnDemand ? 1 : 0,
      isGeoProtected: broadcast.isGeoProtected ? 1 : 0,
      isAdFree: broadcast.isAdFree ? 1 : 0,
      start: broadcast.start,
      startISO: broadcast.startISO,
      end: broadcast.end,
      endISO: broadcast.endISO,
      scheduledStart: broadcast.scheduledStart,
      scheduledEnd: broadcast.scheduledEnd,
      niceTime: broadcast.niceTime,
      niceTimeISO: broadcast.niceTimeISO,
      description: broadcast.description,
      moderator: broadcast.moderator,
      url: broadcast.url,
      loopStreamId: broadcast.loopStreamId || null,
      loopStreamStart: broadcast.loopStreamStart || null,
      loopStreamEnd: broadcast.loopStreamEnd || null,
      duration: duration,
      done: broadcast.done ? 1 : 0
    });
  }

  getBroadcast(broadcastDay, programKey) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcasts 
      WHERE broadcast_day = ? AND program_key = ?
    `);
    return stmt.get(broadcastDay, programKey);
  }

  getBroadcastById(id) {
    const stmt = this.db.prepare('SELECT * FROM broadcasts WHERE id = ?');
    return stmt.get(id);
  }

  getBroadcastsByDateRange(startDay, endDay) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcasts 
      WHERE broadcast_day >= ? AND broadcast_day <= ?
      ORDER BY start_time DESC
    `);
    return stmt.all(startDay, endDay);
  }

  getAllBroadcasts(limit = 1000) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcasts 
      ORDER BY start_time DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  deleteBroadcastsOlderThan(timestamp) {
    const stmt = this.db.prepare('DELETE FROM broadcasts WHERE start_time < ?');
    return stmt.run(timestamp);
  }

  markBroadcastAsDone(broadcastId) {
    const stmt = this.db.prepare(`
      UPDATE broadcasts 
      SET done = 1, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);
    return stmt.run(broadcastId);
  }

  markBroadcastAsDoneByDayAndKey(broadcastDay, programKey) {
    const stmt = this.db.prepare(`
      UPDATE broadcasts 
      SET done = 1, updated_at = strftime('%s', 'now')
      WHERE broadcast_day = ? AND program_key = ?
    `);
    return stmt.run(broadcastDay, programKey);
  }

  // Broadcast item operations
  insertBroadcastItem(item, broadcastId) {
    // Get broadcast start time for offset calculation
    const broadcastStmt = this.db.prepare(`
      SELECT start_time FROM broadcasts WHERE id = ?
    `);
    const broadcast = broadcastStmt.get(broadcastId);
    const broadcastStart = broadcast?.start_time;

    // Calculate offsets if we have broadcast start time and item times
    const startOffset = (broadcastStart && item.start) 
      ? item.start - broadcastStart 
      : null;
    const endOffset = (broadcastStart && item.end) 
      ? item.end - broadcastStart 
      : null;

    // First check if item already exists
    const checkStmt = this.db.prepare(`
      SELECT id FROM broadcast_items 
      WHERE broadcast_id = ? AND item_id = ?
    `);
    const existing = checkStmt.get(broadcastId, item.item_id);
    
    if (existing) {
      // Update existing item
      const updateStmt = this.db.prepare(`
        UPDATE broadcast_items SET
          broadcast_day = @broadcastDay,
          program_key = @programKey,
          type = @type,
          title = @title,
          interpreter = @interpreter,
          description = @description,
          state = @state,
          is_on_demand = @isOnDemand,
          is_geo_protected = @isGeoProtected,
          is_completed = @isCompleted,
          duration = @duration,
          song_id = @songId,
          is_ad_free = @isAdFree,
          start_time = @start,
          start_iso = @startISO,
          end_time = @end,
          end_iso = @endISO,
          start_offset = @startOffset,
          end_offset = @endOffset
        WHERE id = @id
      `);
      
      updateStmt.run({
        id: existing.id,
        broadcastDay: item.broadcastDay,
        programKey: item.programKey,
        type: item.type,
        title: item.title || null,
        interpreter: item.interpreter || null,
        description: item.description,
        state: item.state,
        isOnDemand: item.isOnDemand ? 1 : 0,
        isGeoProtected: item.isGeoProtected ? 1 : 0,
        isCompleted: item.isCompleted ? 1 : 0,
        duration: item.duration,
        songId: item.songId,
        isAdFree: item.isAdFree ? 1 : 0,
        start: item.start,
        startISO: item.startISO,
        end: item.end,
        endISO: item.endISO,
        startOffset: startOffset,
        endOffset: endOffset
      });
      
      return { lastInsertRowid: existing.id, changes: 1 };
    } else {
      // Insert new item
      const insertStmt = this.db.prepare(`
        INSERT INTO broadcast_items (
          broadcast_id, item_id, broadcast_day, program_key, type, title,
          interpreter, description, state, is_on_demand, is_geo_protected,
          is_completed, duration, song_id, is_ad_free, start_time, start_iso,
          end_time, end_iso, start_offset, end_offset
        ) VALUES (
          @broadcastId, @itemId, @broadcastDay, @programKey, @type, @title,
          @interpreter, @description, @state, @isOnDemand, @isGeoProtected,
          @isCompleted, @duration, @songId, @isAdFree, @start, @startISO,
          @end, @endISO, @startOffset, @endOffset
        )
      `);

      return insertStmt.run({
        broadcastId: broadcastId,
        itemId: item.item_id,
        broadcastDay: item.broadcastDay,
        programKey: item.programKey,
        type: item.type,
        title: item.title || null,
        interpreter: item.interpreter || null,
        description: item.description,
        state: item.state,
        isOnDemand: item.isOnDemand ? 1 : 0,
        isGeoProtected: item.isGeoProtected ? 1 : 0,
        isCompleted: item.isCompleted ? 1 : 0,
        duration: item.duration,
        songId: item.songId,
        isAdFree: item.isAdFree ? 1 : 0,
        start: item.start,
        startISO: item.startISO,
        end: item.end,
        endISO: item.endISO,
        startOffset: startOffset,
        endOffset: endOffset
      });
    }
  }

  getBroadcastItems(broadcastId) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcast_items 
      WHERE broadcast_id = ?
      ORDER BY start_time ASC
    `);
    return stmt.all(broadcastId);
  }

  getBroadcastItemById(itemId) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcast_items 
      WHERE id = ?
    `);
    return stmt.get(itemId);
  }

  getBroadcastItemByItemId(itemId) {
    const stmt = this.db.prepare(`
      SELECT * FROM broadcast_items 
      WHERE item_id = ?
    `);
    return stmt.get(itemId);
  }

  // Image operations
  insertImage(image) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO images (
        hash, resolution_type, original_hash_code, alt, text, category, copyright, mode,
        file_path, width, height, file_size
      ) VALUES (
        @hash, @resolutionType, @originalHashCode, @alt, @text, @category, @copyright, @mode,
        @filePath, @width, @height, @fileSize
      )
    `);

    return stmt.run({
      hash: image.hash,
      resolutionType: image.resolutionType || 'high',
      originalHashCode: image.originalHashCode || null,
      alt: image.alt || null,
      text: image.text || null,
      category: image.category || null,
      copyright: image.copyright || null,
      mode: image.mode || null,
      filePath: image.filePath,
      width: image.width || null,
      height: image.height || null,
      fileSize: image.fileSize || null
    });
  }

  getImageByHash(hash, resolutionType = 'high') {
    const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ? AND resolution_type = ?');
    return stmt.get(hash, resolutionType);
  }

  getImagesByHash(hash) {
    const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ? ORDER BY resolution_type');
    return stmt.all(hash);
  }

  // Image reference operations (new unified system)
  addImageReference(entityType, entityId, imageId, resolutionType = 'high') {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO image_references (entity_type, entity_id, image_id, resolution_type)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(entityType, entityId, imageId, resolutionType);
  }

  getImageReferences(entityType, entityId, resolutionType = null) {
    if (resolutionType) {
      const stmt = this.db.prepare(`
        SELECT i.* FROM images i
        JOIN image_references ir ON i.id = ir.image_id
        WHERE ir.entity_type = ? AND ir.entity_id = ? AND ir.resolution_type = ?
      `);
      return stmt.all(entityType, entityId, resolutionType);
    } else {
      const stmt = this.db.prepare(`
        SELECT i.* FROM images i
        JOIN image_references ir ON i.id = ir.image_id
        WHERE ir.entity_type = ? AND ir.entity_id = ?
        ORDER BY i.resolution_type
      `);
      return stmt.all(entityType, entityId);
    }
  }

  getImageReferencesByResolution(entityType, entityId) {
    const stmt = this.db.prepare(`
      SELECT i.*, ir.resolution_type as ref_resolution_type FROM images i
      JOIN image_references ir ON i.id = ir.image_id
      WHERE ir.entity_type = ? AND ir.entity_id = ?
      ORDER BY ir.resolution_type
    `);
    return stmt.all(entityType, entityId);
  }

  getImageReferenceCount(imageId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM image_references WHERE image_id = ?
    `);
    return stmt.get(imageId).count;
  }

  deleteUnreferencedImages() {
    const stmt = this.db.prepare(`
      DELETE FROM images WHERE id NOT IN (
        SELECT DISTINCT image_id FROM image_references
      )
    `);
    return stmt.run();
  }

  // Program key operations
  insertProgramKey(programKey, title = null) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO program_keys (program_key, title, last_seen)
      VALUES (?, ?, strftime('%s', 'now'))
    `);
    return stmt.run(programKey, title);
  }

  getAllProgramKeys() {
    const stmt = this.db.prepare('SELECT * FROM program_keys ORDER BY program_key');
    return stmt.all();
  }

  // Metadata operations
  setMetadata(key, value) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metadata (key, value, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `);
    return stmt.run(key, value);
  }

  getMetadata(key) {
    const stmt = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    const result = stmt.get(key);
    return result ? result.value : null;
  }

  // Transaction support
  transaction(callback) {
    const txn = this.db.transaction(callback);
    return txn();
  }

  // Full-Text Search operations
  searchBroadcasts(query, limit = 50, offset = 0) {
    // Clean and prepare the query for FTS5
    const cleanQuery = query.trim().replace(/[^\w\s\-]/g, '');
    if (!cleanQuery) return [];

    const stmt = this.db.prepare(`
      SELECT 
        b.*,
        bm25(broadcasts_fts) as rank,
        snippet(broadcasts_fts, 2, '<mark>', '</mark>', '...', 32) as title_snippet,
        snippet(broadcasts_fts, 4, '<mark>', '</mark>', '...', 64) as description_snippet
      FROM broadcasts_fts
      JOIN broadcasts b ON broadcasts_fts.rowid = b.id
      WHERE broadcasts_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(cleanQuery, limit, offset);
  }

  searchBroadcastItems(query, limit = 50, offset = 0) {
    // Clean and prepare the query for FTS5
    const cleanQuery = query.trim().replace(/[^\w\s\-]/g, '');
    if (!cleanQuery) return [];

    const stmt = this.db.prepare(`
      SELECT 
        bi.*,
        bm25(broadcast_items_fts) as rank,
        snippet(broadcast_items_fts, 3, '<mark>', '</mark>', '...', 32) as title_snippet,
        snippet(broadcast_items_fts, 4, '<mark>', '</mark>', '...', 32) as interpreter_snippet
      FROM broadcast_items_fts
      JOIN broadcast_items bi ON broadcast_items_fts.rowid = bi.id
      WHERE broadcast_items_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(cleanQuery, limit, offset);
  }

  searchAll(query, limit = 25) {
    // Search both broadcasts and items
    const broadcasts = this.searchBroadcasts(query, limit);
    const items = this.searchBroadcastItems(query, limit);
    
    return {
      broadcasts,
      items,
      total: broadcasts.length + items.length
    };
  }

  // Count search results
  countSearchBroadcasts(query) {
    const cleanQuery = query.trim().replace(/[^\w\s\-]/g, '');
    if (!cleanQuery) return 0;

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM broadcasts_fts
      WHERE broadcasts_fts MATCH ?
    `);
    
    return stmt.get(cleanQuery).count;
  }

  countSearchBroadcastItems(query) {
    const cleanQuery = query.trim().replace(/[^\w\s\-]/g, '');
    if (!cleanQuery) return 0;

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM broadcast_items_fts
      WHERE broadcast_items_fts MATCH ?
    `);
    
    return stmt.get(cleanQuery).count;
  }
}

export default new DatabaseService();
