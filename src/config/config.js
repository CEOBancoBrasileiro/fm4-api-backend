import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    path: process.env.DATABASE_PATH || join(rootDir, 'data/fm4.db')
  },
  
  fm4: {
    apiBaseUrl: process.env.FM4_API_BASE_URL || 'https://audioapi.orf.at/fm4/json/4.0',
    liveStreamUrl: process.env.FM4_LIVE_STREAM_URL || 'https://orf-live.ors-shoutcast.at/fm4-q2a',
    loopstreamBaseUrl: process.env.FM4_LOOPSTREAM_BASE_URL || 'https://loopstreamfm4.apa.at'
  },
  
  scraper: {
    intervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS) || 6,
    keepHistoryDays: parseInt(process.env.KEEP_HISTORY_DAYS) || 30
  },
  
  images: {
    storagePath: process.env.IMAGE_STORAGE_PATH || join(rootDir, 'data/images'),
    maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH) || 1750
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || join(rootDir, 'logs/app.log')
  }
};
