# Troubleshooting Guide

Common issues and their solutions.

## Table of Contents
1. [Installation Issues](#installation-issues)
2. [Service Issues](#service-issues)
3. [Networking Issues](#networking-issues)
4. [Performance Issues](#performance-issues)
5. [Data Issues](#data-issues)

---

## Installation Issues

### Docker Won't Install

**Error**: `E: Unable to locate package docker`

**Solution**:
```bash
# Use official Docker script
curl -fsSL https://get.docker.com | sh

# Verify installation
docker --version
docker compose version
```

### Permission Denied

**Error**: `Got permission denied while trying to connect to the Docker daemon`

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or:
newgrp docker

# Verify
docker ps
```

### Git Clone Fails

**Error**: `fatal: repository 'https://github.com/...' not found`

**Solution**:
```bash
# Check if repo is private
# If private, use SSH:
git clone git@github.com:USER/REPO.git

# Or authenticate with GitHub:
gh auth login
```

### .env File Issues

**Error**: Services fail to start with "environment variable not found"

**Solution**:
```bash
# Verify .env exists
ls -la ~/claude-stack/.env

# Check for syntax errors (no spaces around =)
cat ~/claude-stack/.env

# Recreate from template
cp ~/claude-stack/.env.example ~/claude-stack/.env
nano ~/claude-stack/.env
```

---

## Service Issues

### Service Won't Start

**Symptom**: `Exit 1` or constant restarts

**Diagnosis**:
```bash
# Check logs
docker compose logs [service-name]

# Check recent errors
docker compose logs --tail 50 [service-name]
```

**Common Causes**:

1. **Missing volume**:
   ```bash
   docker volume ls
   docker volume create [missing-volume]
   docker compose up -d
   ```

2. **Port conflict**:
   ```bash
   # Check what's using the port
   sudo lsof -i :8082

   # Kill the process
   sudo kill -9 [PID]
   ```

3. **Invalid configuration**:
   ```bash
   # Validate docker-compose.yml
   docker compose config

   # Check for syntax errors
   ```

### Antigravity Authentication Fails

**Symptom**: Can't access Gemini API

**Solution**:
```bash
# Check if container is running
docker compose ps antigravity

# Check logs
docker compose logs antigravity

# Recreate auth volume
docker compose down
docker volume rm antigravity-data
docker compose up -d antigravity

# Access via browser and re-authenticate
# http://localhost:8081 (via SSH tunnel)
```

### Proxy Returns 401 Errors

**Symptom**: All API calls fail with unauthorized

**Solution**:
```bash
# Verify .env has correct keys
cat ~/claude-stack/.env | grep API_KEY

# Test API key manually
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Restart proxy after fixing
docker compose restart proxy
```

### Clawdbot Can't Access Proxy

**Symptom**: "Connection refused" when clawdbot tries to reach proxy

**Diagnosis**:
```bash
# From clawdbot container, test connectivity
docker exec clawdbot curl -v http://proxy:8082/health

# Check network
docker network inspect claude-network

# Verify both on same network
docker inspect clawdbot | grep -A 10 Networks
docker inspect claude-proxy | grep -A 10 Networks
```

**Solution**:
```bash
# Restart both services
docker compose restart clawdbot proxy

# If still failing, recreate network
docker compose down
docker network disconnect claude-network clawdbot
docker network disconnect claude-network proxy
docker network connect claude-network clawdbot
docker network connect claude-network proxy
docker compose up -d
```

### Scheduled Jobs Not Running

**Symptom**: Ofelia scheduler shows no activity

**Diagnosis**:
```bash
# Check scheduler logs
docker compose logs scheduler

# Verify config is mounted
docker exec scheduler cat /etc/ofelia/config.ini

# Check syntax of cron.ini
docker compose config
```

**Solution**:
```bash
# Edit cron.ini and ensure jobs are enabled
nano ~/claude-stack/clawdbot/tasks/cron.ini
# Make sure "enable = true" is uncommented

# Restart scheduler
docker compose restart scheduler

# Manually trigger a job for testing
docker exec clawdbot claude "Test prompt" --dangerously-skip-permissions
```

---

## Networking Issues

### Can't Access Services from Local Machine

**Symptom**: "Connection refused" when accessing http://localhost:8081

**Diagnosis**:
```bash
# On VPS: Check service is running
docker compose ps

# On VPS: Test locally
curl http://localhost:8081/health

# On VPS: Check firewall
sudo iptables -L -n
```

**Solution**:

1. **Verify SSH tunnel is running** (on local machine):
   ```bash
   # In separate terminal, run:
   ssh -L 8081:localhost:8081 -L 8082:localhost:8082 ubuntu@VPS_IP

   # Keep this terminal open
   ```

2. **Check Oracle Security List**:
   - Go to Oracle Console
   - Networking → Virtual Cloud Networks → Security Lists
   - Verify ingress rules allow ports 8081, 8082

3. **Test from VPS**:
   ```bash
   # If this works but local doesn't, it's SSH tunnel issue
   curl http://localhost:8081/health
   ```

### Services Can't Reach Each Other

**Symptom**: "Name or service not known"

**Diagnosis**:
```bash
# Check if containers on same network
docker network inspect claude-network

# Test DNS resolution
docker exec clawdbot nslookup proxy
```

**Solution**:
```bash
# Ensure all services declare the network
# In docker-compose.yml, each service should have:
networks:
  - claude-network

# Restart stack
docker compose down
docker compose up -d
```

### High Latency

**Symptom**: Slow API responses

**Diagnosis**:
```bash
# Test network latency
docker exec clawdbot ping -c 10 proxy

# Check proxy response time
time docker exec clawdbot curl http://proxy:8082/health

# Check system load
uptime
top
```

**Solution**:
```bash
# Restart services (clears any accumulated issues)
docker compose restart

# If persistent, check Oracle VPS resources
# May need to upgrade instance shape
```

---

## Performance Issues

### Out of Memory

**Symptom**: Services killed with OOM (Out of Memory)

**Diagnosis**:
```bash
# Check memory usage
free -h

# Check container memory
docker stats --no-stream | grep -E "NAME|%"

# Look for OOM killer in logs
dmesg | grep -i oom
```

**Solution**:
```bash
# Add memory limits to docker-compose.yml
# Add to each service:
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 1G

# Restart
docker compose up -d

# Or upgrade VPS instance in Oracle Console
```

### High CPU Usage

**Symptom**: System sluggish, high load average

**Diagnosis**:
```bash
# Check CPU usage
top

# Check container CPU
docker stats --no-stream

# Find high-pid process
docker exec clawdbot ps aux --sort=-%cpu | head -10
```

**Solution**:
```bash
# Restart affected service
docker compose restart [service-name]

# Add CPU limits to docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1.5'

# If persistent, may need OCPU upgrade
```

### Disk Space Full

**Symptom**: "No space left on device"

**Diagnosis**:
```bash
# Check disk usage
df -h

# Find large files
du -sh /var/lib/docker/* | sort -h

# Check Docker space usage
docker system df
```

**Solution**:
```bash
# Clean Docker (WARNING: deletes unused data)
docker system prune -a --volumes

# Clean old backups
ls ~/backups/
rm -rf ~/backups/old_backup_*

# If persistent, add block volume in Oracle Console
```

### Docker Overlay Size Growing

**Symptom**: Container layer size keeps increasing

**Diagnosis**:
```bash
# Check container size
docker ps -s

# Check image size
docker images

# Check overlay usage
du -sh /var/lib/docker/overlay2/*
```

**Solution**:
```bash
# Prune unused images
docker image prune -a

# Rebuild images with --no-cache
docker compose build --no-cache

# Regular cleanup
docker system prune -f
```

---

## Data Issues

### Lost Claude Authentication

**Symptom**: Clawdbot asks for login again

**Solution**:
```bash
# Check if auth volume exists
docker volume ls | grep claude-auth

# If missing, recreate
docker volume create claude-auth

# Restart and re-authenticate
docker compose restart clawdbot
docker exec -it clawdbot claude "test"
# Follow prompts to login
```

### Repository Disappeared

**Symptom**: Can't find repo in /workspace

**Diagnosis**:
```bash
# Check workspace volume
docker volume ls | grep workspace

# Inspect volume
docker run --rm -v workspace:/data alpine ls -la /data

# Check if mounted correctly
docker inspect clawdbot | grep -A 5 Mounts
```

**Solution**:
```bash
# If volume is empty but has backup
~/claude-stack/scripts/restore.sh ~/backups/LATEST

# If no backup, re-clone repos
cd ~/claude-stack/workspace/repos
git clone https://github.com/USER/REPO.git
```

### Backup Corrupted

**Symptom**: Restore script fails

**Diagnosis**:
```bash
# Verify backup integrity
tar tzf ~/backups/BACKUP_DIR/claude-auth.tar.gz

# Check if files exist
ls -la ~/backups/BACKUP_DIR/
```

**Solution**:
```bash
# Use previous backup
~/claude-stack/scripts/restore.sh ~/backups/PREVIOUS_BACKUP

# If all backups corrupted, manual recovery:
docker volume create claude-auth
docker compose up -d
docker exec -it clawdbot claude "test"  # Re-authenticate
```

### Configuration Reset

**Symptom**: Settings changed back to defaults

**Diagnosis**:
```bash
# Check current config
cat ~/claude-stack/.env
cat ~/claude-stack/proxy/config.json

# Check git status
cd ~/claude-stack
git status
```

**Solution**:
```bash
# If config was overwritten, restore from backup
cp ~/backups/LATEST/.env.backup ~/claude-stack/.env

# Or re-edit
nano ~/claude-stack/.env

# Restart services
docker compose restart
```

---

## Getting Help

### Gather Diagnostic Information

Before asking for help, collect this information:

```bash
# Create diagnostic bundle
DIAG_DIR=~/diagnostics_$(date +%Y%m%d)
mkdir -p $DIAG_DIR

# System info
uptime > $DIAG_DIR/system.txt
free -h >> $DIAG_DIR/system.txt
df -h >> $DIAG_DIR/system.txt
docker version >> $DIAG_DIR/system.txt

# Docker status
docker compose ps > $DIAG_DIR/docker-status.txt
docker stats --no-stream > $DIAG_DIR/docker-stats.txt

# Recent logs
docker compose logs --tail 100 > $DIAG_DIR/logs.txt

# Config (remove secrets!)
cat ~/claude-stack/.env | sed 's/=.*/=***REDACTED**/' > $DIAG_DIR/env.txt

# Network info
docker network inspect claude-network > $DIAG_DIR/network.json

# Create tarball
cd ~
tar czf diagnostics_$(date +%Y%m%d).tar.gz diagnostics_$(date +%Y%m%d)

echo "Diagnostic bundle created: ~/diagnostics_$(date +%Y%m%d).tar.gz"
```

### Useful Resources

- Docker Documentation: https://docs.docker.com/
- Docker Compose Reference: https://docs.docker.com/compose/compose-file/
- Ofelia Documentation: https://github.com/mcuadros/ofelia
- Oracle Cloud Documentation: https://docs.oracle.com/en-us/iaas/

### Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| 125 | Container failed to start | Check logs, verify config |
| 126 | Container command not executable | Check Dockerfile CMD |
| 127 | Command not found | Verify image has required binaries |
| 137 | Container killed (OOM) | Increase memory limit |
| 401 | Unauthorized | Check API keys |
| 503 | Service unavailable | Check if dependencies are running |
