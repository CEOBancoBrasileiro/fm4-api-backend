import fm4Api from './fm4-api.js';
import imageService from './image-service.js';
import db from '../database/database.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class BroadcastScraper {
  constructor() {
    this.isRunning = false;
    this.knownProgramKeys = new Set();
  }

  async initialize() {
    // Load known program keys from database
    const programKeys = db.getAllProgramKeys();
    programKeys.forEach(pk => this.knownProgramKeys.add(pk.program_key));
    logger.info(`Loaded ${this.knownProgramKeys.size} known program keys`);
  }

  async discoverProgramKeys() {
    try {
      logger.info('Discovering program keys from current broadcasts...');
      const broadcastsData = await fm4Api.getBroadcasts();
      
      if (!Array.isArray(broadcastsData)) {
        logger.warn('Broadcasts data is not an array');
        return;
      }

      let newKeys = 0;
      for (const dayData of broadcastsData) {
        if (!dayData.broadcasts) continue;
        
        for (const broadcast of dayData.broadcasts) {
          if (broadcast.programKey && !this.knownProgramKeys.has(broadcast.programKey)) {
            this.knownProgramKeys.add(broadcast.programKey);
            db.insertProgramKey(broadcast.programKey, broadcast.title);
            newKeys++;
            logger.info(`Discovered new program key: ${broadcast.programKey} (${broadcast.title})`);
          }
        }
      }

      logger.info(`Discovery complete. Found ${newKeys} new program keys. Total: ${this.knownProgramKeys.size}`);
    } catch (error) {
      logger.error(`Failed to discover program keys: ${error.message}`);
    }
  }

  async scrapeBroadcast(programKey, broadcastDay, forceFetch = false) {
    try {
      // Check if broadcast already exists in database
      const existing = db.getBroadcast(broadcastDay, programKey);
      
      // If broadcast is marked as done, skip scraping entirely
      if (existing && existing.done) {
        logger.debug(`Broadcast ${programKey}/${broadcastDay} is marked as done, skipping`);
        return existing;
      }

      // If broadcast exists and is recent, skip (unless forceFetch is true)
      if (!forceFetch && existing && (Date.now() / 1000 - existing.updated_at) < 3600) {
        logger.debug(`Broadcast ${programKey}/${broadcastDay} recently updated, skipping`);
        return existing;
      }

      const broadcastData = await fm4Api.getBroadcastWithRetry(programKey, broadcastDay);
      
      if (!broadcastData) {
        return null;
      }

      // Always check and add program key if new
      if (!this.knownProgramKeys.has(programKey)) {
        logger.info(`Discovered new program key during scrape: ${programKey} (${broadcastData.title})`);
        db.insertProgramKey(programKey, broadcastData.title);
        this.knownProgramKeys.add(programKey);
      }

      // Extract loopstream info
      let loopStreamId = null;
      let loopStreamStart = null;
      let loopStreamEnd = null;
      
      if (broadcastData.streams && broadcastData.streams.length > 0) {
        const stream = broadcastData.streams[0];
        loopStreamId = stream.loopStreamId;
        loopStreamStart = stream.start;
        loopStreamEnd = stream.end;
      }

      // Prepare broadcast record
      const broadcastRecord = {
        ...broadcastData,
        loopStreamId,
        loopStreamStart,
        loopStreamEnd
      };

      // Save broadcast using transaction
      const result = db.transaction(() => {
        // Insert broadcast
        db.insertBroadcast(broadcastRecord);
        const savedBroadcast = db.getBroadcast(broadcastDay, programKey);
        return savedBroadcast;
      });

      // Process images outside transaction (async operations)
      if (broadcastData.images && broadcastData.images.length > 0) {
        const processedImages = await imageService.processBroadcastImages(broadcastData, result.id);
        logger.debug(`Broadcast ${result.id}: ${processedImages.length} images (${processedImages.filter(img => img.alreadyExisted).length} cached)`);
      } else {
        logger.debug(`No images for broadcast ${programKey}/${broadcastDay}`);
      }

      // Process broadcast items
      if (broadcastData.items && broadcastData.items.length > 0) {
        logger.debug(`Processing ${broadcastData.items.length} items for ${programKey}/${broadcastDay}`);
        
        // Get existing items for this broadcast to avoid re-processing
        const existingItems = db.getBroadcastItems(result.id);
        const existingItemIds = new Set(existingItems.map(item => item.item_id));
        
        for (const item of broadcastData.items) {
          const itemId = item.id;
          
          // Skip if item already exists in database
          if (existingItemIds.has(itemId)) {
            logger.debug(`Item ${itemId} already exists, skipping`);
            continue;
          }
          
          // Transform item to have item_id field (FM4 API uses 'id', we store as 'item_id')
          const itemRecord = {
            item_id: itemId,
            broadcastDay: item.broadcastDay,
            programKey: item.programKey,
            type: item.type,
            title: item.title,
            interpreter: item.interpreter,
            description: item.description,
            state: item.state,
            isOnDemand: item.isOnDemand,
            isGeoProtected: item.isGeoProtected,
            isCompleted: item.isCompleted,
            duration: item.duration,
            songId: item.songId,
            isAdFree: item.isAdFree,
            start: item.start,
            startISO: item.startISO,
            end: item.end,
            endISO: item.endISO
          };
          
          db.insertBroadcastItem(itemRecord, result.id);
          const savedItem = db.getBroadcastItems(result.id)
            .find(i => i.item_id === itemId);

          // Process and link item images (including fallbacks)
          if (savedItem && item.images && item.images.length > 0) {
            await imageService.processBroadcastItemImages(item, savedItem.id);
          }
        }
      }

      // Check if broadcast has ended and mark as done
      const now = Date.now();
      if (broadcastData.end && broadcastData.end < now) {
        logger.debug(`Broadcast ${programKey}/${broadcastDay} has ended, marking as done`);
        db.markBroadcastAsDone(result.id);
        result.done = 1; // Update local object
      }

      logger.info(`Scraped broadcast: ${programKey}/${broadcastDay} - ${broadcastData.title}`);
      return result;
    } catch (error) {
      logger.error(`Failed to scrape broadcast ${programKey}/${broadcastDay}: ${error.message}`);
      return null;
    }
  }

  async scrapeHistoricalBroadcasts(daysBack = 30) {
    if (this.isRunning) {
      logger.warn('Scraper is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting historical scrape for ${daysBack} days`);

    try {
      // First, fetch live broadcasts to get most recent data
      logger.info('Fetching live broadcasts...');
      const liveData = await fm4Api.getLive();
      if (liveData && Array.isArray(liveData) && liveData.length > 0) {
        for (const liveBroadcast of liveData) {
          await this.scrapeBroadcast(liveBroadcast.programKey, liveBroadcast.broadcastDay, true);
        }
      }

      // Then fetch broadcasts endpoint to see what's available
      logger.info('Fetching broadcasts list to determine available days...');
      const broadcastsData = await fm4Api.getBroadcasts();
      
      // Discover program keys from broadcasts
      await this.discoverProgramKeys();

      // Collect days that are already in the broadcasts endpoint
      const daysInBroadcasts = new Set();
      if (Array.isArray(broadcastsData)) {
        for (const dayData of broadcastsData) {
          if (dayData.day) {
            daysInBroadcasts.add(dayData.day);
            // Scrape broadcasts from this day that are listed
            if (dayData.broadcasts && dayData.broadcasts.length > 0) {
              for (const broadcast of dayData.broadcasts) {
                await this.scrapeBroadcast(broadcast.programKey, dayData.day);
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
        }
      }

      // Find the oldest day in broadcasts endpoint
      let oldestDay = null;
      if (daysInBroadcasts.size > 0) {
        oldestDay = Math.min(...Array.from(daysInBroadcasts));
        logger.info(`Oldest day in broadcasts endpoint: ${oldestDay} (${daysInBroadcasts.size} days available)`);
      }

      // Calculate how many additional historical days we need to scrape
      const today = new Date();
      const daysAlreadyScraped = daysInBroadcasts.size;
      const additionalDaysNeeded = Math.max(0, daysBack - daysAlreadyScraped);

      if (additionalDaysNeeded > 0) {
        logger.info(`Scraping ${additionalDaysNeeded} additional historical days (${daysBack} requested - ${daysAlreadyScraped} already available)`);
        
        const programKeys = Array.from(this.knownProgramKeys);
        let totalScraped = 0;
        let totalFailed = 0;

        // Start from the day after the oldest in broadcasts, going backwards
        const startOffset = oldestDay ? this.getDaysDifference(oldestDay, fm4Api.formatBroadcastDay(today)) : 0;

        for (let i = 0; i < additionalDaysNeeded; i++) {
          const daysAgo = startOffset + i + 1; // +1 to start from day after oldest
          const date = new Date(today);
          date.setDate(date.getDate() - daysAgo);
          const broadcastDay = fm4Api.formatBroadcastDay(date);

          // Skip if already scraped
          if (daysInBroadcasts.has(broadcastDay)) {
            continue;
          }

          logger.info(`Scraping historical day ${i + 1}/${additionalDaysNeeded}: ${broadcastDay} (${daysAgo} days ago)`);

          for (const programKey of programKeys) {
            const result = await this.scrapeBroadcast(programKey, broadcastDay);
            if (result) {
              totalScraped++;
            } else {
              totalFailed++;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        logger.info(`Additional historical scrape complete. Scraped: ${totalScraped}, Failed/Not Found: ${totalFailed}`);
      } else {
        logger.info(`All ${daysBack} days already available in broadcasts endpoint, no additional scraping needed`);
      }

      logger.info(`Total program keys known: ${this.knownProgramKeys.size}`);
      db.setMetadata('last_full_scrape', Date.now().toString());
    } catch (error) {
      logger.error(`Historical scrape failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  getDaysDifference(olderDay, newerDay) {
    // Convert YYYYMMDD to Date objects and calculate difference
    const older = new Date(
      Math.floor(olderDay / 10000),
      Math.floor((olderDay % 10000) / 100) - 1,
      olderDay % 100
    );
    const newer = new Date(
      Math.floor(newerDay / 10000),
      Math.floor((newerDay % 10000) / 100) - 1,
      newerDay % 100
    );
    const diffTime = Math.abs(newer - older);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async scrapeRecentBroadcasts() {
    if (this.isRunning) {
      logger.warn('Scraper is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting recent broadcasts scrape');

    try {
      // First fetch live to get most current data
      logger.info('Fetching live broadcasts...');
      const liveData = await fm4Api.getLive();
      if (liveData && Array.isArray(liveData) && liveData.length > 0) {
        for (const liveBroadcast of liveData) {
          await this.scrapeBroadcast(liveBroadcast.programKey, liveBroadcast.broadcastDay, true);
        }
      }

      // Then fetch broadcasts endpoint
      logger.info('Fetching broadcasts list...');
      const broadcastsData = await fm4Api.getBroadcasts();
      
      // Discover any new program keys
      await this.discoverProgramKeys();

      // Scrape all broadcasts from the broadcasts endpoint (typically last ~8 days)
      if (Array.isArray(broadcastsData)) {
        for (const dayData of broadcastsData) {
          if (dayData.broadcasts && dayData.broadcasts.length > 0) {
            for (const broadcast of dayData.broadcasts) {
              await this.scrapeBroadcast(broadcast.programKey, dayData.day);
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        }
      }

      logger.info('Recent broadcasts scrape complete');
      logger.info(`Total program keys known: ${this.knownProgramKeys.size}`);
      db.setMetadata('last_recent_scrape', Date.now().toString());
    } catch (error) {
      logger.error(`Recent scrape failed: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async cleanupOldBroadcasts() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.scraper.keepHistoryDays);
      const cutoffTimestamp = cutoffDate.getTime();

      logger.info(`Cleaning up broadcasts older than ${cutoffDate.toISOString()}`);
      
      // 1. Delete old broadcasts
      //    - CASCADE automatically deletes broadcast_items
      //    - Triggers automatically delete FTS entries
      //    - Triggers automatically delete image_references
      const result = db.deleteBroadcastsOlderThan(cutoffTimestamp);
      logger.info(`Deleted ${result.changes} old broadcasts (items/FTS/refs auto-deleted)`);

      // 2. Delete unreferenced images from database
      //    (images with no entries in image_references)
      const imageResult = db.deleteUnreferencedImages();
      logger.info(`Deleted ${imageResult.changes} unreferenced image records from database`);

      // 3. Delete physical image files from disk
      //    (files that no longer have database records)
      const fileCleanup = imageService.cleanupOrphanedImageFiles();
      logger.info(`Deleted ${fileCleanup.deleted} orphaned image files from disk`);
      
      if (fileCleanup.errors.length > 0) {
        logger.warn(`Failed to delete ${fileCleanup.errors.length} image files`);
      }
    } catch (error) {
      logger.error(`Cleanup failed: ${error.message}`);
    }
  }
}

export default new BroadcastScraper();
