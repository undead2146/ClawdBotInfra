#!/bin/bash
# ============================================================
# SSH Tunnel Helper Script
# ============================================================
# Creates SSH tunnels to access VPS services locally
# Run this on your LOCAL machine, not the VPS
# ============================================================

# Configuration
# Replace these with your actual VPS details
VPS_USER="ubuntu"
VPS_HOST="your-vps-ip-or-domain"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  SSH Tunnel Helper"
echo "========================================"
echo ""

# Check if running on VPS (prevent accidental self-tunnel)
CURRENT_HOST=$(hostname)
if [ "$CURRENT_HOST" = "$VPS_HOST" ] || [ "$CURRENT_HOST" = "oracle" ]; then
    echo -e "${RED}⚠️  WARNING: You appear to be ON the VPS!${NC}"
    echo "This script should be run on your LOCAL machine."
    echo ""
    read -p "Continue anyway? (yes/no): " confirm
    [ "$confirm" != "yes" ] && exit 1
fi

echo "Creating tunnels to $VPS_USER@$VPS_HOST..."
echo ""
echo "Services will be available at:"
echo "  - http://localhost:8081 (Antigravity/Gemini)"
echo "  - http://localhost:8082 (Claude Proxy)"
echo ""
echo "Press Ctrl+C to stop the tunnels"
echo ""

# Create tunnels in background
ssh -N \
    -L 8081:localhost:8081 \
    -L 8082:localhost:8082 \
    "$VPS_USER@$VPS_HOST"
