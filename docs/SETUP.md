# VPS Setup Guide

Complete guide for setting up the Claude Stack on an Oracle Cloud VPS.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Oracle Cloud Setup](#oracle-cloud-setup)
3. [VPS Initialization](#vps-initialization)
4. [Stack Deployment](#stack-deployment)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Machine
- Git installed
- SSH key pair generated
- Text editor (VS Code, nano, etc.)

### Accounts Needed
- [Oracle Cloud](https://www.oracle.com/cloud/free/) account (free tier)
- GitHub account (for repos and tokens)
- Anthropic account (for Claude API)
- (Optional) Google account for Gemini via Antigravity

### API Keys Required
- `ANTHROPIC_API_KEY` - From [console.anthropic.com](https://console.anthropic.com)
- `GH_TOKEN` - GitHub Personal Access Token with `repo`, `read:org`, `read:user` scopes
- `GITHUB_COPILOT_API_KEY` - (Optional) For Copilot routing
- `GLM_API_KEY` - (Optional) For Gemini via Antigravity

---

## Oracle Cloud Setup

### 1. Create Free Tier Account

1. Go to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Sign up (requires credit card for verification, but no charges if staying in free tier)
3. Verify your email address

### 2. Create a VPS Instance

1. Navigate to **Compute** → **Instances**
2. Click **Create Instance**
3. Configure:
   - **Name**: `claude-stack-vps`
   - **Shape**: `VM.Standard.E4.Flex` (or similar)
   - **OCPU**: 2
   - **Memory**: 16 GB (adjust as needed)
   - **Image**: Ubuntu 22.04 or 24.04 Minimal
   - **SSH Key**: Upload your public key (`~/.ssh/id_rsa.pub`)

4. Click **Create**

### 3. Configure Security List (Firewall)

1. Navigate to **Networking** → **Virtual Cloud Networks**
2. Click your VCN → **Security Lists** → **Default Security List**
3. Add Ingress Rules:

| Direction | Type | Protocol | Source Port | Dest. Port | Source |
|-----------|------|----------|-------------|------------|--------|
| Ingress | IPv4 | TCP | - | 22 | 0.0.0.0/0 |
| Ingress | IPv4 | TCP | - | 8081 | 0.0.0.0/0 (or your IP) |
| Ingress | IPv4 | TCP | - | 8082 | 0.0.0.0/0 (or your IP) |

**Security Note**: Restrict Source to your IP for 8081/8082 if possible.

### 4. Get VPS IP Address

1. Go to **Instances** → Click your instance
2. Copy **Public IPv4 Address**
3. Test SSH: `ssh ubuntu@<YOUR_VPS_IP>`

---

## VPS Initialization

### 1. SSH into VPS

```bash
ssh ubuntu@<YOUR_VPS_IP>
```

### 2. Run Bootstrap Script

```bash
# Clone the infrastructure repo
git clone https://github.com/YOUR_USER/vps-homelab.git ~/claude-stack
cd ~/claude-stack

# Run bootstrap
chmod +x scripts/bootstrap.sh
./scripts/bootstrap.sh
```

The script will:
- Install Docker
- Create necessary directories
- Guide you through `.env` configuration

### 3. Configure Environment Variables

```bash
nano ~/claude-stack/.env
```

Fill in your API keys:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
GH_TOKEN=ghp_xxxxx
GITHUB_COPILOT_API_KEY=ghu_xxxxx
GLM_API_KEY=xxxxx
```

**Important**: Never commit `.env` to git!

### 4. Re-run Bootstrap

```bash
./scripts/bootstrap.sh
```

This time it will:
- Validate your `.env` file
- Start all services
- Show you connection URLs

---

## Stack Deployment

### Manual Deployment (if bootstrap fails)

```bash
cd ~/claude-stack

# Create volumes
docker volume create antigravity-data
docker volume create proxy-config
docker volume create claude-auth
docker volume create workspace

# Start stack
docker compose up -d

# Check status
docker compose ps
```

### Expected Output

```
NAME           IMAGE                      STATUS
antigravity    node:20-slim               Up (healthy)
claude-proxy   claude-proxy               Up (healthy)
clawdbot       clawdbot                   Up
scheduler      mcuadros/ofelia:latest     Up
```

---

## Verification

### 1. Check Service Health

```bash
# From VPS
curl http://localhost:8081/health  # Antigravity
curl http://localhost:8082/health  # Proxy

# Check logs
docker compose logs -f
```

### 2. Create SSH Tunnels (from local machine)

```bash
ssh -L 8081:localhost:8081 -L 8082:localhost:8082 ubuntu@<YOUR_VPS_IP>
```

### 3. Access Services

Open in browser (while SSH tunnel is active):

- **Antigravity**: http://localhost:8081
  - Sign in with Google account
  - Generate API token

- **Claude Proxy**: http://localhost:8082/dashboard
  - View routing status
  - Check rate limits
  - Monitor request logs

### 4. Test Clawdbot

```bash
# From VPS
docker exec -it clawdbot claude "Hello, can you help me understand this codebase?" --dangerously-skip-permissions
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs [service-name]

# Restart specific service
docker compose restart [service-name]

# Rebuild from scratch
docker compose down
docker compose up -d --build
```

### "Connection refused" errors

1. Verify security list rules (firewall)
2. Check service is running: `docker compose ps`
3. Test from VPS: `curl http://localhost:8081/health`

### Out of memory

```bash
# Check resource usage
docker stats

# Stop unused services
docker compose stop [service-name]

# Add memory limits to docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

### API authentication failures

1. Verify `.env` values are correct
2. Restart services: `docker compose restart`
3. Check logs for specific error messages

### Need to rebuild everything

```bash
cd ~/claude-stack

# Stop everything
docker compose down -v

# Remove volumes (WARNING: deletes data!)
docker volume rm antigravity-data proxy-config claude-auth workspace

# Restore from backup (if available)
./scripts/restore.sh ~/backups/latest

# Or start fresh
docker compose up -d
```

---

## Next Steps

1. **Enable Scheduled Tasks**
   - Edit `clawdbot/tasks/cron.ini`
   - Uncomment jobs you want to enable
   - Restart: `docker compose restart scheduler`

2. **Clone Your Repos**
   ```bash
   cd ~/claude-stack/workspace/repos
   git clone https://github.com/YOUR_USER/your-repo.git
   ```

3. **Create Initial Backup**
   ```bash
   ./scripts/backup.sh
   ```

4. **Set Up Automated Backups**
   ```bash
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * $HOME/claude-stack/scripts/backup.sh") | crontab -
   ```

---

## Resources

- [Main README](../README.md)
- [Architecture Guide](ARCHITECTURE.md)
- [Runbook (Operational Procedures)](RUNBOOK.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
