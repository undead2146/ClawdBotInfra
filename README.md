# Claude Stack - AI Agent Infrastructure

**Version:** 1.1.0 (Enhanced Bot with Chat-by-Default)
**Status:** ✅ Production Ready (Basic)
**Roadmap:** See [ARCHITECTURE.md](ARCHITECTURE.md) for multi-agent plans

---

## Quick Start

```bash
# 1. Clone this repository
git clone <repo-url> ~/claude-stack
cd ~/claude-stack

# 2. Start all services
docker-compose up -d

# 3. Check status
docker-compose ps
```

---

## What's Included

**Current (v1.1):**
- ✅ **Claude Proxy**: Python-based API router with dashboard (Port 8082)
- ✅ **Clawdbot**: Claude Code agent for automated tasks
- ✅ **Telegram Bot**: Mobile interface with chat-by-default
- ✅ **Scheduler**: Docker-native cron (Ofelia)
- ✅ **GLM Integration**: Cost-effective AI routing
- ✅ **Workspace**: Persistent storage for repositories

**Planned (v2.0 - Multi-Agent):**
- 🔄 Message broker (RabbitMQ/Redis)
- 🔄 Specialized agents (PR reviewer, coder, scraper)
- 🔄 Workflow orchestration (CrewAI/LangGraph)
- 🔄 Smart task routing

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed roadmap.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Oracle VPS (24GB RAM)                    │
│                    IP: 152.70.171.121                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  claude-proxy   │    │  clawdbot       │                │
│  │  (Port 8082)    │◄───│  Claude Code    │                │
│  │  Python Flask   │    │  Agent/Worker   │                │
│  └────────▲────────┘    └────────▲────────┘                │
│           │                       │                          │
│           │               ┌───────┴────────┐                │
│           │               │   workspace    │                │
│  ┌────────┴────────┐      │  (Shared Vol)  │                │
│  │ clawdbot-tg-bot │      └────────────────┘                │
│  │ Telegram Bot    │                                      │
│  │ (Chat by Def)   │                                      │
│  └─────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
    Z.AI GLM API                          User's Phone (Telegram)
```

---

## Telegram Bot - Now with Chat-by-Default!

**No more `/chat` command needed!** Just type and chat.

### Usage Examples

**General Chat:**
```
Who are you?
What's 2+2?
Explain React hooks
```

**Smart Tasks (auto-detected):**
```
Review PR in https://github.com/user/repo #123
Create PR for adding user authentication
Sync todos from ticktick.com
```

**Commands:**
```
/start  - Get started
/help   - Show help
/status - System status
```

**File Upload:**
Attach any file and Claude will analyze it!

### How It Works

The bot intelligently detects your intent:
- Contains "PR" + "review" → PR Review mode
- Contains "create" + "PR" → PR Creation mode
- Contains "todo" or "sync" → Todo sync mode
- Anything else → Natural chat with Claude

## Project Structure

```
claude-stack/
├── docker-compose.yml          # Main orchestration
├── .env.example                # Environment template
├── .gitignore
│
├── clawdbot/                   # Claude Code agent
│   ├── Dockerfile
│   ├── settings.json
│   ├── prompts/                # Prompt templates
│   │   ├── pr-review.md
│   │   ├── daily-summary.md
│   │   └── issue-drafter.md
│   └── tasks/                  # Scheduled tasks
│       ├── cron.ini            # Ofelia config
│       └── hooks/              # Git hooks
│
├── proxy/                      # API router
│   ├── Dockerfile
│   └── config.json
│
├── scripts/                    # Utility scripts
│   ├── bootstrap.sh            # Fresh VPS setup
│   ├── backup.sh               # Backup volumes
│   ├── restore.sh              # Restore from backup
│   ├── update.sh               # Update stack
│   └── tunnel.sh               # SSH tunnel helper
│
└── docs/                       # Documentation
    ├── SETUP.md                # Complete setup guide
    ├── ARCHITECTURE.md         # Technical design
    ├── RUNBOOK.md              # Operational procedures
    └── TROUBLESHOOTING.md      # Common issues
```

## Configuration

### Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
nano .env
```

Required variables:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
GH_TOKEN=ghp_xxxxx
GITHUB_COPILOT_API_KEY=ghu_xxxxx
GLM_API_KEY=xxxxx
```

### Proxy Configuration

Edit `proxy/config.json` to customize routing:

```json
{
  "routes": {
    "anthropic": {"priority": 1},
    "githubCopilot": {"priority": 2},
    "antigravity": {"priority": 3}
  }
}
```

### Scheduled Tasks

Edit `clawdbot/tasks/cron.ini` to add/modify jobs:

```ini
[job-exec "daily-pr-review"]
schedule = 0 9 * * *
container = clawdbot
command = claude "Review all open PRs..." --dangerously-skip-permissions
enable = true
```

## Common Commands

### Service Management

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Restart service
docker compose restart proxy

# Stop all services
docker compose down
```

### Clawdbot Operations

```bash
# Interactive session
docker exec -it clawdbot claude "Analyze /workspace/repos/my-project"

# PR Review
docker exec -it clawdbot claude "Review all open PRs" --dangerously-skip-permissions

# Dependency check
docker exec -it clawdbot claude "Check for outdated dependencies" --dangerously-skip-permissions
```

### Maintenance

```bash
# Backup all data
./scripts/backup.sh

# Restore from backup
./scripts/restore.sh ~/backups/20250127_120000

# Update stack
./scripts/update.sh
```

## Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete VPS setup instructions
- **[Architecture](docs/ARCHITECTURE.md)** - Technical design decisions
- **[Runbook](docs/RUNBOOK.md)** - Operational procedures
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Local Access (SSH Tunnels)

To access services from your local machine:

```bash
# Run on your local machine (not the VPS)
ssh -L 8081:localhost:8081 -L 8082:localhost:8082 ubuntu@YOUR_VPS_IP
```

Then open in browser:
- Antigravity: http://localhost:8081
- Claude Proxy: http://localhost:8082/dashboard

## Backup Strategy

### Automated Daily Backups

Add to crontab:

```bash
crontab -e
# Add: 0 2 * * * /home/ubuntu/claude-stack/scripts/backup.sh
```

### Manual Backup

```bash
cd ~/claude-stack
./scripts/backup.sh
```

Backups are stored in `~/backups/` with timestamp directories:
- Docker volumes (tar.gz)
- Configuration files
- Git state

## Security Considerations

1. **Firewall**: Restrict 8081/8082 to your IP in Oracle Security List
2. **SSH Keys**: Use key-based authentication only
3. **Secrets**: Never commit `.env` file
4. **Updates**: Run `./scripts/update.sh` regularly
5. **Monitoring**: Check logs: `docker compose logs -f`

## Cost (Oracle Free Tier)

| Resource | Allocation | Cost |
|----------|------------|------|
| Compute (AMD) | 2 OCPU, 16 GB RAM | **$0** |
| Block Storage | 200 GB | **$0** |
| Network Egress | 10 TB/month | **$0** |

**Total: $0/month** (within free tier limits)

## Requirements

- Oracle Cloud VPS (Ubuntu 22.04+)
- Docker & Docker Compose
- 2 OCPU, 16 GB RAM minimum
- API keys for services

## Support

For issues, questions, or contributions:

1. Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Review [Runbook](docs/RUNBOOK.md) for common tasks
3. Open an issue on GitHub

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

**Made with ❤️ for automated Claude Code workflows**
