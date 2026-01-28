#!/bin/bash

# ============================================================
# Auto-Backup Script - Backs up everything and commits to git
# ============================================================
# This ensures:
# 1. All code is backed up to git
# 2. Docker volumes are exported
# 3. Configurations are saved
# 4. Can restore from scratch if VPS is nuked
# ============================================================

set -e

# Configuration
BACKUP_DIR="$HOME/backups/claude-stack"
DATE=$(date +%Y%m%d_%H%M%S)
GIT_REPO="$HOME/claude-stack"
LOG_FILE="$BACKUP_DIR/backup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "=========================================="
log "Starting backup process..."
log "=========================================="

# ============================================================
# STEP 1: Git Commit (Code Backup)
# ============================================================

log "Step 1: Committing to git..."

cd "$GIT_REPO"

# Add all changes
git add -A >> "$LOG_FILE" 2>&1 || warn "Nothing to add to git"

# Check if there are changes
if git diff --cached --quiet; then
    log "No changes to commit"
else
    # Commit with timestamp
    git commit -m "auto-backup: $(date +'%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE" 2>&1

    auto-commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log "✅ Committed changes: $auto-commit"
fi

# Push to remote if configured
if git remote get-url origin &>/dev/null; then
    git push origin main >> "$LOG_FILE" 2>&1 || warn "Could not push to remote"
    log "✅ Pushed to remote repository"
else
    warn "No remote repository configured"
fi

# ============================================================
# STEP 2: Export Docker Volumes
# ============================================================

log "Step 2: Exporting Docker volumes..."

VOLUME_BACKUP_DIR="$BACKUP_DIR/$DATE/volumes"
mkdir -p "$VOLUME_BACKUP_DIR"

# List of volumes to backup
VOLUMES=("claude-auth" "proxy-config" "workspace")

for vol in "${VOLUMES[@]}"; do
    log "Exporting volume: $vol"

    # Create archive
    docker run --rm \
        -v "$vol":/data:ro \
        -v "$VOLUME_BACKUP_DIR":/backup \
        alpine \
        tar czf "/backup/$vol.tar.gz" -C /data . >> "$LOG_FILE" 2>&1 || error "Failed to export $vol"

    log "✅ Exported $vol ($VOLUME_BACKUP_DIR/$vol.tar.gz)"
done

# ============================================================
# STEP 3: Backup Configuration Files
# ============================================================

log "Step 3: Backing up configuration..."

CONFIG_BACKUP_DIR="$BACKUP_DIR/$DATE/config"
mkdir -p "$CONFIG_BACKUP_DIR"

# Copy important configs
cp "$GIT_REPO/.env" "$CONFIG_BACKUP_DIR/" 2>/dev/null || warn "No .env file"
cp "$GIT_REPO/docker-compose.yml" "$CONFIG_BACKUP_DIR/"
cp -r "$GIT_REPO/clawdbot/settings.json" "$CONFIG_BACKUP_DIR/" 2>/dev/null || true

# Create backup metadata
cat > "$CONFIG_BACKUP_DIR/metadata.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git_commit": "$(cd $GIT_REPO && git rev-parse HEAD)",
  "git_branch": "$(cd $GIT_REPO && git branch --show-current)",
  "docker_version": "$(docker --version)",
  "docker_compose_version": "$(docker-compose --version)",
  "hostname": "$(hostname)",
  "vps_ip": "$(curl -s ifconfig.me)"
}
EOF

log "✅ Backed up configurations"

# ============================================================
# STEP 4: Backup Container States
# ============================================================

log "Step 4: Saving container states..."

docker ps --all --format "{{.Names}}\t{{.Status}}" > "$CONFIG_BACKUP_DIR/containers.txt"
docker images --format "{{.Repository}}\t{{.Tag}}\t{{.ID}}" > "$CONFIG_BACKUP_DIR/images.txt"

log "✅ Saved container states"

# ============================================================
# STEP 5: Create Restore Script
# ============================================================

log "Step 5: Creating restore script..."

cat > "$BACKUP_DIR/$DATE/restore.sh" <<'EOFRESTORE'
#!/bin/bash
# Auto-generated restore script

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"
GIT_REPO="$HOME/claude-stack"

echo "=========================================="
echo "Restoring Claude Stack from backup"
echo "=========================================="

