import { existsSync, renameSync, unlinkSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { createRequire } from 'module';
import config from '../config/config.js';

const require = createRequire(import.meta.url);
const { compress } = require('@mongodb-js/zstd');

class LogRotation {
  constructor() {
    this.logPath = config.logging.file;
    this.rotationCache = [];
    this.isRotating = false;
    this.lastRotationDate = this.getCurrentDate();
  }

  getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  shouldRotate() {
    const currentDate = this.getCurrentDate();
    return currentDate !== this.lastRotationDate;
  }

  async rotateLog() {
    if (this.isRotating) {
      // Already rotating, cache this log entry
      return;
    }

    this.isRotating = true;
    const oldDate = this.lastRotationDate;
    const currentDate = this.getCurrentDate();

    try {
      // Check if log file exists
      if (!existsSync(this.logPath)) {
        this.lastRotationDate = currentDate;
        this.isRotating = false;
        return;
      }

      // Read current log content
      const logContent = readFileSync(this.logPath, 'utf8');
      
      // Create compressed archive name
      const logDir = dirname(this.logPath);
      const archivePath = join(logDir, `${oldDate}.log.zstd`);

      // Compress log content using zstd
      const compressed = await compress(Buffer.from(logContent, 'utf8'));
      
      // Write compressed file
      writeFileSync(archivePath, compressed);

      // Clear current log file
      writeFileSync(this.logPath, '');

      // Update rotation date
      this.lastRotationDate = currentDate;

      // Process cached logs
      if (this.rotationCache.length > 0) {
        const cachedLogs = this.rotationCache.join('\n') + '\n';
        appendFileSync(this.logPath, cachedLogs);
        this.rotationCache = [];
      }

      console.log(`[LOG ROTATION] Rotated log to ${archivePath} (${(compressed.length / 1024).toFixed(2)} KB)`);
    } catch (error) {
      console.error(`[LOG ROTATION] Failed to rotate log: ${error.message}`);
    } finally {
      this.isRotating = false;
    }
  }

  cacheLogEntry(message) {
    if (this.isRotating) {
      this.rotationCache.push(message);
    }
  }

  checkAndRotate() {
    if (this.shouldRotate()) {
      this.rotateLog();
    }
  }
}

export default new LogRotation();
