# Claude Stack - AI Agent Infrastructure

**Version:** 2.0.0 (Metrics & Enhanced Context)
**Status:** ✅ Production Ready
**Last Updated:** 2026-01-28

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

## What's New in v2.0

**🎯 Enhanced Metrics System:**
- Real-time response time tracking
- Detailed timing breakdown (skill detection, model selection, API call, formatting)
- Model indicator in responses (⚡ Haiku / 🧠 Sonnet)
- Skill detection display

**🧠 Improved AI Context:**
- Bot now knows its capabilities (9 skills)
- Understands available models
- Provides accurate answers about its architecture

**💾 Session Persistence:**
- Conversation history saved across restarts
- Context maintained throughout conversations
- Automatic session cleanup

---

## What's Included

**Current (v2.0):**
- ✅ **Claude Proxy**: Python-based API router with dashboard (Port 8082)
- ✅ **Clawdbot**: AI assistant with orchestrator and skills
- ✅ **Telegram Bot**: Mobile interface with metrics display
- ✅ **Session Store**: Persistent conversation history
- ✅ **Metrics Collector**: Detailed timing breakdowns
- ✅ **9 Specialized Skills**: general, web-search, pr-review, code-exec, docker-mgr, file-ops, organize, tts, web-scrape
- ✅ **Smart Model Selection**: Auto-switches between Haiku (fast) and Sonnet (smart)
- ✅ **Scheduler**: Docker-native cron (Ofelia)
- ✅ **GLM Integration**: Cost-effective AI routing

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Oracle VPS (24GB RAM)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  claude-proxy   │    │  clawdbot-tg    │                │
│  │  (Port 8082)    │◄───│  Telegram Bot   │                │
│  │  Python Flask   │    │  + Orchestrator  │                │
│  └────────▲────────┘    │  + 9 Skills      │                │
│           │               │  + Session Store │                │
│           │               │  + Metrics      │                │
│           │               └────────▲────────┘                │
│           │                       │                          │
│           │               ┌───────┴────────┐                │
│           │               │   workspace    │                │
│  ┌────────┴────────┐      │  (Shared Vol)  │                │
│  │  clawdbot      │      └────────────────┘                │
│  │  Claude Code   │                                      │
│  │  Agent/Worker  │                                      │
│  └─────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
    Z.AI GLM API                          User's Phone (Telegram)
