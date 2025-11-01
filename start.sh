#!/bin/bash
# FM4 Backend API - Startup Script (Linux/macOS)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}FM4 Backend API - Setup and Start${NC}"
echo -e "${CYAN}=================================${NC}"
echo ""

# Check if Node.js is installed
echo -e "${YELLOW}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed or not in PATH${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js version: $NODE_VERSION${NC}"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}Dependencies already installed${NC}"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}.env file created. Please review and update if needed.${NC}"
    else
        echo -e "${YELLOW}Warning: No .env or .env.example file found${NC}"
    fi
fi

# Create required directories
echo -e "${YELLOW}Creating required directories...${NC}"
for dir in "data" "data/images" "logs"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GREEN}Created directory: $dir${NC}"
    fi
done

# Initialize database
echo ""
echo -e "${YELLOW}Initializing database...${NC}"
npm run init-db
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}WARNING: Database initialization had issues, but continuing...${NC}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo -e "${CYAN}To start scraping broadcasts (recommended before first run):${NC}"
echo -e "${WHITE}  npm run scrape${NC}"
echo ""
echo -e "${CYAN}To start the server:${NC}"
echo -e "${WHITE}  npm start       - Production mode${NC}"
echo -e "${WHITE}  npm run dev     - Development mode (auto-reload)${NC}"
echo ""

# Ask user what to do
read -p "Do you want to (1) Scrape broadcasts now, (2) Start server, or (3) Exit? [1/2/3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${CYAN}Starting broadcast scraper...${NC}"
        npm run scrape
        ;;
    2)
        echo ""
        echo -e "${CYAN}Starting server in development mode...${NC}"
        npm run dev
        ;;
    3)
        echo -e "${YELLOW}Exiting...${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting...${NC}"
        exit 1
        ;;
esac
