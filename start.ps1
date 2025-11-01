# FM4 Backend API - Startup Script

Write-Host "FM4 Backend API - Setup and Start" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if dependencies are installed
if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Dependencies already installed" -ForegroundColor Green
}

# Check if .env file exists
if (-Not (Test-Path ".env")) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host ".env file created. Please review and update if needed." -ForegroundColor Green
}

# Create required directories
Write-Host "Creating required directories..." -ForegroundColor Yellow
@("data", "data/images", "logs") | ForEach-Object {
    if (-Not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
        Write-Host "Created directory: $_" -ForegroundColor Green
    }
}

# Initialize database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
npm run init-db
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Database initialization had issues, but continuing..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start scraping broadcasts (recommended before first run):" -ForegroundColor Cyan
Write-Host "  npm run scrape" -ForegroundColor White
Write-Host ""
Write-Host "To start the server:" -ForegroundColor Cyan
Write-Host "  npm start       - Production mode" -ForegroundColor White
Write-Host "  npm run dev     - Development mode (auto-reload)" -ForegroundColor White
Write-Host ""

# Ask user what to do
$choice = Read-Host "Do you want to (1) Scrape broadcasts now, (2) Start server, or (3) Exit? [1/2/3]"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting broadcast scraper..." -ForegroundColor Cyan
        npm run scrape
    }
    "2" {
        Write-Host ""
        Write-Host "Starting server in development mode..." -ForegroundColor Cyan
        npm run dev
    }
    "3" {
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "Invalid choice. Exiting..." -ForegroundColor Red
        exit 1
    }
}
