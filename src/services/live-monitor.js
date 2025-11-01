import fm4Api from './fm4-api.js';
import broadcastScraper from './broadcast-scraper.js';
import imageService from './image-service.js';
import logger from '../utils/logger.js';
import db from '../database/database.js';

class LiveMonitor {
  constructor() {
    this.monitoredBroadcasts = new Map(); // broadcastId -> { programKey, broadcastDay, lastCheck }
    this.monitoredItems = new Map(); // itemId -> { broadcastId, programKey, broadcastDay, endTime }
    this.processedItems = new Map(); // broadcastId -> Set of processed itemIds
    this.checkInterval = 30000; // Check every 30 seconds
    this.intervalId = null;
  }

  async processLiveItems(broadcast, storedBroadcastId) {
    if (!broadcast.items || !Array.isArray(broadcast.items)) {
      return;
    }

    const broadcastId = broadcast.id;
    
    // Initialize cache for this broadcast if it doesn't exist
    if (!this.processedItems.has(broadcastId)) {
      this.processedItems.set(broadcastId, new Set());
    }
    
    const processedCache = this.processedItems.get(broadcastId);

    // Get all existing items for this broadcast once (more efficient than checking in loop)
    const existingItems = db.getBroadcastItems(storedBroadcastId);
    const existingItemIds = new Set(existingItems.map(item => item.item_id));

    for (const liveItem of broadcast.items) {
      const itemId = liveItem.id;
      
      // Skip if already processed in this session
      if (processedCache.has(itemId)) {
        continue;
      }
      
      // Check if this item already exists in database
      if (!existingItemIds.has(itemId)) {
        logger.info(`Live monitor: Found new future item ${itemId} in live endpoint, storing it now`);
        
        // Store the item immediately (item_id goes to item_id column, NOT id column)
        const itemRecord = {
          item_id: itemId, // FM4 API ID goes to item_id column
          broadcastDay: liveItem.broadcastDay,
          programKey: liveItem.programKey || liveItem.program,
          type: liveItem.type,
          title: liveItem.title || null,
          interpreter: liveItem.interpreter || null,
          description: liveItem.description || null,
          state: liveItem.state,
          isOnDemand: liveItem.isOnDemand || false,
          isGeoProtected: liveItem.isGeoProtected || false,
          isCompleted: liveItem.isCompleted || false,
          duration: liveItem.duration || null,
          songId: liveItem.songId || null,
          isAdFree: liveItem.isAdFree || false,
          start: liveItem.start || null,
          startISO: liveItem.startISO || null,
          end: liveItem.end || null,
          endISO: liveItem.endISO || null
        };

        const dbItemId = db.insertBroadcastItem(itemRecord, storedBroadcastId);

        // Process and store images for this item (including fallbacks)
        if (liveItem.images && Array.isArray(liveItem.images) && liveItem.images.length > 0) {
          logger.info(`Live monitor: Processing ${liveItem.images.length} images for item ${itemId}`);
          await imageService.processBroadcastItemImages(liveItem, dbItemId.lastInsertRowid);
        } else {
          logger.debug(`Live monitor: No images for item ${itemId}`);
        }
        
        // Mark as processed
        processedCache.add(itemId);
      } else {
        // Item exists in database, mark as processed to avoid checking again
        processedCache.add(itemId);
      }
    }
  }

