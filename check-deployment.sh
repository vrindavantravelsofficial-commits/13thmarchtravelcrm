#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "   DEPLOYMENT READINESS CHECK"
echo "======================================"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then 
    SUDO=""
else
    SUDO="sudo"
fi

# Function to check command existence
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is installed"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is NOT installed"
        return 1
    fi
}

# Function to check file existence
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 is MISSING"
        return 1
    fi
}

# Function to check directory existence
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1 directory exists"
        return 0
    else
        echo -e "${RED}✗${NC} $1 directory is MISSING"
        return 1
    fi
}

echo "1. Checking Docker Installation..."
echo "-----------------------------------"
check_command docker
DOCKER_INSTALLED=$?

if [ $DOCKER_INSTALLED -eq 0 ]; then
    docker --version
fi
echo ""

check_command "docker compose" || check_command "docker-compose"
COMPOSE_INSTALLED=$?
echo ""

echo "2. Checking Required Files..."
echo "-----------------------------------"
check_file "Dockerfile"
check_file "docker-compose.yml"
check_file ".env.example"
check_file "frontend/.env.production"
echo ""

echo "3. Checking Directory Structure..."
echo "-----------------------------------"
check_dir "frontend"
check_dir "frontend/app"
check_dir "frontend/components"
echo ""

echo "4. Checking Port Availability..."
echo "-----------------------------------"
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC}  Port 3000 is already in use"
    echo "    Process using port 3000:"
    lsof -i :3000 | grep LISTEN
else
    echo -e "${GREEN}✓${NC} Port 3000 is available"
fi
echo ""

echo "5. Checking System Resources..."
echo "-----------------------------------"
TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
AVAILABLE_MEM=$(free -g | awk '/^Mem:/{print $7}')

echo "Total Memory: ${TOTAL_MEM}GB"
echo "Available Memory: ${AVAILABLE_MEM}GB"

if [ "$AVAILABLE_MEM" -lt 2 ]; then
    echo -e "${YELLOW}⚠${NC}  Low memory detected. Build might be slow or fail."
    echo "   Consider adding swap space or closing other applications."
else
    echo -e "${GREEN}✓${NC} Sufficient memory available"
fi
echo ""

echo "6. Checking Docker Service Status..."
echo "-----------------------------------"
if $SUDO systemctl is-active --quiet docker; then
    echo -e "${GREEN}✓${NC} Docker service is running"
else
    echo -e "${RED}✗${NC} Docker service is NOT running"
    echo "   Run: sudo systemctl start docker"
fi
echo ""

echo "======================================"
echo "   SUMMARY"
echo "======================================"

ISSUES=0

if [ $DOCKER_INSTALLED -ne 0 ]; then
    echo -e "${RED}✗${NC} Docker is not installed. Please install Docker first."
    ISSUES=$((ISSUES+1))
fi

if [ $COMPOSE_INSTALLED -ne 0 ]; then
    echo -e "${RED}✗${NC} Docker Compose is not installed. Please install Docker Compose."
    ISSUES=$((ISSUES+1))
fi

if [ ! -f "Dockerfile" ] || [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✗${NC} Required Docker files are missing."
    ISSUES=$((ISSUES+1))
fi

if [ ! -d "frontend" ]; then
    echo -e "${RED}✗${NC} Frontend directory is missing."
    ISSUES=$((ISSUES+1))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "\n${GREEN}✓ All checks passed! Ready to deploy.${NC}"
    echo ""
    echo "To deploy, run:"
    echo "  docker compose up -d --build"
    echo ""
else
    echo -e "\n${RED}✗ Found $ISSUES issue(s). Please fix them before deploying.${NC}"
    echo ""
fi

echo "======================================"
