export const createTables = (db) => {
  // Broadcasts table - stores main broadcast information
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY,
      broadcast_day INTEGER NOT NULL,
      program_key TEXT NOT NULL,
      program TEXT,
      title TEXT,
      subtitle TEXT,
      state TEXT,
      is_on_demand BOOLEAN,
      is_geo_protected BOOLEAN,
      is_ad_free BOOLEAN,
      start_time INTEGER,
      start_iso TEXT,
      end_time INTEGER,
      end_iso TEXT,
      scheduled_start INTEGER,
      scheduled_end INTEGER,
      nice_time INTEGER,
      nice_time_iso TEXT,
      description TEXT,
      moderator TEXT,
      url TEXT,
      loop_stream_id TEXT,
      loop_stream_start INTEGER,
      loop_stream_end INTEGER,
      duration INTEGER,
      done BOOLEAN DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      UNIQUE(broadcast_day, program_key)
    )
  `);

  // Broadcast items table - stores individual songs, jingles, ads within broadcasts
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcast_items (
      id INTEGER PRIMARY KEY,
      broadcast_id INTEGER NOT NULL,
      item_id INTEGER,
      broadcast_day INTEGER,
      program_key TEXT,
      type TEXT,
      title TEXT,
      interpreter TEXT,
      description TEXT,
      state TEXT,
      is_on_demand BOOLEAN,
      is_geo_protected BOOLEAN,
      is_completed BOOLEAN,
      duration INTEGER,
      song_id TEXT,
      is_ad_free BOOLEAN,
      start_time INTEGER,
      start_iso TEXT,
      end_time INTEGER,
      end_iso TEXT,
      start_offset INTEGER,
      end_offset INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
    )
  `);

  // Images table - stores image metadata and local file paths
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
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
    )
  `);

  // Image references table - tracks all references to images from broadcasts and items
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      image_id INTEGER NOT NULL,
      resolution_type TEXT NOT NULL DEFAULT 'high',
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      UNIQUE(entity_type, entity_id, image_id, resolution_type)
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_image_references_entity ON image_references(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_image_references_image ON image_references(image_id)`);

  // Program keys table - stores discovered program keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS program_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_key TEXT UNIQUE NOT NULL,
      title TEXT,
      last_seen INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Metadata table - stores system metadata like last scrape time
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_broadcasts_day ON broadcasts(broadcast_day);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_program_key ON broadcasts(program_key);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_start_time ON broadcasts(start_time);
    CREATE INDEX IF NOT EXISTS idx_broadcast_items_broadcast_id ON broadcast_items(broadcast_id);
    CREATE INDEX IF NOT EXISTS idx_broadcast_items_type ON broadcast_items(type);
    CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
    CREATE INDEX IF NOT EXISTS idx_program_keys_key ON program_keys(program_key);
  `);
};
