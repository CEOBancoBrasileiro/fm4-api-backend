import db from '../database/database.js';
import logger from '../utils/logger.js';

async function initDatabase() {
  try {
    logger.info('Initializing FM4 database...');
    
    db.initialize();
    
    logger.info('Database initialized successfully');
    logger.info('Database location: ' + db.db.name);
    
    // Set initial metadata
    db.setMetadata('initialized_at', Date.now().toString());
    db.setMetadata('version', '1.0.0');
    
    logger.info('Initial metadata set');
    logger.info('Database initialization complete!');
    
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
