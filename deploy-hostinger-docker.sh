#!/usr/bin/env bash

# Travvip CRM - Hostinger VPS (Docker) deploy helper
# Usage (on VPS): chmod +x deploy-hostinger-docker.sh && ./deploy-hostinger-docker.sh

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

set -o pipefail

echo -e "${BLUE}"
echo "======================================"
echo " TRAVVIP CRM - HOSTINGER DOCKER DEPLOY"
echo "======================================"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}" || exit 1

COMPOSE=(docker compose)
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    echo -e "${RED}Error:${NC} Docker Compose not found."
    echo "Install Docker + Docker Compose plugin, then retry."
    exit 1
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}Error:${NC} Docker is not installed."
  echo "Install Docker first:"
  echo "  curl -fsSL https://get.docker.com -o get-docker.sh"
  echo "  sudo sh get-docker.sh"
  exit 1
fi

ENV_FILE="frontend/.env.production"
if [ ! -f "${ENV_FILE}" ]; then
  echo -e "${RED}Error:${NC} ${ENV_FILE} not found."
  echo "Create it with your Supabase credentials and retry."
  exit 1
fi

echo -e "${BLUE}Step 1:${NC} Stopping existing containers (if any)…"
"${COMPOSE[@]}" down >/dev/null 2>&1 || true

echo -e "${BLUE}Step 2:${NC} Building + starting containers…"
echo -e "${YELLOW}Note:${NC} First build can take 5–15 minutes on a small VPS."
if ! "${COMPOSE[@]}" up -d --build; then
  echo -e "${RED}✗${NC} Failed to start containers."
  echo "Logs: ${COMPOSE[*]} logs -f"
  exit 1
fi

echo -e "${BLUE}Step 3:${NC} Waiting for health check…"
HEALTH_URL="http://localhost:3000/api/health"
for i in {1..45}; do
  if curl -fsS --max-time 3 "${HEALTH_URL}" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} App is healthy."
    break
  fi
  sleep 2
  if [ "${i}" -eq 45 ]; then
    echo -e "${RED}✗${NC} Health check did not pass in time."
    echo "Logs: ${COMPOSE[*]} logs -f frontend"
    exit 1
  fi
done

IP=""
if command -v hostname >/dev/null 2>&1; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [ -z "${IP}" ] && command -v ip >/dev/null 2>&1; then
  IP="$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')"
fi

echo -e "${GREEN}"
echo "======================================"
echo " DEPLOYMENT SUCCESSFUL"
echo "======================================"
echo -e "${NC}"
echo "Local:   http://localhost:3000"
if [ -n "${IP}" ]; then
  echo "Public:  http://${IP}:3000"
fi
echo ""
echo -e "${BLUE}Useful:${NC}"
echo "  ${COMPOSE[*]} ps"
echo "  ${COMPOSE[*]} logs -f"
echo "  ${COMPOSE[*]} restart"
echo "  ${COMPOSE[*]} down"

