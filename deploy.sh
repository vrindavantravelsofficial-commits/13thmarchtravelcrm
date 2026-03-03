#!/bin/bash

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "======================================"
echo "   TRAVVIP CRM - QUICK DEPLOY"
echo "======================================"
echo -e "${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed!${NC}"
    echo ""
    echo "Install Docker first:"
    echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "  sudo sh get-docker.sh"
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed!${NC}"
    exit 1
fi

echo -e "${BLUE}Step 1:${NC} Checking environment configuration..."
if [ ! -f "frontend/.env.production" ]; then
    echo -e "${YELLOW}Warning: frontend/.env.production not found!${NC}"
    echo "Please create it with your Supabase credentials."
    exit 1
fi
echo -e "${GREEN}✓${NC} Environment file found"
echo ""

echo -e "${BLUE}Step 2:${NC} Stopping any existing containers..."
docker compose down 2>/dev/null
echo ""

echo -e "${BLUE}Step 3:${NC} Building Docker image..."
echo "This may take 5-15 minutes on first build..."
echo ""

if docker compose build; then
    echo -e "${GREEN}✓${NC} Build completed successfully"
else
    echo -e "${RED}✗${NC} Build failed. Check the errors above."
    exit 1
fi
echo ""

echo -e "${BLUE}Step 4:${NC} Starting application..."
if docker compose up -d; then
    echo -e "${GREEN}✓${NC} Application started"
else
    echo -e "${RED}✗${NC} Failed to start application"
    exit 1
fi
echo ""

echo -e "${BLUE}Step 5:${NC} Waiting for application to be ready..."
sleep 5

# Check container status
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}✓${NC} Container is running"
else
    echo -e "${RED}✗${NC} Container failed to start"
    echo ""
    echo "Check logs with: docker compose logs -f"
    exit 1
fi
echo ""

echo -e "${GREEN}"
echo "======================================"
echo "   DEPLOYMENT SUCCESSFUL! 🚀"
echo "======================================"
echo -e "${NC}"
echo ""
echo "Your application is now running!"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  Local:    http://localhost:3000"
echo "  Network:  http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo "  View logs:       docker compose logs -f"
echo "  Stop:            docker compose down"
echo "  Restart:         docker compose restart"
echo "  Check status:    docker compose ps"
echo ""
echo -e "${BLUE}Health Check:${NC}"
echo "  curl http://localhost:3000/api/health"
echo ""
echo "======================================"
