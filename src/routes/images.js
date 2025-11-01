import express from 'express';
import { existsSync } from 'fs';
import imageService from '../services/image-service.js';
import logger from '../utils/logger.js';
import { asyncHandler, validateImageHash, validateEnum } from '../middleware/validation.js';
import { ApiError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * @openapi
 * /images/{hash}:
 *   get:
 *     summary: Get Image
 *     description: Serve image by SHA-256 hash with optional resolution parameter
 *     tags:
 *       - Images
 *     parameters:
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[a-f0-9]{64}$'
 *           example: a1b2c3d4e5f6789...
 *         description: SHA-256 hash of the image
 *       - in: query
 *         name: resolution
 *         required: false
 *         schema:
 *           type: string
 *           enum: [low, high]
 *           default: high
 *         description: Image resolution (low or high)
 *     responses:
 *       200:
 *         description: Image file
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid hash format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Image not found
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
router.get('/:hash', 
  validateImageHash,
  validateEnum('resolution', ['low', 'high'], 'query', { optional: true }),
  asyncHandler(async (req, res) => {
    const { hash } = req.params;
    const resolutionType = req.query.resolution || 'high';

    const imagePath = imageService.getImagePath(hash, resolutionType);
    
    if (!imagePath || !existsSync(imagePath)) {
      throw new ApiError(404, `Image not found: ${hash} (${resolutionType} resolution)`);
    }

    // Determine content type based on file extension
    const ext = imagePath.split('.').pop().toLowerCase();
    const contentTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif'
    };

    const contentType = contentTypes[ext] || 'image/jpeg';
    
    // Set caching headers (1 year since images are content-addressed)
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });

    res.sendFile(imagePath);
  })
);

export default router;
