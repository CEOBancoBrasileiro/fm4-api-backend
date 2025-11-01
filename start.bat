@echo off
REM FM4 Backend API - Startup Script (Windows)

echo FM4 Backend API - Setup and Start
echo =================================
echo.

REM Check if Node.js is installed
echo Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        exit /b 1
    )
) else (
    echo Dependencies already installed
)

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.example" (
        echo Creating .env file from .env.example...
        copy .env.example .env >nul
        echo .env file created. Please review and update if needed.
    ) else (
        echo Warning: No .env or .env.example file found
    )
)

REM Create required directories
echo Creating required directories...
if not exist "data\" mkdir data
if not exist "data\images\" mkdir data\images
if not exist "logs\" mkdir logs
echo Created required directories

REM Initialize database
echo.
echo Initializing database...
call npm run init-db
if %errorlevel% neq 0 (
    echo WARNING: Database initialization had issues, but continuing...
)

echo.
echo Setup complete!
echo.
echo To start scraping broadcasts (recommended before first run):
echo   npm run scrape
echo.
echo To start the server:
echo   npm start       - Production mode
echo   npm run dev     - Development mode (auto-reload)
echo.

REM Ask user what to do
set /p choice="Do you want to (1) Scrape broadcasts now, (2) Start server, or (3) Exit? [1/2/3]: "

if "%choice%"=="1" (
    echo.
    echo Starting broadcast scraper...
    call npm run scrape
) else if "%choice%"=="2" (
    echo.
    echo Starting server in development mode...
    call npm run dev
) else if "%choice%"=="3" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice. Exiting...
    exit /b 1
)
