#!/bin/bash
# ============================================================
# VPS Bootstrap Script for Claude Stack
# ============================================================
# Run this on a fresh Oracle VPS to set up everything
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Claude Stack VPS Bootstrap"
echo "========================================"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}Cannot detect OS. Exiting.${NC}"
    exit 1
fi

# ============================================
# Step 1: Install Docker
# ============================================
echo -e "${GREEN}[1/6] Installing Docker...${NC}"

if ! command -v docker &> /dev/null; then
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}>>> Docker installed. Please log out and back in, then re-run this script.${NC}"
        exit 0
    else
        echo -e "${RED}Unsupported OS: $OS${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose not found. Please install Docker Compose v2.${NC}"
    exit 1
fi

# ============================================
# Step 2: Clone or Update Infrastructure Repo
# ============================================
echo -e "${GREEN}[2/6] Setting up infrastructure...${NC}"

STACK_DIR="$HOME/claude-stack"
if [ -d "$STACK_DIR" ]; then
    echo "Directory exists, pulling latest changes..."
    cd "$STACK_DIR"
    git pull
else
    echo "Cloning infrastructure repository..."
    # Replace with your actual repo URL
    git clone https://github.com/YOUR_USER/vps-homelab.git "$STACK_DIR"
    cd "$STACK_DIR"
fi

# ============================================
# Step 3: Setup Environment
# ============================================
echo -e "${GREEN}[3/6] Configuring environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}>>> .env file created. Please edit it with your API keys:${NC}"
    echo "   nano $STACK_DIR/.env"
    echo ""
    echo "After adding your keys, run this script again."
    exit 0
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Verify .env has been configured
if grep -q "your-key-here" .env || grep -q "YOUR_USER" .env; then
    echo -e "${RED}⚠️  .env still contains placeholder values. Please edit it:${NC}"
    echo "   nano $STACK_DIR/.env"
    exit 1
fi

# ============================================
# Step 4: Create Necessary Directories
# ============================================
echo -e "${GREEN}[4/6] Creating directories...${NC}"

mkdir -p ~/backups
mkdir -p ~/claude-stack/workspace/repos
mkdir -p ~/claude-stack/workspace/tasks
mkdir -p ~/claude-stack/workspace/summaries

# Make scripts executable
chmod +x "$STACK_DIR/scripts/"*.sh
chmod +x "$STACK_DIR/clawdbot/tasks/hooks/"*.sh

echo -e "${GREEN}✓ Directories created${NC}"

# ============================================
# Step 5: Start the Stack
# ============================================
echo -e "${GREEN}[5/6] Starting services...${NC}"

cd "$STACK_DIR"
docker compose pull
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# ============================================
# Step 6: Show Status
# ============================================
echo -e "${GREEN}[6/6] Checking stack status...${NC}"
echo ""

docker compose ps

echo ""
echo -e "${GREEN}========================================"
echo "  ✓ Stack is Running!"
echo "========================================${NC}"
echo ""
echo "Service URLs:"
echo "  Antigravity (Gemini): http://localhost:8081"
echo "  Claude Proxy:         http://localhost:8082"
echo ""
echo "Next Steps:"
echo ""
echo "1. On your LOCAL machine, create SSH tunnels:"
echo "   ssh -L 8081:localhost:8081 -L 8082:localhost:8082 $USER@$(curl -s ifconfig.me)"
echo ""
echo "2. Open in browser:"
echo "   - http://localhost:8081 (Antigravity login)"
echo "   - http://localhost:8082/dashboard (Proxy dashboard)"
echo ""
echo "3. Test Clawdbot:"
echo "   docker exec -it clawdbot claude 'Hello, can you help me?'"
echo ""
echo "4. Enable scheduled tasks (edit clawdbot/tasks/cron.ini first):"
echo "   docker compose restart scheduler"
echo ""
echo "Useful Commands:"
echo "  - View logs: docker compose logs -f [service-name]"
echo "  - Restart:   docker compose restart [service-name]"
echo "  - Stop:      docker compose down"
echo "  - Backup:    $STACK_DIR/scripts/backup.sh"
echo ""