```

---

## Telegram Bot Features

### Response Metrics

Every response includes a metrics header:
```
⚡ Haiku (Fast) | general | 1234ms
```

- **⚡ Haiku (Fast)** - Quick responses for simple questions
- **🧠 Sonnet (Smart)** - Complex tasks requiring reasoning
- **Skill** - Detected skill (general, web-search, pr-review, etc.)
- **Time** - Total response time in milliseconds

### Available Skills (9 Total)

1. **general** - General chat and questions
2. **web-search** - Search the web for current information
3. **pr-review** - Review pull requests and code
4. **code-exec** - Execute code in a Docker sandbox
5. **docker-mgr** - Manage Docker containers
6. **file-ops** - Download and upload files
7. **organize** - Organize and categorize information
8. **tts** - Text-to-speech conversion
9. **web-scrape** - Extract data from websites

### Smart Model Selection

The bot automatically chooses:
- **Haiku (Fast)** ⚡ - Simple questions, quick answers
- **Sonnet (Smart)** 🧠 - Complex tasks, code analysis, deep reasoning

Selection based on:
- Task complexity keywords
- Message length
- Conversation depth

### Session Persistence

- ✅ Conversation history saved across restarts
- ✅ Context maintained throughout conversations
- ✅ Automatic session cleanup (1 hour retention)
- ✅ Efficient storage in `/tmp/clawdbot-sessions.json`

### Usage Examples

**General Chat:**
```
Who are you?
What skills do you have?
What's 2+2?
Explain React hooks
```

**Smart Tasks (auto-detected):**
```
Review PR https://github.com/user/repo #123
Search for Python 3.12 features
Run this code: print('hello')
Create a Docker container for Node.js
```

**Commands:**
```
/start  - Get started
/help   - Show help
/skills - List all skills
/status - System status
/clear  - Clear chat history
```

**File Upload:**
Attach any file and Claude will analyze it!

---

## Project Structure

```
claude-stack/
├── docker-compose.yml              # Main orchestration
├── .env.example                    # Environment template
├── .gitignore
│
├── clawdbot/                       # Main bot directory
│   ├── Dockerfile                  # Bot container definition
│   ├── bot/                        # Telegram bot
│   │   ├── index.js                # Main bot handler
│   │   ├── metrics-collector.js    # Timing metrics
│   │   ├── emoji-mappings.js       # Emoji definitions
│   │   ├── message-metadata-store.js # Message metadata
│   │   ├── reaction-handler.js     # Reaction system
│   │   └── user-prompt-handler.js  # User prompts
│   ├── orchestrator/               # Task orchestration
│   │   ├── main.js                 # Orchestrator logic
│   │   ├── model-picker.js         # Model selection
│   │   └── skill-router.js         # Skill detection
│   ├── storage/                    # Data persistence
│   │   ├── session-store.js        # Session management
│   │   └── fast-responder.js       # Instant responses
│   ├── skills/                     # Specialized handlers
│   │   ├── web-search.js
│   │   ├── code-exec.js
│   │   └── ...
│   └── prompts/                    # Prompt templates
│
├── proxy/                          # API router
│   ├── Dockerfile
│   ├── proxy.py
│   └── config.json
│
├── scripts/                        # Utility scripts
│   ├── bootstrap.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── update.sh
│
└── docs/                           # Documentation
    ├── SETUP.md
    ├── ARCHITECTURE.md
    ├── RUNBOOK.md
    ├── TROUBLESHOOTING.md
    ├── SKILLS_SYSTEM.md
    └── AI_AGENT_GUIDE.md
```

---

## Configuration

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
GH_TOKEN=ghp_xxxxx
GITHUB_COPILOT_API_KEY=ghu_xxxxx
GLM_API_KEY=xxxxx
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### Proxy Configuration

Edit `proxy/config.json`:

```json
{
  "routes": {
    "anthropic": {"priority": 1},
    "githubCopilot": {"priority": 2},
    "antigravity": {"priority": 3}
  }
}
```

---

## Common Commands

### Service Management

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f clawdbot-telegram

# Restart service
docker-compose restart clawdbot-telegram

# Stop all services
docker-compose down
```

### View Session Data

```bash
# Check session store
docker exec clawdbot-telegram cat /tmp/clawdbot-sessions.json

# Clear sessions
docker exec clawdbot-telegram rm /tmp/clawdbot-sessions.json
```

---

## Metrics & Timing

The bot tracks detailed metrics for every request:

**Timing Breakdown:**
- Total response time
- Skill detection time
- Model selection time
- API call time
- Response formatting time

**Flow Metadata:**
- Skill used
- Model selected
- Complexity score
- Sub-agents invoked

---

## Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete VPS setup
- **[Architecture](docs/ARCHITECTURE.md)** - Technical design
- **[Runbook](docs/RUNBOOK.md)** - Operational procedures
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues
- **[Skills System](docs/SKILLS_SYSTEM.md)** - Available skills

---

## Cost (Oracle Free Tier)

| Resource | Allocation | Cost |
|----------|------------|------|
| Compute (AMD) | 2 OCPU, 16 GB RAM | **$0** |
| Block Storage | 200 GB | **$0** |
| Network Egress | 10 TB/month | **$0** |

**Total: $0/month**

---

## Support

For issues, questions, or contributions:

1. Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Review [Runbook](docs/RUNBOOK.md)
3. Open an issue on GitHub

---

**Made with ❤️ for automated AI workflows**
