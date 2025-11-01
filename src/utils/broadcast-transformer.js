import db from '../database/database.js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class BroadcastTransformer {
  constructor() {
    this.loopstreamBaseUrl = config.fm4.loopstreamBaseUrl;
  }

  buildLoopstreamUrl(loopStreamId, start, end, offset = 0, offsetende = 0) {
    if (!loopStreamId) return null;

    const params = new URLSearchParams({
      channel: 'fm4',
      id: loopStreamId,
      offset: offset.toString(),
      offsetende: offsetende.toString()
    });

    return `${this.loopstreamBaseUrl}/?${params.toString()}`;
  }

  buildLoopstreamHlsUrl(loopStreamId, start, end, offset = 0, offsetende = 0) {
    if (!loopStreamId) return null;

    const params = new URLSearchParams({
      channel: 'fm4',
      id: loopStreamId,
      offset: offset.toString(),
      offsetende: offsetende.toString()
    });

    return `${this.loopstreamBaseUrl}/playlist.m3u8?${params.toString()}`;
  }

  /**
   * Build loopstream URL for live broadcast items (date-based)
   * Allows "going back" to earlier parts of ongoing broadcast
   * 
   * @param {number} itemStartTime - Timestamp when item started (milliseconds)
   * @param {number} broadcastDay - Broadcast day in YYYYMMDD format
   * @returns {string|null} Loopstream URL with start and ende parameters
   */
  buildLiveBroadcastItemUrl(itemStartTime, broadcastDay) {
    if (!itemStartTime || !broadcastDay) return null;

    // Format item start time as YYYYMMDDHHmmss
    const startDate = new Date(itemStartTime);
    const start = this.formatDateTimeForLoopstream(startDate);

    // Calculate end of broadcast day (23:59:59)
    const endDate = new Date(
      Math.floor(broadcastDay / 10000), // year
      Math.floor((broadcastDay % 10000) / 100) - 1, // month (0-indexed)
      broadcastDay % 100, // day
      23, 59, 59 // end of day
    );
    const ende = this.formatDateForLoopstream(endDate);

    const params = new URLSearchParams({
      channel: 'fm4',
      start: start,
      ende: ende
    });

    return `${this.loopstreamBaseUrl}/?${params.toString()}`;
  }

  /**
   * Build HLS playlist URL for live broadcast items (date-based)
   * 
   * @param {number} itemStartTime - Timestamp when item started (milliseconds)
   * @param {number} broadcastDay - Broadcast day in YYYYMMDD format
   * @returns {string|null} HLS playlist URL with start and ende parameters
   */
  buildLiveBroadcastItemHlsUrl(itemStartTime, broadcastDay) {
    if (!itemStartTime || !broadcastDay) return null;

    const startDate = new Date(itemStartTime);
    const start = this.formatDateTimeForLoopstream(startDate);

    const endDate = new Date(
      Math.floor(broadcastDay / 10000),
      Math.floor((broadcastDay % 10000) / 100) - 1,
      broadcastDay % 100,
      23, 59, 59
    );
    const ende = this.formatDateForLoopstream(endDate);

    const params = new URLSearchParams({
      channel: 'fm4',
      start: start,
      ende: ende
    });

    return `${this.loopstreamBaseUrl}/playlist.m3u8?${params.toString()}`;
  }

  /**
   * Format date as YYYYMMDD for loopstream ende parameter
   */
  formatDateForLoopstream(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Format date/time as YYYYMMDDHHmmss for loopstream start parameter
   */
  formatDateTimeForLoopstream(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  transformImage(imageRecord, baseUrl) {
    if (!imageRecord) return null;

    const resolutionType = imageRecord.resolution_type || 'high';
    return {
      hash: imageRecord.hash,
      url: `${baseUrl}/images/${imageRecord.hash}?resolution=${resolutionType}`,
      resolutionType: resolutionType,
      alt: imageRecord.alt,
      text: imageRecord.text,
      category: imageRecord.category,
      copyright: imageRecord.copyright,
      mode: imageRecord.mode,
      width: imageRecord.width,
      height: imageRecord.height,
      originalHashCode: imageRecord.original_hash_code
    };
  }

  groupImagesByResolution(images, baseUrl) {
    const grouped = {
      high: [],
      low: []
    };

    images.forEach(img => {
      const transformed = this.transformImage(img, baseUrl);
      if (transformed) {
        if (img.resolution_type === 'high') {
          grouped.high.push(transformed);
        } else if (img.resolution_type === 'low') {
          grouped.low.push(transformed);
        }
      }
    });

    return grouped;
  }

  transformBroadcastItem(item, baseUrl, broadcast = null) {
    const images = db.getImageReferences('broadcast_item', item.id);
    const groupedImages = this.groupImagesByResolution(images, baseUrl);

    const transformed = {
      id: item.item_id,
      broadcastDay: item.broadcast_day,
      programKey: item.program_key,
      type: item.type,
      title: item.title,
      interpreter: item.interpreter,
      description: item.description,
      state: item.state,
      isOnDemand: Boolean(item.is_on_demand),
      isGeoProtected: Boolean(item.is_geo_protected),
      isCompleted: Boolean(item.is_completed),
      duration: item.duration,
      songId: item.song_id,
      isAdFree: Boolean(item.is_ad_free),
      start: item.start_time,
      startISO: item.start_iso,
      end: item.end_time,
      endISO: item.end_iso,
      startOffset: item.start_offset,
      endOffset: item.end_offset,
      images: groupedImages
    };

    // Add loopstream info from parent broadcast if available
    if (broadcast && broadcast.loop_stream_id) {
      const isLive = !broadcast.done;

      if (isLive && item.start_time) {
        // For live broadcasts: Use date-based URLs to allow "going back"
        transformed.loopstream = {
          id: broadcast.loop_stream_id,
          broadcastStart: broadcast.loop_stream_start,
          broadcastEnd: broadcast.loop_stream_end,
          isLive: true,
          progressive: this.buildLiveBroadcastItemUrl(item.start_time, item.broadcast_day),
          hls: this.buildLiveBroadcastItemHlsUrl(item.start_time, item.broadcast_day)
        };
      } else {
        // For completed broadcasts: Use offset-based URLs
        const itemOffset = item.start_time - broadcast.loop_stream_start;
        const itemDuration = item.duration || (item.end_time - item.start_time);

        transformed.loopstream = {
          id: broadcast.loop_stream_id,
          broadcastStart: broadcast.loop_stream_start,
          broadcastEnd: broadcast.loop_stream_end,
          isLive: false,
          progressive: this.buildLoopstreamUrl(
            broadcast.loop_stream_id,
            broadcast.loop_stream_start,
            broadcast.loop_stream_end,
            itemOffset,
            0
          ),
          hls: this.buildLoopstreamHlsUrl(
            broadcast.loop_stream_id,
            broadcast.loop_stream_start,
            broadcast.loop_stream_end,
            itemOffset,
            0
          )
        };
      }
    }

    return transformed;
  }

  transformBroadcast(broadcast, baseUrl, includeItems = true) {
    const images = db.getImageReferences('broadcast', broadcast.id);
    const groupedImages = this.groupImagesByResolution(images, baseUrl);
    const items = includeItems ? db.getBroadcastItems(broadcast.id) : [];

    const transformed = {
      id: broadcast.id,
      broadcastDay: broadcast.broadcast_day,
      programKey: broadcast.program_key,
      program: broadcast.program,
      title: broadcast.title,
      subtitle: broadcast.subtitle,
      state: broadcast.state,
      isOnDemand: Boolean(broadcast.is_on_demand),
      isGeoProtected: Boolean(broadcast.is_geo_protected),
      isAdFree: Boolean(broadcast.is_ad_free),
      start: broadcast.start_time,
      startISO: broadcast.start_iso,
      end: broadcast.end_time,
      endISO: broadcast.end_iso,
      scheduledStart: broadcast.scheduled_start,
      scheduledEnd: broadcast.scheduled_end,
      niceTime: broadcast.nice_time,
      niceTimeISO: broadcast.nice_time_iso,
      duration: broadcast.duration,
      description: broadcast.description,
      moderator: broadcast.moderator,
      url: broadcast.url,
      images: groupedImages
    };

    // Add loopstream URLs if available
    if (broadcast.loop_stream_id) {
      transformed.loopstream = {
        id: broadcast.loop_stream_id,
        start: broadcast.loop_stream_start,
        end: broadcast.loop_stream_end,
        progressive: this.buildLoopstreamUrl(
          broadcast.loop_stream_id,
          broadcast.loop_stream_start,
          broadcast.loop_stream_end
        ),
        hls: this.buildLoopstreamHlsUrl(
          broadcast.loop_stream_id,
          broadcast.loop_stream_start,
          broadcast.loop_stream_end
        )
      };
    }

    if (includeItems) {
      transformed.items = items.map(item => this.transformBroadcastItem(item, baseUrl, broadcast));
    }

    return transformed;
  }

  transformBroadcastsList(broadcasts, baseUrl) {
    // Group broadcasts by day
    const groupedByDay = {};

    broadcasts.forEach(broadcast => {
      const day = broadcast.broadcast_day;
      if (!groupedByDay[day]) {
        groupedByDay[day] = [];
      }
      groupedByDay[day].push(this.transformBroadcast(broadcast, baseUrl, false));
    });

    // Convert to array format matching original API
    return Object.keys(groupedByDay)
      .sort((a, b) => b - a) // Sort descending
      .map(day => {
        const dayBroadcasts = groupedByDay[day];
        const firstBroadcast = dayBroadcasts[0];
        
        // Calculate day start (5am)
        const dayDate = new Date(firstBroadcast.start);
        dayDate.setHours(5, 0, 0, 0);

        return {
          day: parseInt(day),
          broadcasts: dayBroadcasts.sort((a, b) => a.start - b.start),
          date: dayDate.getTime(),
          dateISO: dayDate.toISOString()
        };
      });
  }

  async transformLiveData(baseUrl, alwaysFresh = false) {
    try {
      // Just return data from database - the live-monitor service keeps it updated every 30 seconds
      // This prevents infinite loops and duplicate scraping on every /api/live request
      const today = new Date();
      const todayDay = parseInt(
        `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      );
      
      // Also check yesterday in case today's broadcasts aren't loaded yet
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDay = parseInt(
        `${yesterday.getFullYear()}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getDate()).padStart(2, '0')}`
      );

      // Get broadcasts from yesterday and today
      const broadcasts = db.getBroadcastsByDateRange(yesterdayDay, todayDay);
      
      if (broadcasts.length === 0) {
        return [];
      }

      // Find currently playing broadcast(s)
      const now = Date.now();
      const liveBroadcasts = broadcasts.filter(b => 
        b.start_time <= now && (!b.end_time || b.end_time >= now)
      );

      if (liveBroadcasts.length > 0) {
        return liveBroadcasts.map(b => this.transformBroadcast(b, baseUrl, true));
      }

      // If nothing currently live, return the next scheduled broadcast
      const nextBroadcast = broadcasts.find(b => b.start_time > now);
      return nextBroadcast ? [this.transformBroadcast(nextBroadcast, baseUrl, true)] : [];
    } catch (error) {
      logger.error(`Failed to transform live data: ${error.message}`);
      return [];
    }
  }
}

export default new BroadcastTransformer();
