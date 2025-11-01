import Database from 'better-sqlite3';
import { performance } from 'perf_hooks';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../../');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

class DatabaseBenchmark {
  constructor() {
    // Use the actual production database
    this.dbPath = resolve(rootDir, 'data/fm4.db');
    this.db = null;
    this.results = {
      metadata: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      benchmarks: [],
      summary: {
        totalTests: 0,
        totalTime: 0,
        fastest: null,
        slowest: null,
      },
    };
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  logHeader(message) {
    console.log();
    this.log('═'.repeat(80), colors.bright);
    this.log(`  ${message}`, colors.bright + colors.cyan);
    this.log('═'.repeat(80), colors.bright);
  }

  logBenchmark(name, time, opsPerSec, extra = '') {
    const timeStr = time.toFixed(3).padStart(10);
    const opsStr = opsPerSec.toLocaleString('en-US', { maximumFractionDigits: 0 }).padStart(15);
    this.log(`  ${name.padEnd(45)} ${timeStr}ms ${opsStr} ops/sec ${extra}`, colors.green);
  }

  initialize() {
    this.log('Initializing database benchmark...', colors.bright);
    this.log(`Database: ${this.dbPath}`, colors.yellow);

    if (!existsSync(this.dbPath)) {
      throw new Error(`Database not found at ${this.dbPath}`);
    }

    this.db = new Database(this.dbPath, { readonly: true });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = normal');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = memory');

    // Get database stats
    const stats = {
      broadcasts: this.db.prepare('SELECT COUNT(*) as count FROM broadcasts').get().count,
      items: this.db.prepare('SELECT COUNT(*) as count FROM broadcast_items').get().count,
      images: this.db.prepare('SELECT COUNT(*) as count FROM images').get().count,
      imageRefs: this.db.prepare('SELECT COUNT(*) as count FROM image_references').get().count,
      programKeys: this.db.prepare('SELECT COUNT(*) as count FROM program_keys').get().count,
      dbSize: this.getDbSize(),
    };

    this.log('\nDatabase Statistics:', colors.bright);
    this.log(`  Broadcasts:      ${stats.broadcasts.toLocaleString()}`, colors.cyan);
    this.log(`  Broadcast Items: ${stats.items.toLocaleString()}`, colors.cyan);
    this.log(`  Images:          ${stats.images.toLocaleString()}`, colors.cyan);
    this.log(`  Image Refs:      ${stats.imageRefs.toLocaleString()}`, colors.cyan);
    this.log(`  Program Keys:    ${stats.programKeys.toLocaleString()}`, colors.cyan);
    this.log(`  Database Size:   ${(stats.dbSize / 1024 / 1024).toFixed(2)} MB`, colors.cyan);

    this.results.metadata.databaseStats = stats;

    return stats;
  }

  getDbSize() {
    const result = this.db.prepare(`
      SELECT page_count * page_size as size 
      FROM pragma_page_count(), pragma_page_size()
    `).get();
    return result.size;
  }

  benchmark(name, fn, iterations = 1000) {
    // Warmup
    for (let i = 0; i < Math.min(10, iterations); i++) {
      fn();
    }

    // Actual benchmark
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;
    const opsPerSec = (1000 / avgTime) * 1;

    const result = {
      name,
      iterations,
      totalTime,
      avgTime,
      opsPerSec,
    };

    this.results.benchmarks.push(result);
    this.results.summary.totalTests++;
    this.results.summary.totalTime += totalTime;

    if (!this.results.summary.fastest || avgTime < this.results.summary.fastest.avgTime) {
      this.results.summary.fastest = result;
    }
    if (!this.results.summary.slowest || avgTime > this.results.summary.slowest.avgTime) {
      this.results.summary.slowest = result;
    }

    this.logBenchmark(name, avgTime, opsPerSec, `(${iterations}x)`);
    return result;
  }

  // === BROADCAST QUERIES ===

