import express from 'express';
import db from '../database/database.js';
import transformer from '../utils/broadcast-transformer.js';
import logger from '../utils/logger.js';
import { 
  asyncHandler, 
  validateBroadcastDay, 
  validateProgramKey, 
  validateInteger,
  validateSearchQuery 
} from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';

const router = express.Router();

const getBaseUrl = (req) => `${req.protocol}://${req.get('host')}`;

/**
 * @openapi
 * /api/live:
 *   get:
 *     summary: Get Live Broadcast
 *     description: Get currently live broadcast data (always fresh, never cached)
 *     tags:
 *       - Live
 *     responses:
 *       200:
 *         description: Live broadcast data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Broadcast'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: External service unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/live', asyncHandler(async (req, res) => {
  // Disable caching for live endpoint
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  const baseUrl = getBaseUrl(req);
  // Always fetch fresh live data, never use cached
  const liveData = await transformer.transformLiveData(baseUrl, true);
  
  if (!liveData || liveData.length === 0) {
    throw new ApiError(404, 'No live broadcast found');
  }
  
  res.json(liveData);
}));

/**
 * @openapi
 * /api/broadcasts:
 *   get:
 *     summary: Get All Broadcasts
 *     description: Get all broadcasts from the last 30 days
 *     tags:
 *       - Broadcasts
 *     responses:
 *       200:
 *         description: List of broadcasts grouped by day
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   day:
 *                     type: integer
 *                     example: 20251101
 *                   broadcasts:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Broadcast'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/broadcasts', asyncHandler(async (req, res) => {
  const baseUrl = getBaseUrl(req);
  const broadcasts = db.getAllBroadcasts(10000);
  const transformed = transformer.transformBroadcastsList(broadcasts, baseUrl);
  res.json(transformed);
}));

/**
 * @openapi
 * /api/broadcasts/{day}:
 *   get:
 *     summary: Get Broadcasts by Day
 *     description: Get all broadcasts for a specific day
 *     tags:
 *       - Broadcasts
 *     parameters:
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: integer
 *           example: 20251101
 *         description: Broadcast day in YYYYMMDD format
 *     responses:
 *       200:
 *         description: Broadcasts for the specified day
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 day:
 *                   type: integer
 *                 broadcasts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Broadcast'
 *       400:
 *         description: Invalid day format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No broadcasts found for the specified day
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/broadcasts/:day', validateBroadcastDay('day'), asyncHandler(async (req, res) => {
  const day = req.params.day; // Already validated and parsed
  const baseUrl = getBaseUrl(req);
  const broadcasts = db.getBroadcastsByDateRange(day, day);
  const transformed = transformer.transformBroadcastsList(broadcasts, baseUrl);
  
  res.json(transformed.length > 0 ? transformed[0] : { day, broadcasts: [] });
}));

/**
 * @openapi
 * /api/broadcast/{programKey}/{day}:
 *   get:
 *     summary: Get Specific Broadcast
 *     description: Get a specific broadcast with all its items (songs, news, jingles, etc.)
 *     tags:
 *       - Broadcasts
 *     parameters:
 *       - in: path
 *         name: programKey
 *         required: true
 *         schema:
 *           type: string
 *           example: 4SLF
 *         description: Program key (e.g., 4SLF, 4MO, 4OK)
 *       - in: path
 *         name: day
 *         required: true
 *         schema:
 *           type: integer
 *           example: 20251101
 *         description: Broadcast day in YYYYMMDD format
 *     responses:
 *       200:
 *         description: Broadcast details with items
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Broadcast'
 *                 - type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BroadcastItem'
 *       400:
 *         description: Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Broadcast not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/broadcast/:programKey/:day', 
  validateProgramKey('programKey'), 
  validateBroadcastDay('day'), 
  asyncHandler(async (req, res) => {
    const { programKey, day } = req.params;
    const broadcast = db.getBroadcast(day, programKey);
    
    if (!broadcast) {
      throw new ApiError(404, `Broadcast not found: ${programKey}/${day}`);
    }

    const baseUrl = getBaseUrl(req);
    const transformed = transformer.transformBroadcast(broadcast, baseUrl, true);
    
    res.json(transformed);
  })
);

/**
 * @openapi
 * /api/program-keys:
 *   get:
 *     summary: Get Program Keys
 *     description: Get all known program keys (show identifiers)
 *     tags:
 *       - Broadcasts
 *     responses:
 *       200:
 *         description: List of program keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   program_key:
 *                     type: string
 *                     example: 4SLF
 *                   title:
 *                     type: string
 *                     nullable: true
 *                   last_seen:
 *                     type: integer
 *                     nullable: true
 *                   created_at:
 *                     type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/program-keys', asyncHandler(async (req, res) => {
  const programKeys = db.getAllProgramKeys();
  res.json(programKeys);
}));

/**
 * @openapi
 * /api/item/{id}:
 *   get:
 *     summary: Get Broadcast Item
 *     description: Get a specific broadcast item (song, news, jingle, etc.) by ID
 *     tags:
 *       - Items
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 5318501
 *         description: Broadcast item ID
 *     responses:
 *       200:
 *         description: Broadcast item details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BroadcastItem'
 *       400:
 *         description: Invalid item ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/item/:id', async (req, res) => {
  try {
    const itemId = parseInt(req.params.id);
    
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Search by item_id (FM4 API ID) not database id
    const item = db.getBroadcastItemByItemId(itemId);
    
    if (!item) {
      return res.status(404).json({ error: 'Broadcast item not found' });
    }

    // Get parent broadcast for loopstream info
    const broadcast = db.getBroadcastById(item.broadcast_id);

    const baseUrl = getBaseUrl(req);
    const transformed = transformer.transformBroadcastItem(item, baseUrl, broadcast);
    
    res.json(transformed);
  } catch (error) {
    logger.error(`Error fetching broadcast item ${req.params.id}: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch broadcast item' });
  }
});

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Full-Text Search
 *     description: Search across broadcasts and items using full-text search with BM25 ranking
 *     tags:
 *       - Search
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           example: radiohead
 *         description: Search query
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, broadcasts, items]
 *           default: all
 *         description: Search type (all, broadcasts, or items)
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 25
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset for pagination (broadcasts/items type only)
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResults'
 *       400:
 *         description: Invalid search parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', validateSearchQuery, asyncHandler(async (req, res) => {
  const { q, type = 'all', limit = 25, offset = 0 } = req.query;
  
  const searchQuery = q.trim();
  const maxLimit = limit; // Already validated by validateSearchQuery
  const searchOffset = offset; // Already validated
  const baseUrl = getBaseUrl(req);

    if (type === 'broadcasts') {
      // Search only broadcasts
      const results = db.searchBroadcasts(searchQuery, maxLimit, searchOffset);
      const total = db.countSearchBroadcasts(searchQuery);
      
      const transformed = results.map(broadcast => {
        const base = transformer.transformBroadcast(broadcast, baseUrl, false);
        return {
          ...base,
          _snippet: {
            title: broadcast.title_snippet,
            description: broadcast.description_snippet
          },
          _rank: broadcast.rank
        };
      });

      return res.json({
        query: searchQuery,
        type: 'broadcasts',
        results: transformed,
        total,
        limit: maxLimit,
        offset: searchOffset
      });
    } else if (type === 'items') {
      // Search only broadcast items
      const results = db.searchBroadcastItems(searchQuery, maxLimit, searchOffset);
      const total = db.countSearchBroadcastItems(searchQuery);
      
      const transformed = results.map(item => {
        const broadcast = db.getBroadcastById(item.broadcast_id);
        const base = transformer.transformBroadcastItem(item, baseUrl, broadcast);
        return {
          ...base,
          _snippet: {
            title: item.title_snippet,
            interpreter: item.interpreter_snippet
          },
          _rank: item.rank,
          broadcast: {
            id: broadcast.id,
            title: broadcast.title,
            programKey: broadcast.program_key,
            broadcastDay: broadcast.broadcast_day
          }
        };
      });

      return res.json({
        query: searchQuery,
        type: 'items',
        results: transformed,
        total,
        limit: maxLimit,
        offset: searchOffset
      });
    } else {
      // Search both (default)
      const broadcastResults = db.searchBroadcasts(searchQuery, maxLimit);
      const itemResults = db.searchBroadcastItems(searchQuery, maxLimit);
      
      const broadcasts = broadcastResults.map(broadcast => {
        const base = transformer.transformBroadcast(broadcast, baseUrl, false);
        return {
          ...base,
          _type: 'broadcast',
          _snippet: {
            title: broadcast.title_snippet,
            description: broadcast.description_snippet
          },
          _rank: broadcast.rank
        };
      });

      const items = itemResults.map(item => {
        const broadcast = db.getBroadcastById(item.broadcast_id);
        const base = transformer.transformBroadcastItem(item, baseUrl, broadcast);
        return {
          ...base,
          _type: 'item',
          _snippet: {
            title: item.title_snippet,
            interpreter: item.interpreter_snippet
          },
          _rank: item.rank,
          broadcast: {
            id: broadcast.id,
            title: broadcast.title,
            programKey: broadcast.program_key,
            broadcastDay: broadcast.broadcast_day
          }
        };
      });

      // Combine and sort by rank
      const combined = [...broadcasts, ...items].sort((a, b) => a._rank - b._rank);

      return res.json({
        query: searchQuery,
        type: 'all',
        results: combined.slice(0, maxLimit),
        counts: {
          broadcasts: db.countSearchBroadcasts(searchQuery),
          items: db.countSearchBroadcastItems(searchQuery),
          total: db.countSearchBroadcasts(searchQuery) + db.countSearchBroadcastItems(searchQuery)
        },
        limit: maxLimit
      });
    }
}));

export default router;
