#!/bin/bash
# ============================================================
# Backup Script for Claude Stack
# ============================================================
# Backs up all Docker volumes and configuration files
# ============================================================

set -e

# Configuration
STACK_DIR="$HOME/claude-stack"
BACKUP_BASE="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE/$DATE"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Claude Stack Backup"
echo "========================================"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ============================================
# Backup Docker Volumes
# ============================================
echo -e "${GREEN}[1/4] Backing up Docker volumes...${NC}"

VOLUMES=("claude-auth" "proxy-config" "antigravity-data" "workspace")

for vol in "${VOLUMES[@]}"; do
    echo "  - Backing up $vol..."
    docker run --rm \
        -v "$vol":/data \
        -v "$BACKUP_DIR":/backup \
        alpine \
        tar czf "/backup/$vol.tar.gz" -C /data .
done

echo -e "${GREEN}✓ Volumes backed up${NC}"

# ============================================
# Backup Configuration Files
# ============================================
echo -e "${GREEN}[2/4] Backing up configuration...${NC}"

cp "$STACK_DIR/.env" "$BACKUP_DIR/.env.backup"
cp "$STACK_DIR/docker-compose.yml" "$BACKUP_DIR/"
cp -r "$STACK_DIR/clawdbot/prompts" "$BACKUP_DIR/"
cp -r "$STACK_DIR/clawdbot/tasks" "$BACKUP_DIR/"

echo -e "${GREEN}✓ Configuration backed up${NC}"

# ============================================
# Backup Git State
# ============================================
echo -e "${GREEN}[3/4] Recording git state...${NC}"

cd "$STACK_DIR"
git rev-parse HEAD > "$BACKUP_DIR/git-commit.txt"
git log -1 --pretty="%H %ai %s" >> "$BACKUP_DIR/git-commit.txt"
git diff > "$BACKUP_DIR/local-changes.patch" 2>/dev/null || true

echo -e "${GREEN}✓ Git state recorded${NC}"

# ============================================
# Create Manifest
# ============================================
echo -e "${GREEN}[4/4] Creating backup manifest...${NC}"

cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
Claude Stack Backup
===================

Date: $(date)
Hostname: $(hostname)
User: $USER
VPS IP: $(curl -s ifconfig.me 2>/dev/null || echo "unknown")

Contents:
--------
$(ls -lh "$BACKUP_DIR")

Volumes Backed Up:
-----------------
$(for vol in "${VOLUMES[@]}"; do
    size=$(du -h "$BACKUP_DIR/$vol.tar.gz" | cut -f1)
    echo "  - $vol: $size"
done)

Git Commit: $(cat "$BACKUP_DIR/git-commit.txt")
EOF

echo -e "${GREEN}✓ Manifest created${NC}"

# ============================================
# Summary
# ============================================

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo ""
echo -e "${GREEN}========================================"
echo "  ✓ Backup Complete!"
echo "========================================${NC}"
echo ""
echo "Location: $BACKUP_DIR"
echo "Total Size: $TOTAL_SIZE"
echo ""
echo "To restore:"
echo "  $STACK_DIR/scripts/restore.sh $BACKUP_DIR"
echo ""

# ============================================
# Cleanup Old Backups (keep last 10)
# ============================================
cd "$BACKUP_BASE"
ls -t | tail -n +11 | xargs -r rm -rf
echo "Old backups cleaned up (last 10 kept)"