# Restore Docker volumes
echo "Restoring Docker volumes..."
for vol_file in "$BACKUP_DIR/volumes"/*.tar.gz; do
    vol_name=$(basename "$vol_file" .tar.gz)
    echo "Restoring $vol_name..."

    # Create volume if not exists
    docker volume create "$vol_name" 2>/dev/null || true

    # Extract archive
    docker run --rm \
        -v "$vol_name":/data \
        -v "$BACKUP_DIR/volumes":/backup \
        alpine \
        tar xzf "/backup/$vol_name.tar.gz" -C /data
done

echo "✅ Volumes restored"

# Restore configs
echo "Restoring configurations..."
cp "$BACKUP_DIR/config/"* "$GIT_REPO/" 2>/dev/null || true
echo "✅ Configurations restored"

# Restart services
echo "Restarting services..."
cd "$GIT_REPO"
docker-compose down
docker-compose up -d
echo "✅ Services restarted"

echo "=========================================="
echo "Restore complete!"
echo "=========================================="
EOFRESTORE

chmod +x "$BACKUP_DIR/$DATE/restore.sh"

log "✅ Created restore script"

# ============================================================
# STEP 6: Clean Old Backups
# ============================================================

log "Step 6: Cleaning old backups (keeping last 7)..."

cd "$BACKUP_DIR"
ls -t | tail -n +8 | xargs -r rm -rf 2>/dev/null || true

log "✅ Cleaned old backups"

# ============================================================
# STEP 7: Create Backup Summary
# ============================================================

cat > "$BACKUP_DIR/$DATE/SUMMARY.md" <<EOF
# Backup Summary - $(date +'%Y-%m-%d %H:%M:%S')

## What Was Backed Up

### Code (Git)
- Repository: $GIT_REPO
- Commit: $(cd $GIT_REPO && git rev-parse --short HEAD)
- Branch: $(cd $GIT_REPO && git branch --show-current)
- Files: $(cd $GIT_REPO && git ls-files | wc -l) files tracked

### Docker Volumes
EOF

for vol in "${VOLUMES[@]}"; do
    size=$(du -sh "$VOLUME_BACKUP_DIR/$vol.tar.gz" 2>/dev/null | cut -f1)
    echo "- $vol: $size" >> "$BACKUP_DIR/$DATE/SUMMARY.md"
done

cat >> "$BACKUP_DIR/$DATE/SUMMARY.md" <<EOF

### Configuration
- .env file
- docker-compose.yml
- Container states
- Image list

## How to Restore

### Quick Restore (from Git):
\`\`\`bash
cd ~/claude-stack
git pull origin main
docker-compose up -d
\`\`\`

### Full Restore (including volumes):
\`\`\`bash
cd $BACKUP_DIR/$DATE
./restore.sh
\`\`\`

### Manual Volume Restore:
\`\`\`bash
# Create volume
docker volume create claude-auth

# Restore from backup
docker run --rm \\
  -v claude-auth:/data \\
  -v $BACKUP_DIR/$DATE/volumes:/backup \\
  alpine \\
  tar xzf "/backup/claude-auth.tar.gz" -C /data
\`\`\`

## Backup Contents

- \`config/\` - Configuration files
- \`volumes/\` - Docker volume exports
- \`restore.sh\` - Automated restore script
- \`SUMMARY.md\` - This file

## Backup Location

$BACKUP_DIR/$DATE/

## System Information

- Hostname: $(hostname)
- IP Address: $(curl -s ifconfig.me)
- Docker Version: $(docker --version)
- Docker Compose Version: $(docker-compose --version)
- Uptime: $(uptime -p)
EOF

log "✅ Created backup summary"

# ============================================================
# FINISH
# ============================================================

log "=========================================="
log "✅ Backup complete!"
log "=========================================="
log ""
log "Backup location: $BACKUP_DIR/$DATE/"
log "Restore command: cd $BACKUP_DIR/$DATE && ./restore.sh"
log ""
log "Git commit: $(cd $GIT_REPO && git rev-parse --short HEAD)"
log ""

# Keep only last line in log for email alerts
echo "BACKUP_SUCCESSFUL: $BACKUP_DIR/$DATE/" >> "$LOG_FILE"
