import sharp from 'sharp';
import { createHash } from 'crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import fm4Api from './fm4-api.js';
import db from '../database/database.js';

class ImageService {
  constructor() {
    // Ensure absolute path for image storage
    this.storagePath = resolve(config.images.storagePath);
    this.maxWidth = config.images.maxWidth;
    this.ensureStorageDirectory();
  }

  ensureStorageDirectory() {
    if (!existsSync(this.storagePath)) {
      mkdirSync(this.storagePath, { recursive: true });
      logger.info(`Created image storage directory: ${this.storagePath}`);
    }
  }

  generateHash(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async processAndStoreImage(imageUrl, imageMetadata = {}, resolutionType = 'high') {
    try {
      // Download image
      const imageBuffer = await fm4Api.downloadImage(imageUrl);
      
      // Generate hash from downloaded content
      const hash = this.generateHash(imageBuffer);
      
      // Check if image already exists by hash and resolution - if so, return existing
      const existingImage = db.getImageByHash(hash, resolutionType);
      if (existingImage) {
        logger.debug(`Image already exists with hash: ${hash} (${resolutionType}), reusing`);
        return existingImage;
      }

      // Process image with sharp
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Resize if needed (only for high-res images)
      let processedBuffer = imageBuffer;
      let finalWidth = metadata.width;
      let finalHeight = metadata.height;
      
      if (resolutionType === 'high' && metadata.width > this.maxWidth) {
        processedBuffer = await image
          .resize(this.maxWidth, null, { withoutEnlargement: true })
          .toBuffer();
        const resizedMeta = await sharp(processedBuffer).metadata();
        finalWidth = resizedMeta.width;
        finalHeight = resizedMeta.height;
      }

      // Save to disk with resolution type in filename
      const fileName = `${hash}_${resolutionType}.${metadata.format || 'jpg'}`;
      const filePath = join(this.storagePath, fileName);
      writeFileSync(filePath, processedBuffer);

      // Store in database
      const imageRecord = {
        hash,
        resolutionType,
        originalHashCode: imageMetadata.hashCode || null,
        alt: imageMetadata.alt || null,
        text: imageMetadata.text || null,
        category: imageMetadata.category || null,
        copyright: imageMetadata.copyright || null,
        mode: imageMetadata.mode || null,
        filePath: fileName,
        width: finalWidth,
        height: finalHeight,
        fileSize: processedBuffer.length
      };

      db.insertImage(imageRecord);
      logger.info(`Stored new ${resolutionType} image: ${hash} (${finalWidth}x${finalHeight})`);

      return { ...imageRecord, id: db.getImageByHash(hash, resolutionType).id };
    } catch (error) {
      logger.error(`Failed to process ${resolutionType} image ${imageUrl}: ${error.message}`);
      return null;
    }
  }

  async processImageVersions(imageData) {
    if (!imageData || !imageData.versions || imageData.versions.length === 0) {
      return { high: null, low: null };
    }

    const imageMetadata = {
      hashCode: imageData.hashCode,
      alt: imageData.alt,
      text: imageData.text,
      category: imageData.category,
      copyright: imageData.copyright,
      mode: imageData.mode
    };

    // Get the highest resolution version
    const largestVersion = imageData.versions.reduce((prev, current) => 
      (current.width > prev.width) ? current : prev
    );

    // Get the lowest resolution version
    const smallestVersion = imageData.versions.reduce((prev, current) => 
      (current.width < prev.width) ? current : prev
    );

    // Process both resolutions
    const highResImage = await this.processAndStoreImage(largestVersion.path, imageMetadata, 'high');
    
    // Only process low res if it's different from high res
    let lowResImage = null;
    if (smallestVersion.path !== largestVersion.path) {
      lowResImage = await this.processAndStoreImage(smallestVersion.path, imageMetadata, 'low');
    } else {
      // If only one resolution exists, use the same image for both
      lowResImage = highResImage;
    }

    return { high: highResImage, low: lowResImage };
  }

  async processBroadcastImages(broadcast, broadcastId) {
    if (!broadcast.images || broadcast.images.length === 0) {
      return [];
    }

    // Check if images already exist for this broadcast
    const existingImages = db.getImageReferences('broadcast', broadcastId);
    if (existingImages.length > 0) {
      return existingImages.map(img => ({ ...img, alreadyExisted: true }));
    }

    const processedImages = [];
    for (const imageData of broadcast.images) {
      const images = await this.processImageVersions(imageData);
      
      // Add high resolution image
      if (images.high) {
        processedImages.push({ ...images.high, alreadyExisted: false });
        db.addImageReference('broadcast', broadcastId, images.high.id, 'high');
      }
      
      // Add low resolution image
      if (images.low && images.low.id !== images.high?.id) {
        processedImages.push({ ...images.low, alreadyExisted: false });
        db.addImageReference('broadcast', broadcastId, images.low.id, 'low');
      } else if (images.low && images.high) {
        // If they're the same, still add the reference for 'low'
        db.addImageReference('broadcast', broadcastId, images.high.id, 'low');
      }
    }

    logger.info(`Processed ${processedImages.length} new broadcast images (high and low res)`);
    return processedImages;
  }

  async processBroadcastItemImages(item, itemId) {
    if (!item.images || item.images.length === 0) {
      return [];
    }

    // Check if images already exist for this item
    const existingImages = db.getImageReferences('broadcast_item', itemId);
    if (existingImages.length > 0) {
      return existingImages.map(img => ({ ...img, alreadyExisted: true }));
    }

    const processedImages = [];
    for (const imageData of item.images) {
      const images = await this.processImageVersions(imageData);
      
      // Add high resolution image
      if (images.high) {
        processedImages.push({ ...images.high, alreadyExisted: false });
        db.addImageReference('broadcast_item', itemId, images.high.id, 'high');
      }
      
      // Add low resolution image
      if (images.low && images.low.id !== images.high?.id) {
        processedImages.push({ ...images.low, alreadyExisted: false });
        db.addImageReference('broadcast_item', itemId, images.low.id, 'low');
      } else if (images.low && images.high) {
        // If they're the same, still add the reference for 'low'
        db.addImageReference('broadcast_item', itemId, images.high.id, 'low');
      }
    }

    if (processedImages.length > 0) {
      logger.info(`Processed ${processedImages.length} new images for item ${itemId} (high and low res)`);
    }
    return processedImages;
  }

  getImagePath(hash, resolutionType = 'high') {
    const image = db.getImageByHash(hash, resolutionType);
    if (!image) return null;
    return join(this.storagePath, image.file_path);
  }

  getImageBuffer(hash) {
    const imagePath = this.getImagePath(hash);
    if (!imagePath || !existsSync(imagePath)) return null;
    return readFileSync(imagePath);
  }

  /**
   * Delete physical image files from disk for unreferenced images
   * Should be called after deleteUnreferencedImages() removes DB records
   * 
   * @returns {Object} { deleted: number, errors: Array }
   */
  cleanupOrphanedImageFiles() {
    const deleted = [];
    const errors = [];
    
    try {
      // Get all image records from database
      const allImages = db.db.prepare('SELECT hash, resolution_type, file_path FROM images').all();
      const dbImageHashes = new Set(allImages.map(img => `${img.hash}_${img.resolution_type}`));
      
      // Scan image storage directory
      if (!existsSync(this.storagePath)) {
        logger.info('Image storage directory does not exist, nothing to cleanup');
        return { deleted: 0, errors: [] };
      }
      
      const files = readdirSync(this.storagePath);
      
      for (const file of files) {
        // Skip non-image files
        if (!/\.(jpg|jpeg|png|webp)$/i.test(file)) continue;
        
        const filePath = join(this.storagePath, file);
        
        // Extract hash and resolution from filename (format: hash_high.jpg or hash_low.jpg)
        const match = file.match(/^([a-f0-9]{64})_(high|low)\.(jpg|jpeg|png|webp)$/i);
        if (!match) {
          logger.warn(`Skipping file with unexpected format: ${file}`);
          continue;
        }
        
        const [, hash, resolutionType] = match;
        const imageKey = `${hash}_${resolutionType}`;
        
        // If this file is not in the database, delete it
        if (!dbImageHashes.has(imageKey)) {
          try {
            unlinkSync(filePath);
            deleted.push(file);
            logger.debug(`Deleted orphaned image file: ${file}`);
          } catch (error) {
            errors.push({ file, error: error.message });
            logger.error(`Failed to delete image file ${file}: ${error.message}`);
          }
        }
      }
      
      if (deleted.length > 0) {
        logger.info(`Cleaned up ${deleted.length} orphaned image files from disk`);
      } else {
        logger.info('No orphaned image files found on disk');
      }
      
      return { deleted: deleted.length, errors };
    } catch (error) {
      logger.error(`Failed to cleanup orphaned image files: ${error.message}`);
      return { deleted: deleted.length, errors: [...errors, { file: 'general', error: error.message }] };
    }
  }
}

export default new ImageService();
