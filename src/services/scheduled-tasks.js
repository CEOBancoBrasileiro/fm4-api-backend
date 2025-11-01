import cron from 'node-cron';
import broadcastScraper from '../services/broadcast-scraper.js';
import fm4Api from './fm4-api.js';
import liveMonitor from './live-monitor.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';
import db from '../database/database.js';

class ScheduledTasks {
  constructor() {
    this.tasks = [];
    this.lastLiveBroadcastId = null;
  }

  async pollLive() {
    try {
      logger.debug('Polling live broadcast');
      const liveData = await fm4Api.getLive();
      
      if (!liveData || !Array.isArray(liveData) || liveData.length === 0) {
        return;
      }

      const currentBroadcast = liveData[0];
      const broadcastId = currentBroadcast.id;
      const programKey = currentBroadcast.programKey;
      const broadcastDay = currentBroadcast.broadcastDay;

      // Check if this is a new broadcast
      if (this.lastLiveBroadcastId !== broadcastId) {
        logger.info(`New live broadcast detected: ${programKey}/${broadcastDay} (ID: ${broadcastId})`);
        this.lastLiveBroadcastId = broadcastId;

        // Always fetch the live broadcast immediately when detected (force fetch to bypass cache)
        logger.info(`Fetching live broadcast instantly: ${programKey}/${broadcastDay}`);
        // scrapeBroadcast will automatically discover and add new program keys
        await broadcastScraper.scrapeBroadcast(programKey, broadcastDay, true);
      }
    } catch (error) {
      logger.error(`Live polling failed: ${error.message}`);
    }
  }

  start() {
    logger.info('Starting scheduled tasks');

    // Start continuous live monitor (checks every 30 seconds)
    liveMonitor.start();

    // Poll live broadcast every 5 minutes (backup to live monitor)
    const liveTask = cron.schedule('*/5 * * * *', async () => {
      await this.pollLive();
    });

    this.tasks.push({ name: 'Live Broadcast Poller', task: liveTask });
    logger.info('Scheduled live broadcast polling (every 5 minutes, backup to live monitor)');

    // Scrape recent broadcasts every N hours
    const scrapeInterval = config.scraper.intervalHours;
    const scrapeCron = `0 */${scrapeInterval} * * *`; // Every N hours on the hour
    
    const scrapeTask = cron.schedule(scrapeCron, async () => {
      logger.info('Running scheduled recent broadcasts scrape');
      try {
        await broadcastScraper.scrapeRecentBroadcasts();
      } catch (error) {
        logger.error(`Scheduled scrape failed: ${error.message}`);
      }
    });

    this.tasks.push({ name: 'Recent Broadcasts Scraper', task: scrapeTask });
    logger.info(`Scheduled recent broadcasts scraper (every ${scrapeInterval} hours)`);

    // Cleanup old broadcasts daily at 3 AM
    const cleanupTask = cron.schedule('0 3 * * *', async () => {
      logger.info('Running scheduled cleanup of old broadcasts');
      try {
        await broadcastScraper.cleanupOldBroadcasts();
      } catch (error) {
        logger.error(`Scheduled cleanup failed: ${error.message}`);
      }
    });

    this.tasks.push({ name: 'Old Broadcasts Cleanup', task: cleanupTask });
    logger.info('Scheduled old broadcasts cleanup (daily at 3 AM)');

    // Discover new program keys daily at 2 AM
    const discoveryTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled program key discovery');
      try {
        await broadcastScraper.discoverProgramKeys();
      } catch (error) {
        logger.error(`Scheduled discovery failed: ${error.message}`);
      }
    });

    this.tasks.push({ name: 'Program Key Discovery', task: discoveryTask });
    logger.info('Scheduled program key discovery (daily at 2 AM)');

    logger.info(`Started ${this.tasks.length} scheduled tasks + live monitor`);
  }

  stop() {
    logger.info('Stopping scheduled tasks');
    
    // Stop live monitor
    liveMonitor.stop();
    
    this.tasks.forEach(({ name, task }) => {
      task.stop();
      logger.info(`Stopped task: ${name}`);
    });
    this.tasks = [];
  }
}

export default new ScheduledTasks();
