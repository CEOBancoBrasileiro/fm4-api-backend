import winston from 'winston';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from '../config/config.js';

// Ensure log directory exists
const logDir = dirname(config.logging.file);
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack 
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 104857600, // 100MB - high limit since we rotate daily
      maxFiles: 1 // Only keep current file, rotation handles archives
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Check for log rotation every hour
let logRotation;
setInterval(async () => {
  if (!logRotation) {
    // Lazy load to avoid circular dependency
    logRotation = (await import('./log-rotation.js')).default;
  }
  logRotation.checkAndRotate();
}, 3600000); // Check every hour

export default logger;