  async checkLiveAndUpdate() {
    try {
      logger.debug('Live monitor: Checking live endpoint');
      const liveData = await fm4Api.getLive();
      
      if (!liveData || !Array.isArray(liveData) || liveData.length === 0) {
        return;
      }

      for (const broadcast of liveData) {
        const broadcastId = broadcast.id;
        const programKey = broadcast.programKey;
        const broadcastDay = broadcast.broadcastDay;
        const broadcastState = broadcast.state;

        // Check if broadcast is not completed (C = Completed, P = Playing, S = Scheduled)
        const isIncomplete = broadcastState !== 'C';

        logger.debug(`Live broadcast: ${programKey}/${broadcastDay} (state: ${broadcastState})`);

        // Always fetch the broadcast details if it's currently live or not completed
        if (isIncomplete) {
          logger.info(`Live monitor: Fetching incomplete broadcast ${programKey}/${broadcastDay}`);
          await broadcastScraper.scrapeBroadcast(programKey, broadcastDay, true);
          
          // Get the stored broadcast to process live items
          const storedBroadcast = db.getBroadcast(broadcastDay, programKey);
          if (storedBroadcast) {
            // Process items from live endpoint (including future items not yet in broadcast endpoint)
            await this.processLiveItems(broadcast, storedBroadcast.id);
          }
          
          // Track this broadcast for continuous monitoring
          this.monitoredBroadcasts.set(broadcastId, {
            programKey,
            broadcastDay,
            lastCheck: Date.now(),
            state: broadcastState
          });
        } else {
          // Broadcast is completed, do one final fetch to ensure we have all items
          // This will also mark the broadcast as done, which triggers URL refresh
          // (live date-based URLs → offset-based URLs for completed broadcasts)
          const existing = db.getBroadcast(broadcastDay, programKey);
          if (existing && (Date.now() / 1000 - existing.updated_at) > 300) {
            logger.info(`Live monitor: Final fetch for completed broadcast ${programKey}/${broadcastDay}`);
            logger.info(`Live monitor: This will refresh loopstream URLs from live to offset-based`);
            await broadcastScraper.scrapeBroadcast(programKey, broadcastDay, true);
          }
          
          // Clean up monitoring for this broadcast
          this.monitoredBroadcasts.delete(broadcastId);
          
          // Clean up the processed items cache for this completed broadcast
          if (this.processedItems.has(broadcastId)) {
            const cacheSize = this.processedItems.get(broadcastId).size;
            this.processedItems.delete(broadcastId);
            logger.info(`Live monitor: Cleaned cache for completed broadcast ${broadcastId} (${cacheSize} items)`);
          }
        }

        // Check items within the broadcast
        if (broadcast.items && Array.isArray(broadcast.items)) {
          for (const item of broadcast.items) {
            const itemState = item.state;
            const itemId = item.id;
            const isCompleted = item.isCompleted;

            // Monitor items that are not completed yet (S = Started, P = Playing)
            if (!isCompleted && (itemState === 'S' || itemState === 'P')) {
              logger.debug(`Live monitor: Tracking incomplete item ${itemId} (state: ${itemState})`);
              
              this.monitoredItems.set(itemId, {
                broadcastId,
                programKey,
                broadcastDay,
                endTime: item.end,
                state: itemState
              });
            } else if (this.monitoredItems.has(itemId)) {
              // Item was being monitored and is now complete
              logger.info(`Live monitor: Item ${itemId} completed, triggering rescan of ${programKey}/${broadcastDay}`);
              await broadcastScraper.scrapeBroadcast(programKey, broadcastDay, true);
              this.monitoredItems.delete(itemId);
            }
          }
        }
      }

      // Check if any monitored items have passed their end time
      const now = Date.now();
      for (const [itemId, itemData] of this.monitoredItems.entries()) {
        if (now >= itemData.endTime) {
          logger.info(`Live monitor: Item ${itemId} passed end time, triggering rescan`);
          await broadcastScraper.scrapeBroadcast(itemData.programKey, itemData.broadcastDay, true);
          // Keep monitoring until we confirm it's completed
        }
      }

      // Log monitoring status with more details
      if (this.monitoredBroadcasts.size > 0 || this.monitoredItems.size > 0) {
        // Count total items in monitored broadcasts
        let totalItems = 0;
        for (const broadcast of liveData) {
          if (this.monitoredBroadcasts.has(broadcast.id) && broadcast.items) {
            totalItems += broadcast.items.length;
          }
        }
        logger.info(`Live monitor: Tracking ${this.monitoredBroadcasts.size} broadcasts (${totalItems} total items, ${this.monitoredItems.size} active/future)`);
      }

    } catch (error) {
      logger.error(`Live monitor check failed: ${error.message}`);
    }
  }

  start() {
    if (this.intervalId) {
      logger.warn('Live monitor already running');
      return;
    }

    logger.info('Starting live monitor (checking every 30 seconds)');
    
    // Do an immediate check
    this.checkLiveAndUpdate();
    
    // Then check every 30 seconds
    this.intervalId = setInterval(() => {
      this.checkLiveAndUpdate();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      
      // Clear all caches
      const cachedBroadcasts = this.processedItems.size;
      let totalCachedItems = 0;
      for (const items of this.processedItems.values()) {
        totalCachedItems += items.size;
      }
      
      this.monitoredBroadcasts.clear();
      this.monitoredItems.clear();
      this.processedItems.clear();
      
      logger.info(`Live monitor stopped - Cleared ${cachedBroadcasts} broadcast caches with ${totalCachedItems} items`);
    }
  }
}

export default new LiveMonitor();
