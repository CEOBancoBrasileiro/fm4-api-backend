# FM4 Backend API

A comprehensive Node.js backend API for FM4 (Austria's alternative radio station) that provides historical broadcast data, live streaming information, and music metadata. Built with Express.js, SQLite with FTS5 full-text search, and real-time monitoring capabilities.

## 🎯 Features

### Core Functionality
- **Live Broadcast Monitoring** - Real-time tracking of currently playing broadcasts and items
- **Historical Data** - Access to 30+ days of broadcast history with detailed metadata
- **Full-Text Search** - Advanced search across broadcasts and items using SQLite FTS5
- **Image Management** - Dual-resolution image processing and serving
- **RESTful API** - Clean, well-documented API endpoints with Swagger/OpenAPI documentation
- **Real-time Updates** - Automatic live broadcast item detection and database updates

### Technical Features
- **Graceful Shutdown** - Proper signal handling (SIGTERM, SIGINT, SIGHUP, SIGBREAK)
- **Input Validation** - Comprehensive request validation middleware
- **Error Handling** - Global error handler with structured responses
- **Logging** - Winston-based logging with daily rotation and zstd compression
- **Scheduled Tasks** - Automated scraping, cleanup, and monitoring via node-cron
- **Database Optimization** - Indexed queries, prepared statements, and FTS5 search
- **Compression** - Response compression and image optimization with Sharp
- **Security** - Helmet.js security headers and CORS support

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Architecture](#-architecture)
- [Scripts](#-scripts)
- [Benchmarking](#-benchmarking)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

## 🔧 Requirements

- **Node.js** >= 24.0.0
- **NPM** or **Yarn**
- **Storage** - Minimum 500MB for database and images
- **Memory** - Minimum 512MB RAM
- **OS** - Windows, Linux, or macOS

## 📦 Installation

### Quick Start

**Windows (PowerShell):**
```powershell
pwsh start.ps1
```

**Windows (Batch):**
```batch
start.bat
```

**Linux/macOS (Bash):**
```bash
chmod +x start.sh
./start.sh
```

### Manual Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd node-fm4-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Initialize database:**
   ```bash
   npm run init-db
   ```

5. **Initial data scraping (optional but recommended):**
   ```bash
   npm run scrape
   ```

6. **Start the server:**
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./data/fm4.db

# FM4 API Endpoints
FM4_API_BASE_URL=https://audioapi.orf.at/fm4/json/4.0
FM4_LIVE_STREAM_URL=https://orf-live.ors-shoutcast.at/fm4-q2a
FM4_LOOPSTREAM_BASE_URL=https://loopstreamfm4.apa.at

# Scraper Settings
SCRAPE_INTERVAL_HOURS=6
KEEP_HISTORY_DAYS=31

# Image Settings
IMAGE_STORAGE_PATH=./data/images
IMAGE_MAX_WIDTH=1750

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment mode (`development`/`production`) |
| `DATABASE_PATH` | `./data/fm4.db` | SQLite database file path |
| `SCRAPE_INTERVAL_HOURS` | `6` | Hours between automatic scrapes |
| `KEEP_HISTORY_DAYS` | `31` | Days of history to retain |
| `IMAGE_MAX_WIDTH` | `1750` | Maximum image width in pixels |
| `LOG_LEVEL` | `info` | Logging level (`error`/`warn`/`info`/`debug`) |

## 🚀 Usage

### Starting the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

**Using PM2 (recommended for production):**
```bash
npm install -g pm2
pm2 start src/server.js --name fm4-api
pm2 save
pm2 startup
```

### Accessing the API

- **API Base URL:** `http://localhost:3000`
- **API Documentation:** `http://localhost:3000/api-docs`
- **Health Check:** `http://localhost:3000/health`

## 📚 API Documentation

### Interactive Documentation

Visit `http://localhost:3000/api-docs` for full Swagger/OpenAPI interactive documentation.

### Main Endpoints

#### System
- `GET /health` - Health check
- `GET /` - API information and endpoint list

#### Live Broadcast
- `GET /api/live` - Get currently live broadcast

#### Broadcasts
- `GET /api/broadcasts` - Get all broadcasts (last 30 days)
- `GET /api/broadcasts/:day` - Get broadcasts for specific day (YYYYMMDD)
- `GET /api/broadcast/:programKey/:day` - Get specific broadcast

#### Broadcast Items
- `GET /api/item/:id` - Get specific broadcast item by FM4 item ID

#### Search
- `GET /api/search?q=<query>` - Full-text search
  - Query parameters:
    - `q` (required) - Search query (2-200 characters)
    - `type` (optional) - Filter by type: `broadcasts`, `items`, or `all`
    - `limit` (optional) - Results per page (1-100, default: 50)
    - `offset` (optional) - Pagination offset (default: 0)

#### Program Keys
- `GET /api/program-keys` - Get all known program keys

#### Images
- `GET /images/:hash` - Get image by SHA-256 hash
  - Query parameters:
    - `resolution` (optional) - `high` or `low` (default: `high`)

### Admin Endpoints (Hidden)

Admin endpoints are functional but not listed in public documentation:

- `POST /admin/scrape/full` - Trigger full historical scrape
- `POST /admin/scrape/recent` - Trigger recent broadcasts scrape
- `POST /admin/scrape/broadcast` - Scrape specific broadcast
- `POST /admin/discover-keys` - Discover new program keys
- `POST /admin/cleanup` - Trigger cleanup of old data
- `GET /admin/stats` - Get database statistics
- `GET /admin/live-monitor` - Get live monitor status
- `POST /admin/rotate-logs` - Manually rotate logs

## 🗄️ Database Schema

### Tables

#### broadcasts
Stores main broadcast information:
- `id` - Primary key
- `broadcast_day` - YYYYMMDD format
- `program_key` - Unique program identifier
- `title`, `subtitle`, `description` - Broadcast metadata
- `moderator` - Show host/moderator
- `start_time`, `end_time` - Unix timestamps
- `loop_stream_id` - Loopstream identifier for on-demand playback
- `done` - Flag indicating completed broadcast
- Unique constraint: `(broadcast_day, program_key)`

#### broadcast_items
Individual songs, jingles, ads within broadcasts:
- `id` - Primary key
- `broadcast_id` - Foreign key to broadcasts
- `item_id` - FM4 API item ID
- `type` - Item type (song, jingle, ad, etc.)
- `title`, `interpreter` - Track information
- `start_time`, `end_time` - Unix timestamps
- `start_offset`, `end_offset` - Offsets within loopstream

#### images
Image metadata and file paths:
- `id` - Primary key
- `hash` - SHA-256 hash of image
- `resolution_type` - `high` or `low`
- `file_path` - Local storage path
- `width`, `height` - Image dimensions

#### image_references
Links images to broadcasts/items:
- `entity_type` - `broadcast` or `broadcast_item`
- `entity_id` - ID of broadcast or item
- `image_id` - Foreign key to images
- `resolution_type` - Resolution variant

#### program_keys
Known program identifiers:
- `program_key` - Unique program identifier
- `title` - Program title

### Full-Text Search (FTS5)

#### broadcasts_fts
Virtual table for broadcast search:
- Indexed fields: `program_key`, `title`, `subtitle`, `description`, `moderator`, `program`
- Uses porter stemming and unicode61 tokenizer

#### broadcast_items_fts
Virtual table for item search:
- Indexed fields: `type`, `title`, `interpreter`, `description`
- Linked via `rowid` to main tables

## 🏗️ Architecture

### Directory Structure

```
node-fm4-backend/
├── src/
│   ├── server.js              # Main application entry point
│   ├── config/
│   │   ├── config.js         # Configuration management
│   │   └── swagger.js        # OpenAPI/Swagger setup
│   ├── database/
│   │   ├── database.js       # Database service layer
│   │   └── schema.js         # Table definitions
│   ├── middleware/
│   │   ├── validation.js     # Request validation
│   │   └── error-handler.js  # Global error handling
│   ├── routes/
│   │   ├── api.js           # Public API routes
│   │   ├── images.js        # Image serving routes
│   │   └── admin.js         # Admin routes
│   ├── services/
│   │   ├── broadcast-scraper.js  # Scraping logic
│   │   ├── fm4-api.js           # FM4 API client
│   │   ├── image-service.js     # Image processing
│   │   ├── live-monitor.js      # Live broadcast monitoring
│   │   └── scheduled-tasks.js   # Cron jobs
│   ├── utils/
│   │   ├── broadcast-transformer.js  # Data transformation
│   │   ├── logger.js                # Winston logger
│   │   └── log-rotation.js          # Log rotation
│   └── scripts/
│       ├── init-database.js         # Database initialization
│       ├── scrape-broadcasts.js     # Manual scraping
│       ├── benchmark-database.js    # DB benchmarking
│       ├── benchmark-api.js         # API benchmarking
│       └── migrate-add-fts.js       # FTS setup
├── data/
│   ├── fm4.db                # SQLite database
│   └── images/               # Stored images
├── logs/
│   └── app.log              # Application logs
├── benchmark-results/       # Benchmark outputs
├── .env                     # Environment configuration
├── package.json
├── start.ps1               # Windows PowerShell setup
├── start.bat               # Windows batch setup
└── start.sh                # Linux/macOS bash setup
```

### Key Components

#### Server (src/server.js)
- Express application setup
- Middleware configuration
- Route mounting
- Graceful shutdown handling
- Automatic FTS initialization
- First-run detection and bootstrap

#### Database Service (src/database/database.js)
- Singleton pattern for database access
- Prepared statements for performance
- Transaction support
- FTS search methods
- CRUD operations for all entities

#### Broadcast Scraper (src/services/broadcast-scraper.js)
- Historical data fetching
- Recent broadcast updates
- Program key discovery
- Optimized scraping strategy (done flag)
- Error handling and retry logic

#### Live Monitor (src/services/live-monitor.js)
- 30-second polling interval
- Real-time item detection
- Broadcast state tracking
- Memory-efficient caching
- Duplicate prevention

#### Image Service (src/services/image-service.js)
- Dual-resolution processing
- SHA-256 hash generation
- Sharp-based optimization
- Orphaned file cleanup

## 📜 Scripts

### NPM Scripts

```bash
# Start server (production)
npm start

# Start server (development with auto-reload)
npm run dev

# Initialize/reset database
npm run init-db

# Scrape broadcasts (manual)
npm run scrape

# Run database benchmarks
npm run benchmark

# Run API benchmarks (requires running server)
npm run benchmark:api

# Show setup instructions
npm run setup
```

### Utility Scripts

```bash
# Initialize FTS tables
node src/scripts/migrate-add-fts.js

# Check broadcast done status
node src/scripts/check-done-status.js

# Test FM4 API connectivity
node src/scripts/test-fm4-api.js

# Test live endpoint
node src/scripts/test-live-endpoint.js

# Test search functionality
node src/scripts/test-search.js
```

## 📊 Benchmarking

### Database Benchmarks

Test database performance with 32+ comprehensive tests:

```bash
npm run benchmark
```

**Test categories:**
- Broadcast queries (indexed, by ID, date ranges)
- Broadcast item queries
- Full-text search (FTS5)
- Image queries
- Aggregations
- Write operations (simulated)
- Transaction overhead
- Index efficiency
- Stress tests (10k+ records)

**Sample output:**
```
Total Tests:     44
Total Time:      15019.01ms
Average Time:    341.34ms
Fastest:         0.008ms (Count all broadcasts)
Slowest:         13.062ms (Complex JOIN)
```

Results saved to: `benchmark-results/benchmark-[timestamp].json`

### API Benchmarks

Test API endpoint performance (requires running server):

```bash
# In terminal 1
npm start

# In terminal 2
npm run benchmark:api
```

**Test coverage:**
- System endpoints (health, docs)
- Live broadcast
- All broadcast endpoints
- Broadcast items
- Program keys
- Full-text search with various parameters
- Image serving (high/low resolution)
- Error handling (404, 400 responses)
- Edge cases and validation
- Concurrent requests (50 simultaneous)

**Sample output:**
```
Total Tests:     45
Passed:          45
Failed:          0
Success Rate:    100.0%
Total Time:      325.266ms
Average Time:    7.228ms
```

Results saved to: `benchmark-results/api-benchmark-[timestamp].json`

## 💻 Development

### Code Style

- **ES Modules** - Modern `import`/`export` syntax
- **Async/Await** - Promise-based asynchronous code
- **JSDoc Comments** - For API documentation and Swagger generation
- **Error Handling** - Try-catch blocks with proper logging

### Adding New Endpoints

1. **Add route in appropriate router:**
   ```javascript
   // src/routes/api.js
   router.get('/new-endpoint', 
     validateMiddleware,
     asyncHandler(async (req, res) => {
       // Implementation
     })
   );
   ```

2. **Add OpenAPI documentation:**
   ```javascript
   /**
    * @openapi
    * /api/new-endpoint:
    *   get:
    *     summary: Endpoint description
    *     tags:
    *       - Category
    *     responses:
    *       200:
    *         description: Success response
    */
   ```

3. **Update tests and benchmarks**

### Database Migrations

Create migration scripts in `src/scripts/`:

```javascript
// migrate-add-new-column.js
import Database from 'better-sqlite3';

const db = new Database('./data/fm4.db');

db.exec(`
  ALTER TABLE broadcasts 
  ADD COLUMN new_column TEXT;
`);

console.log('Migration complete');
db.close();
```

Run with: `node src/scripts/migrate-add-new-column.js`

### Testing

While formal tests aren't included, use these approaches:

1. **Manual testing:**
   ```bash
   npm run dev
   # Test endpoints with curl/Postman
   ```

2. **API benchmarks as tests:**
   ```bash
   npm run benchmark:api
   ```

3. **Utility test scripts:**
   ```bash
   node src/scripts/test-fm4-api.js
   node src/scripts/test-search.js
   ```

## 🚢 Deployment

### Production Checklist

1. **Environment Configuration:**
   ```env
   NODE_ENV=production
   LOG_LEVEL=warn
   SCRAPE_INTERVAL_HOURS=6
   KEEP_HISTORY_DAYS=31
   ```

2. **Process Management:**
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name fm4-api -i max
   pm2 startup
   pm2 save
   ```

3. **Reverse Proxy (nginx):**
   ```nginx
   server {
       listen 80;
       server_name api.example.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Monitoring:**
   ```bash
   pm2 monit
   pm2 logs fm4-api
   ```

5. **Backups:**
   ```bash
   # Database backup
   cp data/fm4.db data/fm4.db.backup

   # Or use SQLite backup command
   sqlite3 data/fm4.db ".backup data/fm4-backup-$(date +%Y%m%d).db"
   ```

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p data/images logs

EXPOSE 3000

CMD ["node", "src/server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  fm4-api:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Server won't start
```
Error: Cannot find module 'express'
```
**Solution:** Install dependencies
```bash
npm install
```

#### 2. Database errors
```
Error: SQLITE_CANTOPEN: unable to open database file
```
**Solution:** Create data directory
```bash
mkdir -p data
npm run init-db
```

#### 3. FTS search not working
```
Error: no such table: broadcasts_fts
```
**Solution:** Initialize FTS tables (should happen automatically)
```bash
node src/scripts/migrate-add-fts.js
```

#### 4. Port already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change port or kill existing process
```bash
# Change port in .env
PORT=3001

# Or kill existing process (Windows)
Get-Process -Name node | Stop-Process -Force

# Or kill existing process (Linux/Mac)
lsof -ti:3000 | xargs kill
```

#### 5. Image serving fails
```
Error: Image not found
```
**Solution:** Check image storage path and permissions
```bash
ls -la data/images/
chmod -R 755 data/images/
```

#### 6. High memory usage
**Solution:** Adjust scraping intervals and history retention
```env
SCRAPE_INTERVAL_HOURS=12
KEEP_HISTORY_DAYS=14
```

### Logs

Check logs for detailed error information:
```bash
# View recent logs
tail -f logs/app.log

# Search for errors
grep ERROR logs/app.log

# View compressed logs
zstd -d logs/2025-11-01.log.zstd -o - | less
```

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

### Health Monitoring

Check server health:
```bash
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-11-01T...",
  "uptime": 3600.5
}
```

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review logs for error details

## 🙏 Acknowledgments

- **FM4** - For providing the API and broadcast data
- **ORF** - Austrian Broadcasting Corporation
- **SQLite** - For the excellent database engine
- **Express.js** - For the web framework
- **Node.js** - For the runtime environment

---

**Built with ❤️ for FM4 listeners and developers**
