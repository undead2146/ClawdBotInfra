# Claude Stack Architecture

Technical documentation of the Claude Stack infrastructure design.

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Design Decisions](#design-decisions)
5. [Technology Choices](#technology-choices)
6. [Scaling Considerations](#scaling-considerations)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Oracle VPS                               │
│                      (24GB RAM, 4 OCPU)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │   Antigravity    │    │   Claude Proxy   │                  │
│  │   Port: 8081     │◄───│   Port: 8082     │                  │
│  │   Gemini Bridge  │    │   API Router     │                  │
│  │                  │    │   Your Repo      │                  │
│  └──────────────────┘    └────────▲─────────┘                  │
│                                    │                            │
│                           ┌────────┴────────┐                   │
│                           │   Clawdbot      │                   │
│                           │   Claude Code   │                   │
│                           │   Agent/Worker  │                   │
│                           └────────┬────────┘                   │
│                                    │                            │
│                           ┌────────▼────────┐                   │
│                           │   Workspace     │                   │
│                           │   /repos        │                   │
│                           │   /tasks        │                   │
│                           │   /summaries    │                   │
│                           │   (Shared Vol)  │                   │
│                           └─────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Antigravity (Gemini Bridge)

**Purpose**: Provides access to Google's Gemini API through a Claude-compatible interface.

**Image**: `node:20-slim`
**Port**: 8081
**Volume**: `antigravity-data` (stores auth tokens)

**Key Features**:
- Standalone NPM package
- Auto-installs on container start
- No configuration required (OAuth via browser)
- Health check endpoint

**Why Separate?**:
- Independent lifecycle (can restart without affecting other services)
- Authentication state isolation
- Easy to update without rebuilding stack

---

### 2. Claude Proxy (API Router)

**Purpose**: Intelligent request routing across multiple LLM providers with rate limiting and caching.

**Image**: Custom build from `proxy/` directory
**Port**: 8082
**Volume**: `proxy-config` (runtime configuration)

**Routing Logic**:

```
Request → Check Priority 1 (Anthropic) → Available?
                    ↓ No
              Check Priority 2 (Copilot) → Available?
                    ↓ No
              Check Priority 3 (Antigravity/Gemini) → Available?
                    ↓ No
                    Return Error
```

**Features**:
- **Rate Limiting**: Per-provider request/token limits
- **Caching**: 5-minute TTL for identical requests
- **Failover**: Automatic fallback to next provider
- **Logging**: Request/response logging for debugging
- **Health Check**: `/health` endpoint for monitoring

---

### 3. Clawdbot (Claude Code Agent)

**Purpose**: Automated code analysis, task execution, and repository management.

**Image**: Custom build from `clawdbot/`
**Base**: `node:20-slim` + Claude Code CLI
**Volumes**:
- `claude-auth`: Claude authentication state
- `/workspace`: Shared workspace for repos and tasks
- `/prompts`: Read-only prompt templates

**Environment**:
- `ANTHROPIC_BASE_URL`: Points to proxy (not Anthropic directly)
- `ANTHROPIC_API_KEY`: Placeholder (proxy handles auth)
- `GH_TOKEN`: For GitHub operations

**Why TTY + Stdin Open?**:
- Allows interactive `claude` commands
- Required for Claude Code CLI to function

---

### 4. Scheduler (Ofelia)

**Purpose**: Docker-native cron job scheduler.

**Image**: `mcuadros/ofelia:latest`
**Config**: `clawdbot/tasks/cron.ini`

**Why Ofelia over crontab?**

| Feature | crontab | Ofelia |
|---------|---------|--------|
| Docker-aware | No | Yes |
| Logs | Mixed | Per-job |
| Enable/disable | Edit crontab | Toggle in config |
| Container targeting | Complex | Simple `container=` |

**Job Types**:
- `job-exec`: Run command in container
- `job-run`: Start new container
- `job-local`: Run on host (not used)

---

## Data Flow

### Typical Request Flow

```
┌─────────────┐
│ Clawdbot    │
│ (User/Task) │
└──────┬──────┘
       │
       │ 1. Claude API Request
       │    POST /v1/messages
       ▼
┌─────────────┐
│ Claude Proxy│
└──────┬──────┘
       │
       ├─► 2a. Anthropic (primary)
       │        ↓
       │    ✓ Success
       │
       ├─► 2b. Copilot (backup)
       │        ↓
       │    ✓ Success
       │
       ├─► 2c. Antigravity → Gemini (last resort)
       │        ↓
       │    ✓ Success
       │
       │ 3. Route Response
       ▼
┌─────────────┐
│ Clawdbot    │
│ (Result)    │
└─────────────┘
```

### Scheduled Task Flow

```
┌──────────┐
│ Ofelia   │
│Scheduler │
└─────┬────┘
      │
      │ 1. Trigger (cron)
      │    e.g., "0 9 * * *"
      ▼
┌──────────────────┐
│ Execute in       │
│ clawdbot container│
│ "claude '...'"   │
└─────┬────────────┘
      │
      │ 2. Claude Request
      ▼
┌──────────────┐
│ Claude Proxy │
└─────┬────────┘
      │
      │ 3. Route to Provider
      ▼
┌──────────────┐
│ LLM Provider │
└─────┬────────┘
      │
      │ 4. Response
      ▼
┌──────────────┐
│ Save to      │
│ /workspace   │
└──────────────┘
```

---

## Design Decisions

### 1. Why Separate Containers?

| Concern | Single Container | Separate Containers |
|---------|------------------|---------------------|
| **Restart isolation** | Proxy crash kills bot | Proxy restarts independently |
| **Updates** | Rebuild everything | Update only what changed |
| **Logs** | Mixed, hard to debug | `docker logs proxy` |
| **Resource limits** | Shared | Can limit RAM per service |
| **Security** | One breach = all access | Isolated networks |

### 2. Why Docker Compose over Kubernetes?

| Factor | Docker Compose | Kubernetes |
|--------|----------------|------------|
| **Complexity** | Low | High |
| **Setup Time** | Minutes | Hours |
| **Learning Curve** | Simple | Steep |
| **VPS Resources** | Perfect fit | Overkill |
| **Scalability** | Limited | Horizontal |

**Decision**: Docker Compose is ideal for single-VPS deployment.

### 3. Why Ofelia over Native Crontab?

- Docker-native (no host access needed)
- Container targeting built-in
- Easy enable/disable via config file
- Better logging and error handling

### 4. Why Shared Workspace Volume?

- Persistent storage survives container restarts
- Multiple services can access same data
- Easy to backup single volume
- Git repos live outside containers

---

## Technology Choices

### Base Images

| Service | Base Image | Rationale |
|---------|-----------|-----------|
| Antigravity | `node:20-slim` | NPM package requires Node.js |
| Proxy | `node:20-slim` | Node.js application |
| Clawdbot | `node:20-slim` | Claude Code CLI requires Node.js |
| Scheduler | `mcuadros/ofelia` | Official Ofelia image |

**Why `slim` variants?**
- Smaller image size
- Faster pull/build times
- Fewer security vulnerabilities (smaller attack surface)

### Volume Strategy

| Volume | Purpose | Backup Frequency |
|--------|---------|------------------|
| `antigravity-data` | Auth tokens | When changed |
| `proxy-config` | Routing rules | When changed |
| `claude-auth` | Claude login state | Daily |
| `workspace` | Repos & tasks | Daily |

### Networking

- **Single Bridge Network**: `claude-network`
- **Internal Communication**: Service names as hostnames
  - `http://proxy:8082` (from clawdbot)
  - `http://antigravity:8081` (from proxy)
- **External Access**: Port mapping to host

---

## Scaling Considerations

### Current Architecture Supports

- **Multiple Repositories**: Unlimited in workspace
- **Concurrent Tasks**: One at a time (Claude Code limitation)
- **Scheduled Jobs**: Unlimited (Ofelia)

### Scaling Up (Vertical)

If resources are constrained:

1. **Add Memory** (Oracle Console):
   - Change instance shape
   - Update memory limits in docker-compose.yml

2. **Add CPU**:
   - Increase OCPU count
   - Adjust CPU quotas in compose file

3. **Add Disk**:
   - Attach block volume
   - Mount to `/workspace`

### Scaling Out (Horizontal)

For multiple bots:

```yaml
services:
  clawdbot-1:
    <<: *clawdbot-config
    container_name: clawdbot-1

  clawdbot-2:
    <<: *clawdbot-config
    container_name: clawdbot-2

  clawdbot-3:
    <<: *clawdbot-config
    container_name: clawdbot-3
```

Each bot gets:
- Independent workspace volume
- Separate claude-auth volume
- Unique scheduled tasks

### Multi-VPS Architecture

For very large deployments:

```
                    Load Balancer
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  VPS 1   │    │  VPS 2   │    │  VPS 3   │
    │ Proxy +  │    │ Proxy +  │    │ Proxy +  │
    │ 2 Bots   │    │ 2 Bots   │    │ 2 Bots   │
    └──────────┘    └──────────┘    └──────────┘
```

---

## Cost Breakdown (Oracle Free Tier)

| Resource | Allocation | Monthly Cost |
|----------|------------|--------------|
| VM.Standard.E4.Flex | 2 OCPU, 16GB RAM | **$0** (free tier) |
| Block Volume | 200GB | **$0** (free tier) |
| Egress | 10TB/month | **$0** (free tier) |
| **Total** | | **$0/month** |

**Free Tier Limits****:
- 2 AMD-based VMs
- 10TB network egress
- 200GB block storage
- Always Free (no time limit)

---

## Security Considerations

### Isolation

- **Containers**: Isolated via Docker networks
- **Volumes**: Encrypted at rest (Oracle default)
- **Network**: Security List (firewall) restricts access

### Secrets Management

- `.env` file (never committed)
- Docker secrets (future improvement)
- Volume-based auth storage (not in images)

### Recommendations

1. **Restrict Firewall**: Allow only your IP on 8081/8082
2. **Use SSH Keys**: Disable password authentication
3. **Regular Updates**: `./scripts/update.sh` weekly
4. **Monitor Logs**: `docker compose logs -f` regularly
5. **Automated Backups**: Daily via cron

---

## Future Improvements

### Short Term

- [ ] Add Prometheus metrics endpoint to proxy
- [ ] Implement log aggregation (ELK/Loki)
- [ ] Add webhooks for task completion
- [ ] Implement retry logic for failed tasks

### Long Term

- [ ] Grafana dashboard for monitoring
- [ ] Auto-scaling based on queue depth
- [ ] Multi-region deployment
- [ ] CI/CD pipeline integration
