#!/bin/bash
# ============================================================
# Update Script for Claude Stack
# ============================================================
# Updates the infrastructure and rebuilds services
# ============================================================

set -e

# Configuration
STACK_DIR="$HOME/claude-stack"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Claude Stack Update"
echo "========================================"
echo ""

# ============================================
# Pull Latest Infrastructure
# ============================================
echo -e "${GREEN}[1/4] Pulling latest infrastructure...${NC}"

cd "$STACK_DIR"
git pull

echo -e "${GREEN}✓ Infrastructure updated${NC}"

# ============================================
# Update Images
# ============================================
echo -e "${GREEN}[2/4] Pulling latest Docker images...${NC}"

docker compose pull

echo -e "${GREEN}✓ Images updated${NC}"

# ============================================
# Rebuild Services
# ============================================
echo -e "${GREEN}[3/4] Rebuilding services...${NC}"

# Rebuild services that have local code
docker compose build --no-cache proxy clawdbot

echo -e "${GREEN}✓ Services rebuilt${NC}"

# ============================================
# Restart Stack
# ============================================
echo -e "${GREEN}[4/4] Restarting stack...${NC}"

docker compose up -d

echo "Waiting for services to be healthy..."
sleep 30

echo ""
echo -e "${GREEN}========================================"
echo "  ✓ Update Complete!"
echo "========================================${NC}"
echo ""

docker compose ps

echo ""
echo "Check logs if any issues:"
echo "  docker compose logs -f [service-name]"
