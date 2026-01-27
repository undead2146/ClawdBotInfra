# Runbook: Operational Procedures

Step-by-step procedures for common operational tasks.

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Service Management](#service-management)
3. [Maintenance Tasks](#maintenance-tasks)
4. [Emergency Procedures](#emergency-procedures)
5. [Monitoring & Debugging](#monitoring--debugging)

---

## Daily Operations

### Check Stack Health

```bash
# Quick status check
docker compose ps

# Detailed health check
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# Check resource usage
docker stats
```

**Expected Output**:
```
NAME           STATUS          PORTS
antigravity    Up (healthy)    0.0.0.0:8081->8081/tcp
claude-proxy   Up (healthy)    0.0.0.0:8082->8082/tcp
clawdbot       Up              80/tcp
scheduler      Up              80/tcp
```

### View Recent Activity

```bash
# Recent logs (all services)
docker compose logs --since 1h

# Specific service
docker compose logs -f clawdbot

# Scheduled task results
docker compose logs scheduler --since 24h
```

### Trigger Manual Task

```bash
# PR Review
docker exec -it clawdbot claude "Review all open PRs in /workspace/repos. Check for bugs and security issues. Post summary comments." --dangerously-skip-permissions

# Dependency Check
docker exec -it clawdbot claude "Check all repos in /workspace for outdated dependencies. Flag security vulnerabilities." --dangerously-skip-permissions

# Custom Analysis
docker exec -it clawdbot claude "Analyze the performance bottlenecks in /workspace/repos/my-app" --dangerously-skip-permissions
```

---

## Service Management

### Restart a Service

```bash
# Single service
docker compose restart proxy

# Multiple services
docker compose restart clawdbot scheduler

# Full stack (brief outage)
docker compose restart
```

### Update a Service

```bash
# Pull latest changes
cd ~/claude-stack
git pull

# Rebuild specific service
docker compose build proxy
docker compose up -d proxy

# Rebuild entire stack
docker compose build
docker compose up -d
```

### Stop/Start Services

```bash
# Stop all services (preserves data)
docker compose stop

# Start all services
docker compose start

# Stop and remove containers (data safe)
docker compose down

# Stop and remove everything (including volumes - DELETES DATA)
docker compose down -v  # ⚠️ DANGER
```

### Scale Services

```bash
# Run multiple clawdbot instances
docker compose up -d --scale clawdbot=3

# View scaled instances
docker ps --filter "name=clawdbot"
```

---

## Maintenance Tasks

### Add a New Scheduled Task

1. **Edit cron configuration**:
   ```bash
   nano ~/claude-stack/clawdbot/tasks/cron.ini
   ```

2. **Add new job**:
   ```ini
   [job-exec "my-new-task"]
   schedule = 0 14 * * *
   container = clawdbot
   command = claude "Your prompt here" --dangerously-skip-permissions
   enable = true
   ```

3. **Restart scheduler**:
   ```bash
   docker compose restart scheduler
   ```

4. **Verify**:
   ```bash
   docker compose logs scheduler --since 1m
   ```

### Add a New Repository

```bash
# Navigate to workspace
cd ~/claude-stack/workspace/repos

# Clone repository
git clone https://github.com/USER/REPO.git

# Verify access
docker exec -it clawdbot ls -la /workspace/repos

# Test analysis
docker exec -it clawdbot claude "What's in /workspace/repos/REPO?"
```

### Update Prompt Templates

```bash
# Edit prompt
nano ~/claude-stack/clawdbot/prompts/pr-review.md

# Restart clawdbot to reload
docker compose restart clawdbot

# Test new prompt
docker exec -it clawdbot claude "Use the pr-review prompt template" --dangerously-skip-permissions
```

### Change API Routing Priority

```bash
# Edit proxy config
nano ~/claude-stack/proxy/config.json

# Modify priority values
"routes": {
  "anthropic": {"priority": 1},
  "githubCopilot": {"priority": 2},
  "antigravity": {"priority": 3}
}

# Restart proxy
docker compose restart proxy
```

### Perform Backup

```bash
# Manual backup
cd ~/claude-stack
./scripts/backup.sh

# View backup
ls -lht ~/backups/ | head -5
```

### Restore from Backup

```bash
# List available backups
ls ~/backups/

# Restore specific backup
cd ~/claude-stack
./scripts/restore.sh ~/backups/20250127_120000

# Verify restoration
docker compose ps
```

---

## Emergency Procedures

### Service Won't Start

**Symptoms**: `docker compose ps` shows `Exit 1` or `Restarting`

**Diagnosis**:
```bash
# Check logs
docker compose logs [service-name]

# Check last 50 lines
docker compose logs --tail 50 [service-name]
```

**Common Fixes**:

1. **Out of memory**:
   ```bash
   # Check memory
   free -h

   # Restart with more memory (edit docker-compose.yml)
   deploy:
     resources:
       limits:
         memory: 4G
   ```

2. **Port already in use**:
   ```bash
   # Find process using port
   sudo lsof -i :8082

   # Kill process
   sudo kill <PID>
   ```

3. **Volume corruption**:
   ```bash
   # Recreate volume
   docker compose down
   docker volume rm [volume-name]
   docker volume create [volume-name]
   docker compose up -d
   ```

### API Authentication Failed

**Symptoms**: 401 errors in proxy logs

**Diagnosis**:
```bash
# Check .env file
cat ~/claude-stack/.env

# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

**Fix**:
```bash
# Update .env with new key
nano ~/claude-stack/.env

# Restart services
docker compose restart proxy clawdbot
```

### Disk Full

**Symptoms**: "No space left on device"

**Diagnosis**:
```bash
# Check disk usage
df -h

# Find large files
du -sh /var/lib/docker/* | sort -h
```

**Fix**:
```bash
# Clean Docker system (prunes unused images, containers, networks)
docker system prune -a --volumes

# ⚠️ WARNING: This deletes unused data
```

### Clawdbot Stuck/Frozen

**Symptoms**: Task hangs, no output

**Diagnosis**:
```bash
# Check if process is running
docker exec clawdbot ps aux

# Check container status
docker top clawdbot
```

**Fix**:
```bash
# Force restart
docker compose restart clawdbot

# If that fails, force kill
docker compose kill clawdbot
docker compose up -d clawdbot
```

### Complete Recovery (Nuclear Option)

**Use only if all else fails**:

```bash
cd ~/claude-stack

# 1. Backup everything first
./scripts/backup.sh

# 2. Stop everything
docker compose down -v

# 3. Remove all Docker data
docker system prune -a --volumes --force

# 4. Reinstall Docker
curl -fsSL https://get.docker.com | sh

# 5. Restore from backup
./scripts/restore.sh ~/backups/LATEST

# 6. Restart
docker compose up -d
```

---

## Monitoring & Debugging

### Real-time Monitoring

```bash
# All services
docker compose logs -f

# Multiple specific services
docker compose logs -f proxy clawdbot

# With timestamps
docker compose logs -f --timestamps
```

### Check Rate Limits

```bash
# Access proxy dashboard
curl http://localhost:8082/api/rate-limits

# View routing stats
curl http://localhost:8082/api/stats
```

### Debug Failed Task

```bash
# Find task in logs
docker compose logs scheduler | grep "job-exec \"daily-pr-review\""

# Check clawdbot logs for that time
docker compose logs clawdbot --since 2025-01-27T09:00:00 --until 2025-01-27T10:00:00
```

### Inspect Container Internals

```bash
# Enter running container
docker exec -it clawdbot bash

# Inside container:
ls -la /workspace
cat /root/.claude/settings.json
ps aux
top
```

### Network Debugging

```bash
# Test connectivity between containers
docker exec clawdbot curl -v http://proxy:8082/health

# Check network configuration
docker network inspect claude-network

# Trace route
docker exec clawdbot traceroute proxy
```

### Performance Profiling

```bash
# Real-time stats
docker stats

# Detailed stats (no stream)
docker stats --no-stream

# Resource usage by container
docker exec clawdbot ps aux --sort=-%mem | head -10
```

---

## Checklist Templates

### Daily Health Check

- [ ] Verify all services running: `docker compose ps`
- [ ] Check for errors in logs: `docker compose logs --since 24h`
- [ ] Verify disk space: `df -h`
- [ ] Check memory usage: `free -h`
- [ ] Review scheduled tasks: `docker compose logs scheduler --since 24h`

### Weekly Maintenance

- [ ] Run backup: `~/claude-stack/scripts/backup.sh`
- [ ] Review and clean old backups: `ls ~/backups/`
- [ ] Update infrastructure: `~/claude-stack/scripts/update.sh`
- [ ] Review scheduled tasks effectiveness
- [ ] Check for Docker updates: `docker version`

### Monthly Review

- [ ] Review all API keys (rotate if needed)
- [ ] Audit security settings (Oracle console)
- [ ] Review and update prompt templates
- [ ] Performance review (stats for the month)
- [ ] Cost analysis (ensure staying in free tier)

---

## Useful Aliases

Add to `~/.bashrc` for convenience:

```bash
# Claude Stack aliases
alias cls='cd ~/claude-stack'
alias cls-status='docker compose ps'
alias cls-logs='docker compose logs -f'
alias cls-restart='docker compose restart'
alias cls-backup='~/claude-stack/scripts/backup.sh'
alias cls-update='~/claude-stack/scripts/update.sh'
alias cls-proxy='docker exec -it clawdbot claude'
```

Reload: `source ~/.bashrc`
