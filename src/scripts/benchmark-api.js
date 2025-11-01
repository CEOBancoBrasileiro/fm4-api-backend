import axios from 'axios';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DATABASE_PATH = process.env.DATABASE_PATH || join(rootDir, 'data/fm4.db');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class ApiBenchmark {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.failedTests = 0;
    this.totalTime = 0;
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  // Format time in milliseconds with color coding
  formatTime(ms) {
    const formatted = ms.toFixed(3);
    if (ms < 50) return `${colors.green}${formatted}ms${colors.reset}`;
    if (ms < 200) return `${colors.yellow}${formatted}ms${colors.reset}`;
    return `${colors.red}${formatted}ms${colors.reset}`;
  }

  // Format file size
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  // Format number with thousand separators
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  // Run a single API test
  async runTest(name, method, path, options = {}) {
    const startTime = performance.now();
    let response;
    let error = null;

    try {
      response = await this.client({
        method,
        url: path,
        ...options
      });
    } catch (err) {
      error = err;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const result = {
      name,
      method: method.toUpperCase(),
      path,
      duration,
      status: response?.status || 0,
      statusText: response?.statusText || 'ERROR',
      responseSize: response?.data ? JSON.stringify(response.data).length : 0,
      success: response && response.status >= 200 && response.status < 300,
      error: error?.message || null,
      response: response?.data
    };

    this.results.push(result);
    this.totalTests++;
    this.totalTime += duration;

    if (!result.success) {
      this.failedTests++;
    }

    // Print result
    const statusColor = result.success ? colors.green : colors.red;
    const icon = result.success ? '✓' : '✗';
    
    console.log(
      `  ${statusColor}${icon}${colors.reset} ${name.padEnd(50)} ` +
      `${statusColor}${result.status}${colors.reset} ` +
      `${this.formatTime(duration)} ` +
      `${colors.dim}${this.formatSize(result.responseSize)}${colors.reset}`
    );

    if (!result.success && result.error) {
      console.log(`     ${colors.red}Error: ${result.error}${colors.reset}`);
    }

    return result;
  }

  // Run a test that expects an error status
  async runErrorTest(name, method, path, expectedStatus, options = {}) {
    const startTime = performance.now();
    let response;
    let error = null;

    try {
      response = await this.client({
        method,
        url: path,
        ...options
      });
    } catch (err) {
      error = err;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const result = {
      name,
      method: method.toUpperCase(),
      path,
      duration,
      status: response?.status || 0,
      statusText: response?.statusText || 'ERROR',
      responseSize: response?.data ? JSON.stringify(response.data).length : 0,
      success: response && response.status === expectedStatus,
      error: error?.message || null,
      expectedStatus,
      response: response?.data
    };

    this.results.push(result);
    this.totalTests++;
    this.totalTime += duration;

    if (!result.success) {
      this.failedTests++;
    }

    // Print result
    const statusColor = result.success ? colors.green : colors.red;
    const icon = result.success ? '✓' : '✗';
    
    console.log(
      `  ${statusColor}${icon}${colors.reset} ${name.padEnd(50)} ` +
      `${statusColor}${result.status}${colors.reset} ` +
      `${this.formatTime(duration)} ` +
      `${colors.dim}${this.formatSize(result.responseSize)}${colors.reset}`
    );

    if (!result.success) {
      console.log(`     ${colors.yellow}Expected ${expectedStatus}, got ${result.status}${colors.reset}`);
    }

    return result;
  }

  // Run multiple iterations of a test
  async runTestMultiple(name, method, path, iterations, options = {}) {
    const times = [];
    let lastResult;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      try {
        const response = await this.client({
          method,
          url: path,
          ...options
        });
        const endTime = performance.now();
        times.push(endTime - startTime);
        lastResult = response;
      } catch (err) {
        times.push(-1);
      }
    }

    const validTimes = times.filter(t => t >= 0);
    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const minTime = Math.min(...validTimes);
    const maxTime = Math.max(...validTimes);

    const result = {
      name: `${name} (${iterations}x)`,
      method: method.toUpperCase(),
      path,
      iterations,
      avgDuration: avgTime,
      minDuration: minTime,
      maxDuration: maxTime,
      status: lastResult?.status || 0,
      success: validTimes.length === iterations && lastResult?.status >= 200 && lastResult?.status < 300,
      responseSize: lastResult?.data ? JSON.stringify(lastResult.data).length : 0
    };

    this.results.push(result);
    this.totalTests++;
    this.totalTime += avgTime;

    if (!result.success) {
      this.failedTests++;
    }

    const statusColor = result.success ? colors.green : colors.red;
    const icon = result.success ? '✓' : '✗';
    
    console.log(
      `  ${statusColor}${icon}${colors.reset} ${result.name.padEnd(50)} ` +
      `${statusColor}${result.status}${colors.reset} ` +
      `avg: ${this.formatTime(avgTime)} ` +
      `min: ${this.formatTime(minTime)} ` +
      `max: ${this.formatTime(maxTime)}`
    );

    return result;
  }

  printHeader(title) {
    console.log('\n' + '═'.repeat(80));
    console.log(`  ${colors.bright}${title}${colors.reset}`);
    console.log('═'.repeat(80));
  }

  printSummary() {
    console.log('\n' + '═'.repeat(80));
    console.log(`  ${colors.bright}BENCHMARK SUMMARY${colors.reset}`);
    console.log('═'.repeat(80));
    console.log();

    const successRate = ((this.totalTests - this.failedTests) / this.totalTests * 100).toFixed(1);
    const avgTime = (this.totalTime / this.totalTests).toFixed(3);

    console.log(`  Total Tests:     ${this.formatNumber(this.totalTests)}`);
    console.log(`  Passed:          ${colors.green}${this.totalTests - this.failedTests}${colors.reset}`);
    console.log(`  Failed:          ${this.failedTests > 0 ? colors.red : colors.green}${this.failedTests}${colors.reset}`);
    console.log(`  Success Rate:    ${successRate >= 95 ? colors.green : colors.yellow}${successRate}%${colors.reset}`);
    console.log(`  Total Time:      ${this.formatTime(this.totalTime)}`);
    console.log(`  Average Time:    ${this.formatTime(parseFloat(avgTime))}`);
    console.log();

    // Top 5 slowest endpoints
    const slowestTests = [...this.results]
      .filter(r => r.success && r.duration)
      .sort((a, b) => (b.duration || b.avgDuration) - (a.duration || a.avgDuration))
      .slice(0, 5);

    if (slowestTests.length > 0) {
      console.log(`  ${colors.bright}Top 5 Slowest Endpoints:${colors.reset}`);
      slowestTests.forEach((test, i) => {
        const time = test.duration || test.avgDuration;
        console.log(`    ${i + 1}. ${test.name.padEnd(45)} ${this.formatTime(time)}`);
      });
      console.log();
    }

    // Top 5 fastest endpoints
    const fastestTests = [...this.results]
      .filter(r => r.success && r.duration)
      .sort((a, b) => (a.duration || a.avgDuration) - (b.duration || b.avgDuration))
      .slice(0, 5);

    if (fastestTests.length > 0) {
      console.log(`  ${colors.bright}Top 5 Fastest Endpoints:${colors.reset}`);
      fastestTests.forEach((test, i) => {
        const time = test.duration || test.avgDuration;
        console.log(`    ${i + 1}. ${test.name.padEnd(45)} ${this.formatTime(time)}`);
      });
      console.log();
    }

    const icon = this.failedTests === 0 ? '✅' : '❌';
    console.log(`${icon} Benchmark ${this.failedTests === 0 ? 'completed successfully' : 'completed with failures'}!\n`);
  }

  async run() {
    console.log('\n' + '╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(20) + `${colors.bright}FM4 API BENCHMARK${colors.reset}` + ' '.repeat(41) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log(`API Base URL: ${colors.cyan}${API_BASE_URL}${colors.reset}`);
    console.log(`Database: ${colors.cyan}${DATABASE_PATH}${colors.reset}\n`);

    // Check if server is running
    try {
      await this.client.get('/health');
      console.log(`${colors.green}✓${colors.reset} Server is running\n`);
    } catch (error) {
      console.log(`${colors.red}✗ Server is not running at ${API_BASE_URL}${colors.reset}`);
      console.log(`${colors.yellow}Please start the server with: npm start${colors.reset}\n`);
      process.exit(1);
    }

    // Load test data from database
    console.log('Loading test data from database...');
    const db = new Database(DATABASE_PATH, { readonly: true });

    // Get sample broadcasts
    const broadcasts = db.prepare('SELECT * FROM broadcasts ORDER BY start_time DESC LIMIT 10').all();
    const programKeys = db.prepare('SELECT DISTINCT program_key FROM broadcasts LIMIT 5').all();
    const broadcastDays = db.prepare('SELECT DISTINCT broadcast_day FROM broadcasts ORDER BY broadcast_day DESC LIMIT 5').all();
    const items = db.prepare('SELECT * FROM broadcast_items LIMIT 10').all();
    const images = db.prepare('SELECT * FROM images WHERE resolution_type = ? LIMIT 5').all('high');
    const lowResImages = db.prepare('SELECT * FROM images WHERE resolution_type = ? LIMIT 1').all('low');

    db.close();

    console.log(`  ${colors.green}✓${colors.reset} Loaded ${broadcasts.length} broadcasts`);
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${programKeys.length} program keys`);
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${broadcastDays.length} broadcast days`);
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${items.length} items`);
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${images.length} high-res images`);
    console.log(`  ${colors.green}✓${colors.reset} Loaded ${lowResImages.length} low-res images`);

    // System Endpoints
    this.printHeader('SYSTEM ENDPOINTS');
    await this.runTest('Health Check', 'GET', '/health');
    await this.runTest('API Root', 'GET', '/');
    await this.runTest('API Documentation', 'GET', '/api-docs/');

    // Live Endpoint
    this.printHeader('LIVE BROADCAST');
    await this.runTest('Get Live Broadcast', 'GET', '/api/live');
    await this.runTestMultiple('Get Live Broadcast (stress)', 'GET', '/api/live', 10);

    // Broadcasts Endpoints
    this.printHeader('BROADCASTS');
    await this.runTest('Get All Broadcasts', 'GET', '/api/broadcasts');

    if (broadcastDays.length > 0) {
      for (let i = 0; i < Math.min(3, broadcastDays.length); i++) {
        const day = broadcastDays[i].broadcast_day;
        await this.runTest(`Get Broadcasts by Day (${day})`, 'GET', `/api/broadcasts/${day}`);
      }
    }

    if (broadcasts.length > 0) {
      for (let i = 0; i < Math.min(3, broadcasts.length); i++) {
        const b = broadcasts[i];
        await this.runTest(
          `Get Broadcast (${b.program_key}/${b.broadcast_day})`,
          'GET',
          `/api/broadcast/${b.program_key}/${b.broadcast_day}`
        );
      }

      // Stress test a single broadcast
      const b = broadcasts[0];
      await this.runTestMultiple(
        'Get Broadcast (stress)',
        'GET',
        `/api/broadcast/${b.program_key}/${b.broadcast_day}`,
        20
      );
    }

    // Broadcast Items
    this.printHeader('BROADCAST ITEMS');
    if (items.length > 0) {
      // Filter items that have item_id (not all do)
      const itemsWithId = items.filter(item => item.item_id !== null);
      
      if (itemsWithId.length > 0) {
        for (let i = 0; i < Math.min(3, itemsWithId.length); i++) {
          const item = itemsWithId[i];
          await this.runTest(`Get Item by ID (${item.item_id})`, 'GET', `/api/item/${item.item_id}`);
        }

        // Stress test item retrieval
        await this.runTestMultiple('Get Item (stress)', 'GET', `/api/item/${itemsWithId[0].item_id}`, 20);
      } else {
        console.log(`  ${colors.yellow}⚠${colors.reset} No items with item_id found for testing`);
      }
    }

    // Program Keys
    this.printHeader('PROGRAM KEYS');
    await this.runTest('Get All Program Keys', 'GET', '/api/program-keys');

    // Search
    this.printHeader('SEARCH (FULL-TEXT)');
    const searchTerms = ['music', 'rock', 'morning', 'news', 'radio'];
    
    for (const term of searchTerms) {
      await this.runTest(`Search: "${term}"`, 'GET', `/api/search?q=${term}`);
    }

    await this.runTest('Search with type=broadcasts', 'GET', '/api/search?q=music&type=broadcasts');
    await this.runTest('Search with type=items', 'GET', '/api/search?q=music&type=items');
    await this.runTest('Search with limit', 'GET', '/api/search?q=music&limit=10');
    await this.runTest('Search with offset', 'GET', '/api/search?q=music&limit=10&offset=10');

    // Stress test search
    await this.runTestMultiple('Search (stress)', 'GET', '/api/search?q=music', 15);

    // Images
    this.printHeader('IMAGES');
    if (images.length > 0) {
      for (let i = 0; i < Math.min(3, images.length); i++) {
        const img = images[i];
        await this.runTest(`Get Image (${img.hash.substring(0, 8)}...)`, 'GET', `/images/${img.hash}`);
      }

      // Test different resolutions
      const img = images[0];
      await this.runTest('Get Image (high resolution)', 'GET', `/images/${img.hash}?resolution=high`);
      
      if (lowResImages.length > 0) {
        await this.runTest('Get Image (low resolution)', 'GET', `/images/${lowResImages[0].hash}?resolution=low`);
      }

      // Stress test image serving
      await this.runTestMultiple('Get Image (stress)', 'GET', `/images/${img.hash}`, 10);
    }

    // Error Handling Tests (these should return errors)
    this.printHeader('ERROR HANDLING (Expected Errors)');
    await this.runErrorTest('404 - Invalid Endpoint', 'GET', '/api/nonexistent', 404);
    await this.runErrorTest('400 - Invalid Broadcast', 'GET', '/api/broadcast/invalid/99999999', 400);
    await this.runErrorTest('400 - Invalid Day Format', 'GET', '/api/broadcasts/invalid', 400);
    await this.runErrorTest('400 - Invalid Search Query', 'GET', '/api/search?q=', 400);
    await this.runErrorTest('400 - Invalid Image Hash', 'GET', '/images/invalid', 400);
    await this.runErrorTest('404 - Nonexistent Item', 'GET', '/api/item/999999999', 404);

    // Edge Cases
    this.printHeader('EDGE CASES & VALIDATION');
    await this.runTest('Search - Very Long Query', 'GET', '/api/search?q=' + 'a'.repeat(200));
    await this.runTest('Search - Special Characters', 'GET', '/api/search?q=' + encodeURIComponent('rock & roll'));
    await this.runErrorTest('Search - Large Limit (should fail)', 'GET', '/api/search?q=music&limit=500', 400);
    await this.runTest('Broadcast - Future Date', 'GET', '/api/broadcasts/20991231');

    // Concurrent Requests Test
    this.printHeader('CONCURRENT REQUESTS');
    console.log('  Running 50 concurrent requests...');
    const concurrentStart = performance.now();
    
    const concurrentPromises = [];
    for (let i = 0; i < 50; i++) {
      const randomBroadcast = broadcasts[Math.floor(Math.random() * broadcasts.length)];
      concurrentPromises.push(
        this.client.get(`/api/broadcast/${randomBroadcast.program_key}/${randomBroadcast.broadcast_day}`)
      );
    }

    const concurrentResults = await Promise.allSettled(concurrentPromises);
    const concurrentEnd = performance.now();
    const concurrentDuration = concurrentEnd - concurrentStart;
    const successfulConcurrent = concurrentResults.filter(r => r.status === 'fulfilled').length;

    console.log(
      `  ${colors.green}✓${colors.reset} Completed 50 concurrent requests in ${this.formatTime(concurrentDuration)}`
    );
    console.log(`  ${colors.green}✓${colors.reset} Success rate: ${successfulConcurrent}/50`);
    console.log(`  ${colors.green}✓${colors.reset} Avg time per request: ${this.formatTime(concurrentDuration / 50)}`);

    this.results.push({
      name: 'Concurrent Requests (50x)',
      method: 'GET',
      path: 'multiple',
      duration: concurrentDuration,
      avgDuration: concurrentDuration / 50,
      status: 200,
      success: successfulConcurrent === 50,
      concurrent: true
    });
    this.totalTests++;
    this.totalTime += concurrentDuration;

    // Print summary
    this.printSummary();

    // Save results to JSON
    const resultsDir = join(rootDir, 'benchmark-results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const resultsPath = join(resultsDir, `api-benchmark-${timestamp}.json`);

    const resultsData = {
      timestamp: new Date().toISOString(),
      apiBaseUrl: API_BASE_URL,
      summary: {
        totalTests: this.totalTests,
        passed: this.totalTests - this.failedTests,
        failed: this.failedTests,
        successRate: ((this.totalTests - this.failedTests) / this.totalTests * 100).toFixed(2),
        totalTime: this.totalTime,
        averageTime: this.totalTime / this.totalTests
      },
      results: this.results
    };

    writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
    console.log(`  Results saved to: ${colors.cyan}${resultsPath}${colors.reset}\n`);
  }
}

// Run benchmark
const benchmark = new ApiBenchmark();
benchmark.run().catch(error => {
  console.error(`${colors.red}Benchmark failed: ${error.message}${colors.reset}`);
  process.exit(1);
});
