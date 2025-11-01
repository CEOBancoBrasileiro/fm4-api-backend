import swaggerJsdoc from 'swagger-jsdoc';
import config from './config.js';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FM4 Backend API',
      version: '1.0.0',
      description: 'FM4 Austria Radio Station Backend API - Historical broadcast data, music streaming, and full-text search',
      contact: {
        name: 'FM4 Backend API',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server (example)',
      },
      {
        url: `https://api.fm4.example.com`,
        description: 'Production server (example)',
      },
    ],
    tags: [
      {
        name: 'Live',
        description: 'Live broadcast endpoints',
      },
      {
        name: 'Broadcasts',
        description: 'Historical broadcast data',
      },
      {
        name: 'Items',
        description: 'Broadcast items (songs, jingles, etc.)',
      },
      {
        name: 'Search',
        description: 'Full-text search across broadcasts and items',
      },
      {
        name: 'Images',
        description: 'Image serving endpoints',
      },
      {
        name: 'System',
        description: 'System health and metadata',
      },
    ],
    components: {
      schemas: {
        Broadcast: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Broadcast ID',
              example: 172092,
            },
            broadcastDay: {
              type: 'integer',
              description: 'Broadcast day in YYYYMMDD format',
              example: 20251101,
            },
            programKey: {
              type: 'string',
              description: 'Program identifier',
              example: '4SLF',
            },
            program: {
              type: 'string',
              description: 'Program name',
              example: 'Sounds Like FM4',
            },
            title: {
              type: 'string',
              description: 'Broadcast title',
              example: 'Sounds Like FM4',
            },
            subtitle: {
              type: 'string',
              nullable: true,
              description: 'Broadcast subtitle',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Broadcast description',
            },
            moderator: {
              type: 'string',
              nullable: true,
              description: 'Moderator name',
            },
            state: {
              type: 'string',
              enum: ['S', 'P', 'C'],
              description: 'State: S=Scheduled, P=Playing, C=Completed',
            },
            isOnDemand: {
              type: 'boolean',
              description: 'Whether broadcast is available on-demand',
            },
            isGeoProtected: {
              type: 'boolean',
              description: 'Whether broadcast is geo-restricted',
            },
            isAdFree: {
              type: 'boolean',
              description: 'Whether broadcast is ad-free',
            },
            start: {
              type: 'integer',
              description: 'Start time as Unix timestamp (milliseconds)',
              example: 1730469608000,
            },
            startISO: {
              type: 'string',
              format: 'date-time',
              description: 'Start time in ISO 8601 format',
              example: '2025-11-01T15:00:08+01:00',
            },
            end: {
              type: 'integer',
              description: 'End time as Unix timestamp (milliseconds)',
              example: 1730483608000,
            },
            endISO: {
              type: 'string',
              format: 'date-time',
              description: 'End time in ISO 8601 format',
              example: '2025-11-01T19:00:08+01:00',
            },
            duration: {
              type: 'integer',
              description: 'Broadcast duration in milliseconds',
              example: 14400000,
            },
            done: {
              type: 'boolean',
              description: 'Whether broadcast is completed and finalized',
            },
            url: {
              type: 'string',
              nullable: true,
              description: 'Original FM4 broadcast URL',
            },
            loopstream: {
              type: 'object',
              nullable: true,
              properties: {
                id: {
                  type: 'string',
                  description: 'Loopstream recording ID',
                },
                start: {
                  type: 'integer',
                  description: 'Recording start time',
                },
                end: {
                  type: 'integer',
                  description: 'Recording end time',
                },
                progressive: {
                  type: 'string',
                  description: 'Progressive stream URL',
                },
                hls: {
                  type: 'string',
                  description: 'HLS playlist URL',
                },
              },
            },
            images: {
              type: 'object',
              properties: {
                high: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Image' },
                },
                low: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Image' },
                },
              },
            },
          },
        },
        BroadcastItem: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Item ID',
              example: 5318501,
            },
            broadcastDay: {
              type: 'integer',
              description: 'Broadcast day in YYYYMMDD format',
              example: 20251101,
            },
            programKey: {
              type: 'string',
              description: 'Program identifier',
              example: '4SLF',
            },
            type: {
              type: 'string',
              description: 'Item type: M=Music, N=News, J=Jingle, A=Ad, etc.',
              example: 'M',
            },
            title: {
              type: 'string',
              description: 'Item title (song name, news title, etc.)',
              example: 'Creep',
            },
            interpreter: {
              type: 'string',
              nullable: true,
              description: 'Artist/interpreter name',
              example: 'Radiohead',
            },
            description: {
              type: 'string',
              nullable: true,
              description: 'Item description',
            },
            state: {
              type: 'string',
              description: 'Item state',
            },
            isOnDemand: {
              type: 'boolean',
              description: 'Whether item is available on-demand',
            },
            isGeoProtected: {
              type: 'boolean',
              description: 'Whether item is geo-restricted',
            },
            isCompleted: {
              type: 'boolean',
              description: 'Whether item has finished playing',
            },
            duration: {
              type: 'integer',
              description: 'Item duration in milliseconds',
              example: 238000,
            },
            songId: {
              type: 'string',
              nullable: true,
              description: 'Song ID if applicable',
            },
            isAdFree: {
              type: 'boolean',
              description: 'Whether item is ad-free',
            },
            start: {
              type: 'integer',
              description: 'Start time as Unix timestamp (milliseconds)',
              example: 1730469608000,
            },
            startISO: {
              type: 'string',
              format: 'date-time',
              description: 'Start time in ISO 8601 format',
              example: '2025-11-01T15:00:08+01:00',
            },
            end: {
              type: 'integer',
              description: 'End time as Unix timestamp (milliseconds)',
              example: 1730469846000,
            },
            endISO: {
              type: 'string',
              format: 'date-time',
              description: 'End time in ISO 8601 format',
              example: '2025-11-01T15:03:58+01:00',
            },
            startOffset: {
              type: 'integer',
              description: 'Milliseconds from broadcast start to item start',
              example: 0,
            },
            endOffset: {
              type: 'integer',
              description: 'Milliseconds from broadcast start to item end',
              example: 238000,
            },
            loopstream: {
              type: 'object',
              nullable: true,
              properties: {
                id: {
                  type: 'string',
                  description: 'Loopstream recording ID',
                },
                broadcastStart: {
                  type: 'integer',
                  description: 'Broadcast start time',
                },
                broadcastEnd: {
                  type: 'integer',
                  description: 'Broadcast end time',
                },
                isLive: {
                  type: 'boolean',
                  description: 'Whether using live date-based URLs (true) or offset-based URLs (false)',
                },
                progressive: {
                  type: 'string',
                  description: 'Progressive stream URL (date-based for live, offset-based for completed)',
                },
                hls: {
                  type: 'string',
                  description: 'HLS playlist URL (date-based for live, offset-based for completed)',
                },
              },
            },
            images: {
              type: 'object',
              properties: {
                high: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Image' },
                },
                low: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Image' },
                },
              },
            },
          },
        },
        Image: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'SHA-256 hash of image',
              example: 'a1b2c3d4e5f6...',
            },
            url: {
              type: 'string',
              description: 'Image URL',
              example: 'http://localhost:3000/images/a1b2c3d4e5f6...?resolution=high',
            },
            resolutionType: {
              type: 'string',
              enum: ['high', 'low'],
              description: 'Image resolution',
            },
            alt: {
              type: 'string',
              nullable: true,
              description: 'Alt text',
            },
            text: {
              type: 'string',
              nullable: true,
              description: 'Image text/caption',
            },
            category: {
              type: 'string',
              nullable: true,
              description: 'Image category',
            },
            copyright: {
              type: 'string',
              nullable: true,
              description: 'Copyright information',
            },
            mode: {
              type: 'string',
              nullable: true,
              description: 'Image mode',
            },
            width: {
              type: 'integer',
              description: 'Image width in pixels',
            },
            height: {
              type: 'integer',
              description: 'Image height in pixels',
            },
            originalHashCode: {
              type: 'integer',
              nullable: true,
              description: 'Original FM4 API hash code',
            },
          },
        },
        SearchResults: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
              example: 'radiohead',
            },
            type: {
              type: 'string',
              enum: ['all', 'broadcasts', 'items'],
              description: 'Search type',
            },
            results: {
              type: 'array',
              items: {
                oneOf: [
                  { $ref: '#/components/schemas/Broadcast' },
                  { $ref: '#/components/schemas/BroadcastItem' },
                ],
              },
            },
            total: {
              type: 'integer',
              description: 'Total number of results (for broadcasts/items type)',
            },
            counts: {
              type: 'object',
              description: 'Result counts (for all type)',
              properties: {
                broadcasts: {
                  type: 'integer',
                },
                items: {
                  type: 'integer',
                },
                total: {
                  type: 'integer',
                },
              },
            },
            limit: {
              type: 'integer',
              description: 'Results per page',
            },
            offset: {
              type: 'integer',
              description: 'Offset for pagination',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
              example: 'Validation failed',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
              example: 'Parameter "day" must be a valid date in YYYYMMDD format',
            },
            details: {
              type: 'object',
              description: 'Additional error details',
              nullable: true,
            },
            parameter: {
              type: 'string',
              description: 'Parameter that caused the error',
              nullable: true,
              example: 'day',
            },
            path: {
              type: 'string',
              description: 'API endpoint path',
              example: '/api/broadcasts/abc123',
            },
            method: {
              type: 'string',
              description: 'HTTP method',
              example: 'GET',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp',
            },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Invalid parameter format',
            },
            message: {
              type: 'string',
              example: 'Parameter "day" must be a valid date in YYYYMMDD format',
            },
            parameter: {
              type: 'string',
              example: 'day',
            },
            received: {
              type: 'string',
              example: 'abc123',
            },
            format: {
              type: 'string',
              example: 'YYYYMMDD',
            },
            example: {
              type: 'string',
              example: '20251101',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/server.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