  benchmarkBroadcastQueries() {
    this.logHeader('BROADCAST QUERIES');

    // Get a sample broadcast for testing
    const sampleBroadcast = this.db.prepare('SELECT * FROM broadcasts LIMIT 1').get();
    const sampleDay = sampleBroadcast.broadcast_day;
    const sampleProgram = sampleBroadcast.program_key;

    // Get by day and program key (primary lookup)
    this.benchmark(
      'Get broadcast by day+program (indexed)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts WHERE broadcast_day = ? AND program_key = ?')
          .get(sampleDay, sampleProgram);
      },
      10000
    );

    // Get by ID
    this.benchmark(
      'Get broadcast by ID (primary key)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(sampleBroadcast.id);
      },
      10000
    );

    // Get broadcasts by date range
    this.benchmark(
      'Get broadcasts by date range (7 days)',
      () => {
        this.db.prepare(`
          SELECT * FROM broadcasts 
          WHERE broadcast_day >= ? AND broadcast_day <= ?
          ORDER BY broadcast_day DESC
        `).all(sampleDay - 7, sampleDay);
      },
      5000
    );

    // Get all broadcasts (with limit)
    this.benchmark(
      'Get all broadcasts (LIMIT 1000)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts ORDER BY broadcast_day DESC LIMIT 1000').all();
      },
      1000
    );

    // Count broadcasts
    this.benchmark(
      'Count all broadcasts',
      () => {
        this.db.prepare('SELECT COUNT(*) as count FROM broadcasts').get();
      },
      10000
    );

    // Get broadcasts with items (JOIN)
    this.benchmark(
      'Get broadcast with items (JOIN)',
      () => {
        this.db.prepare(`
          SELECT b.*, bi.* 
          FROM broadcasts b
          LEFT JOIN broadcast_items bi ON b.id = bi.broadcast_id
          WHERE b.id = ?
        `).all(sampleBroadcast.id);
      },
      5000
    );
  }

  // === BROADCAST ITEM QUERIES ===

  benchmarkBroadcastItemQueries() {
    this.logHeader('BROADCAST ITEM QUERIES');

    const sampleBroadcast = this.db.prepare('SELECT id FROM broadcasts LIMIT 1').get();
    const sampleItem = this.db.prepare('SELECT * FROM broadcast_items LIMIT 1').get();

    // Get items by broadcast ID
    this.benchmark(
      'Get items by broadcast ID',
      () => {
        this.db.prepare('SELECT * FROM broadcast_items WHERE broadcast_id = ?')
          .all(sampleBroadcast.id);
      },
      5000
    );

    // Get item by item_id
    this.benchmark(
      'Get item by item_id',
      () => {
        this.db.prepare('SELECT * FROM broadcast_items WHERE item_id = ?')
          .get(sampleItem.item_id);
      },
      10000
    );

    // Get item by database ID
    this.benchmark(
      'Get item by database ID (primary key)',
      () => {
        this.db.prepare('SELECT * FROM broadcast_items WHERE id = ?').get(sampleItem.id);
      },
      10000
    );

    // Get items with type filter
    this.benchmark(
      'Get items by type (song)',
      () => {
        this.db.prepare('SELECT * FROM broadcast_items WHERE type = ? LIMIT 100')
          .all('song');
      },
      5000
    );

    // Count items by broadcast
    this.benchmark(
      'Count items by broadcast',
      () => {
        this.db.prepare('SELECT COUNT(*) as count FROM broadcast_items WHERE broadcast_id = ?')
          .get(sampleBroadcast.id);
      },
      10000
    );
  }

  // === FULL-TEXT SEARCH QUERIES ===

  benchmarkFullTextSearch() {
    this.logHeader('FULL-TEXT SEARCH (FTS5)');

    // Check if FTS tables exist
    const ftsExists = this.db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name='broadcasts_fts'
    `).get().count > 0;

    if (!ftsExists) {
      this.log('  ⚠️  FTS tables not found - skipping FTS benchmarks', colors.yellow);
      this.log('  Run migrations to enable FTS: node src/scripts/migrate-add-fts.js', colors.yellow);
      return;
    }

    const searchTerms = ['radiohead', 'rock', 'news', 'music', 'morning'];

    searchTerms.forEach(term => {
      this.benchmark(
        `FTS: Search broadcasts for "${term}"`,
        () => {
          this.db.prepare(`
            SELECT b.*, rank FROM broadcasts b
            JOIN broadcasts_fts ON broadcasts_fts.rowid = b.id
            WHERE broadcasts_fts MATCH ?
            ORDER BY rank
            LIMIT 50
          `).all(term);
        },
        1000
      );

      this.benchmark(
        `FTS: Search items for "${term}"`,
        () => {
          this.db.prepare(`
            SELECT bi.*, rank FROM broadcast_items bi
            JOIN broadcast_items_fts ON broadcast_items_fts.rowid = bi.id
            WHERE broadcast_items_fts MATCH ?
            ORDER BY rank
            LIMIT 50
          `).all(term);
        },
        1000
      );
    });

    // Complex search with pagination
    this.benchmark(
      'FTS: Complex search with pagination',
      () => {
        this.db.prepare(`
          SELECT bi.*, rank FROM broadcast_items bi
          JOIN broadcast_items_fts ON broadcast_items_fts.rowid = bi.id
          WHERE broadcast_items_fts MATCH ?
          ORDER BY rank
          LIMIT 50 OFFSET 0
        `).all('radiohead OR coldplay OR muse');
      },
      1000
    );

    // Count search results
    this.benchmark(
      'FTS: Count search results',
      () => {
        this.db.prepare(`
          SELECT COUNT(*) as count FROM broadcast_items bi
          JOIN broadcast_items_fts ON broadcast_items_fts.rowid = bi.id
          WHERE broadcast_items_fts MATCH ?
        `).get('rock');
      },
      1000
    );
  }

  // === IMAGE QUERIES ===

  benchmarkImageQueries() {
    this.logHeader('IMAGE QUERIES');

    const sampleImage = this.db.prepare('SELECT * FROM images LIMIT 1').get();
    const sampleBroadcast = this.db.prepare('SELECT id FROM broadcasts LIMIT 1').get();

    // Get image by hash
    this.benchmark(
      'Get image by hash (indexed)',
      () => {
        this.db.prepare('SELECT * FROM images WHERE hash = ? AND resolution_type = ?')
          .get(sampleImage.hash, sampleImage.resolution_type);
      },
      10000
    );

    // Get image references by entity
    this.benchmark(
      'Get image references by entity',
      () => {
        this.db.prepare(`
          SELECT ir.*, i.* FROM image_references ir
          JOIN images i ON ir.image_id = i.id
          WHERE ir.entity_type = ? AND ir.entity_id = ?
        `).all('broadcast', sampleBroadcast.id);
      },
      5000
    );

    // Get reference count for image
    this.benchmark(
      'Get image reference count',
      () => {
        this.db.prepare('SELECT COUNT(*) as count FROM image_references WHERE image_id = ?')
          .get(sampleImage.id);
      },
      10000
    );

    // Find unreferenced images
    this.benchmark(
      'Find unreferenced images',
      () => {
        this.db.prepare(`
          SELECT i.* FROM images i
          LEFT JOIN image_references ir ON i.id = ir.image_id
          WHERE ir.id IS NULL
          LIMIT 100
        `).all();
      },
      1000
    );
  }

  // === AGGREGATION QUERIES ===

  benchmarkAggregations() {
    this.logHeader('AGGREGATION QUERIES');

    // Count broadcasts by program key
    this.benchmark(
      'Count broadcasts by program key',
      () => {
        this.db.prepare(`
          SELECT program_key, COUNT(*) as count 
          FROM broadcasts 
          GROUP BY program_key
        `).all();
      },
      1000
    );

    // Count items by type
    this.benchmark(
      'Count items by type',
      () => {
        this.db.prepare(`
          SELECT type, COUNT(*) as count 
          FROM broadcast_items 
          GROUP BY type
        `).all();
      },
      1000
    );

    // Average duration by program
    this.benchmark(
      'Average broadcast duration by program',
      () => {
        this.db.prepare(`
          SELECT program_key, AVG(duration) as avg_duration, COUNT(*) as count
          FROM broadcasts
          WHERE duration IS NOT NULL
          GROUP BY program_key
        `).all();
      },
      1000
    );

    // Complex aggregation with JOIN
    this.benchmark(
      'Count items per broadcast (with JOIN)',
      () => {
        this.db.prepare(`
          SELECT b.program_key, COUNT(bi.id) as item_count
          FROM broadcasts b
          LEFT JOIN broadcast_items bi ON b.id = bi.broadcast_id
          GROUP BY b.program_key
        `).all();
      },
      500
    );
  }

  // === WRITE OPERATIONS (READ-ONLY MODE) ===

  benchmarkWriteOperations() {
    this.logHeader('WRITE OPERATIONS (Simulated - Prepare Only)');

    // Note: We're in read-only mode, so we'll just prepare statements
    // to measure the overhead of statement preparation

    this.benchmark(
      'Prepare INSERT broadcast statement',
      () => {
        this.db.prepare(`
          INSERT OR REPLACE INTO broadcasts (
            id, broadcast_day, program_key, title, start_time, end_time, duration
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
      },
      10000
    );

    this.benchmark(
      'Prepare INSERT item statement',
      () => {
        this.db.prepare(`
          INSERT INTO broadcast_items (
            broadcast_id, item_id, type, title, interpreter, start_time, end_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
      },
      10000
    );

    this.benchmark(
      'Prepare UPDATE broadcast statement',
      () => {
        this.db.prepare('UPDATE broadcasts SET done = ? WHERE id = ?');
      },
      10000
    );

    this.benchmark(
      'Prepare DELETE statement',
      () => {
        this.db.prepare('DELETE FROM broadcasts WHERE broadcast_day < ?');
      },
      10000
    );
  }

  // === TRANSACTION OVERHEAD ===

  benchmarkTransactions() {
    this.logHeader('TRANSACTION OVERHEAD');

    // Single query without transaction
    this.benchmark(
      'Single query (no transaction)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts LIMIT 1').get();
      },
      10000
    );

    // Single query with transaction
    this.benchmark(
      'Single query (with transaction)',
      () => {
        const stmt = this.db.prepare('SELECT * FROM broadcasts LIMIT 1');
        this.db.transaction(() => {
          stmt.get();
        })();
      },
      5000
    );

    // Multiple queries without transaction
    this.benchmark(
      '10 queries (no transaction)',
      () => {
        const stmt = this.db.prepare('SELECT * FROM broadcasts LIMIT 1');
        for (let i = 0; i < 10; i++) {
          stmt.get();
        }
      },
      1000
    );

    // Multiple queries with transaction
    this.benchmark(
      '10 queries (with transaction)',
      () => {
        const stmt = this.db.prepare('SELECT * FROM broadcasts LIMIT 1');
        this.db.transaction(() => {
          for (let i = 0; i < 10; i++) {
            stmt.get();
          }
        })();
      },
      1000
    );
  }

  // === INDEX EFFICIENCY ===

  benchmarkIndexEfficiency() {
    this.logHeader('INDEX EFFICIENCY');

    const sampleDay = this.db.prepare('SELECT broadcast_day FROM broadcasts LIMIT 1').get().broadcast_day;

    // Query with index
    this.benchmark(
      'Query with index (broadcast_day)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts WHERE broadcast_day = ?').all(sampleDay);
      },
      5000
    );

    // Query without index (full table scan)
    this.benchmark(
      'Query without index (done flag - no index)',
      () => {
        this.db.prepare('SELECT * FROM broadcasts WHERE done = ? LIMIT 100').all(1);
      },
      1000
    );

    // Show query plan
    const plan = this.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM broadcasts WHERE broadcast_day = ?').all(sampleDay);
    this.log(`\n  Query plan for indexed query:`, colors.yellow);
    plan.forEach(row => {
      this.log(`    ${row.detail}`, colors.cyan);
    });
  }

  // === STRESS TESTS ===

  benchmarkStressTests() {
    this.logHeader('STRESS TESTS');

    // Large result set
    this.benchmark(
      'Fetch 10,000 broadcasts',
      () => {
        this.db.prepare('SELECT * FROM broadcasts LIMIT 10000').all();
      },
      100
    );

    // Complex JOIN with large result
    this.benchmark(
      'Complex JOIN (broadcasts + items)',
      () => {
        this.db.prepare(`
          SELECT b.*, bi.title as item_title, bi.interpreter
          FROM broadcasts b
          LEFT JOIN broadcast_items bi ON b.id = bi.broadcast_id
          LIMIT 5000
        `).all();
      },
      100
    );

    // Multiple JOINs
    this.benchmark(
      'Multiple JOINs (broadcasts + items + images)',
      () => {
        this.db.prepare(`
          SELECT b.*, bi.title as item_title, i.hash
          FROM broadcasts b
          LEFT JOIN broadcast_items bi ON b.id = bi.broadcast_id
          LEFT JOIN image_references ir ON b.id = ir.entity_id AND ir.entity_type = 'broadcast'
          LEFT JOIN images i ON ir.image_id = i.id
          LIMIT 1000
        `).all();
      },
      100
    );
  }

  // === PRINT SUMMARY ===

  printSummary() {
    this.logHeader('BENCHMARK SUMMARY');

    const { summary } = this.results;

    this.log(`\n  Total Tests:     ${summary.totalTests}`, colors.bright);
    this.log(`  Total Time:      ${summary.totalTime.toFixed(2)}ms`, colors.bright);
    this.log(`  Average Time:    ${(summary.totalTime / summary.totalTests).toFixed(2)}ms`, colors.bright);

    if (summary.fastest) {
      this.log(`\n  Fastest Test:    ${summary.fastest.name}`, colors.green);
      this.log(`                   ${summary.fastest.avgTime.toFixed(3)}ms (${summary.fastest.opsPerSec.toLocaleString()} ops/sec)`, colors.green);
    }

    if (summary.slowest) {
      this.log(`\n  Slowest Test:    ${summary.slowest.name}`, colors.red);
      this.log(`                   ${summary.slowest.avgTime.toFixed(3)}ms (${summary.slowest.opsPerSec.toLocaleString()} ops/sec)`, colors.red);
    }

    // Top 5 fastest
    const top5 = [...this.results.benchmarks]
      .sort((a, b) => a.avgTime - b.avgTime)
      .slice(0, 5);

    this.log(`\n  Top 5 Fastest Operations:`, colors.bright + colors.green);
    top5.forEach((result, i) => {
      this.log(`    ${i + 1}. ${result.name.padEnd(45)} ${result.avgTime.toFixed(3)}ms`, colors.green);
    });

    // Bottom 5 slowest
    const bottom5 = [...this.results.benchmarks]
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5);

    this.log(`\n  Top 5 Slowest Operations:`, colors.bright + colors.red);
    bottom5.forEach((result, i) => {
      this.log(`    ${i + 1}. ${result.name.padEnd(45)} ${result.avgTime.toFixed(3)}ms`, colors.red);
    });

    // Save results to file
    this.saveResults();
  }

  saveResults() {
    import('fs').then(fs => {
      const resultsDir = resolve(rootDir, 'benchmark-results');
      if (!existsSync(resultsDir)) {
        mkdirSync(resultsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `benchmark-${timestamp}.json`;
      const filepath = resolve(resultsDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));

      this.log(`\n  Results saved to: ${filepath}`, colors.yellow);
    });
  }

  cleanup() {
    if (this.db) {
      this.db.close();
    }
  }

  async run() {
    try {
      this.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗', colors.bright + colors.magenta);
      this.log('║                    FM4 DATABASE ULTIMATE BENCHMARK                            ║', colors.bright + colors.magenta);
      this.log('╚═══════════════════════════════════════════════════════════════════════════════╝', colors.bright + colors.magenta);

      this.initialize();

      // Run all benchmark categories
      this.benchmarkBroadcastQueries();
      this.benchmarkBroadcastItemQueries();
      this.benchmarkFullTextSearch();
      this.benchmarkImageQueries();
      this.benchmarkAggregations();
      this.benchmarkWriteOperations();
      this.benchmarkTransactions();
      this.benchmarkIndexEfficiency();
      this.benchmarkStressTests();

      // Print summary
      this.printSummary();

      this.log('\n✅ Benchmark completed successfully!', colors.bright + colors.green);
    } catch (error) {
      this.log(`\n❌ Benchmark failed: ${error.message}`, colors.red);
      console.error(error);
      process.exit(1);
    } finally {
      this.cleanup();
    }
  }
}

// Run benchmark
const benchmark = new DatabaseBenchmark();
benchmark.run();
