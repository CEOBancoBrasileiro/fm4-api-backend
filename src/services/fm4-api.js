import axios from 'axios';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class FM4ApiClient {
  constructor() {
    this.baseUrl = config.fm4.apiBaseUrl;
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'FM4-Backend-API/1.0'
      }
    });
  }

  async getLive() {
    try {
      const url = `${this.baseUrl}/live`;
      logger.info(`Fetching live data from: ${url}`);
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch live data: ${error.message}`);
      throw error;
    }
  }

  async getBroadcasts() {
    try {
      const url = `${this.baseUrl}/broadcasts`;
      logger.info(`Fetching broadcasts from: ${url}`);
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch broadcasts: ${error.message}`);
      throw error;
    }
  }

  async getBroadcast(programKey, broadcastDay) {
    try {
      const url = `${this.baseUrl.replace('/json/', '/api/json/')}/broadcast/${programKey}/${broadcastDay}`;
      logger.info(`Fetching broadcast: ${programKey}/${broadcastDay}`);
      const response = await this.client.get(url);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Broadcast not found: ${programKey}/${broadcastDay}`);
        return null;
      }
      logger.error(`Failed to fetch broadcast ${programKey}/${broadcastDay}: ${error.message}`);
      throw error;
    }
  }

  async getBroadcastWithRetry(programKey, broadcastDay, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.getBroadcast(programKey, broadcastDay);
      } catch (error) {
        if (i === retries - 1) throw error;
        const delay = Math.pow(2, i) * 1000;
        logger.warn(`Retry ${i + 1}/${retries} for ${programKey}/${broadcastDay} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  formatBroadcastDay(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  }

  async downloadImage(url) {
    try {
      const response = await this.client.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000
      });
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`Failed to download image ${url}: ${error.message}`);
      throw error;
    }
  }
}

export default new FM4ApiClient();
