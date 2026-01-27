#!/bin/bash
# ============================================================
# Restore Script for Claude Stack
# ============================================================
# Restores Docker volumes and configuration from backup
# ============================================================

set -e

# Configuration
STACK_DIR="$HOME/claude-stack"
BACKUP_DIR="$1"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Validate input
if [ -z "$BACKUP_DIR" ]; then
    echo -e "${RED}Usage: $0 <backup-directory>${NC}"
    echo ""
    echo "Available backups:"
    ls -1t ~/backups/ 2>/dev/null | head -10 || echo "  No backups found"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Backup directory not found: $BACKUP_DIR${NC}"
    exit 1
fi

# Show backup info
if [ -f "$BACKUP_DIR/MANIFEST.txt" ]; then
    echo "========================================"
    echo "  Backup Information"
    echo "========================================"
    cat "$BACKUP_DIR/MANIFEST.txt"
    echo ""
    echo "========================================"
    echo ""
fi

# Ask for confirmation
echo -e "${YELLOW}This will:${NC}"
echo "  1. Stop all running services"
echo "  2. Delete existing volumes"
echo "  3. Restore from backup"
echo "  4. Restart services"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# ============================================
# Stop Services
# ============================================
echo -e "${GREEN}[1/5] Stopping services...${NC}"

cd "$STACK_DIR"
docker compose down

echo -e "${GREEN}✓ Services stopped${NC}"

# ============================================
# Restore Docker Volumes
# ============================================
echo -e "${GREEN}[2/5] Restoring Docker volumes...${NC}"

VOLUMES=("claude-auth" "proxy-config" "antigravity-data" "workspace")

for vol in "${VOLUMES[@]}"; do
    if [ -f "$BACKUP_DIR/$vol.tar.gz" ]; then
        echo "  - Restoring $vol..."
        docker volume rm "$vol" 2>/dev/null || true
        docker volume create "$vol"
        docker run --rm \
            -v "$vol":/data \
            -v "$BACKUP_DIR":/backup \
            alpine \
            tar xzf "/backup/$vol.tar.gz" -C /data
    else
        echo -e "${YELLOW}  ⚠️  Skipping $vol (not found in backup)${NC}"
    fi
done

echo -e "${GREEN}✓ Volumes restored${NC}"

# ============================================
# Restore Configuration
# ============================================
echo -e "${GREEN}[3/5] Restoring configuration...${NC}"

if [ -f "$BACKUP_DIR/.env.backup" ]; then
    cp "$BACKUP_DIR/.env.backup" "$STACK_DIR/.env"
    echo "  - Restored .env"
fi

if [ -d "$BACKUP_DIR/prompts" ]; then
    rm -rf "$STACK_DIR/clawdbot/prompts"
    cp -r "$BACKUP_DIR/prompts" "$STACK_DIR/clawdbot/"
    echo "  - Restored prompts"
fi

if [ -d "$BACKUP_DIR/tasks" ]; then
    rm -rf "$STACK_DIR/clawdbot/tasks"
    cp -r "$BACKUP_DIR/tasks" "$STACK_DIR/clawdbot/"
    echo "  - Restored tasks"
fi

echo -e "${GREEN}✓ Configuration restored${NC}"

# ============================================
# Restart Services
# ============================================
echo -e "${GREEN}[4/5] Starting services...${NC}"

docker compose up -d

echo "Waiting for services to be healthy..."
sleep 30

echo -e "${GREEN}✓ Services started${NC}"

# ============================================
# Verify Restore
# ============================================
echo -e "${GREEN}[5/5] Verifying restore...${NC}"
echo ""

docker compose ps

echo ""
echo -e "${GREEN}========================================"
echo "  ✓ Restore Complete!"
echo "========================================${NC}"
echo ""

# Show git info if available
if [ -f "$BACKUP_DIR/git-commit.txt" ]; then
    echo "Backup was created from git commit:"
    cat "$BACKUP_DIR/git-commit.txt"
    echo ""
fi
