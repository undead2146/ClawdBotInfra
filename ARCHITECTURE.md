# Claude Stack Architecture

**Last Updated:** 2026-01-28
**Version:** 1.0.0 (Basic - Option B)
**Target:** 2.0.0 (Multi-Agent - Option A)

---

## Current Infrastructure (Option B - Basic)

### Overview
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
│           │               │  (Shared Vol)  │                │
│  ┌────────┴────────┐      └────────────────┘                │
│  │ clawdbot-tg-bot │                                      │
│  │ Telegram Bot    │                                      │
│  └─────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                                          │
         ▼                                          ▼
    Z.AI GLM API                          User's Phone (Telegram)
```

### Components

#### 1. **claude-proxy** (Python Flask)
- **Image:** `claude-stack_proxy:latest`
- **Container:** `claude-proxy`
- **Port:** 8082
- **Purpose:** Routes Claude API requests to GLM
- **Code:** `./proxy/` (from https://github.com/undead2146/ClaudeProxy)
- **Dashboard:** http://152.70.171.121:8082/dashboard
- **Environment Variables:**
  - `HAIKU_PROVIDER=glm`
  - `SONNET_PROVIDER=glm`
  - `HAIKU_PROVIDER_API_KEY=f588d31a2a6f4869a0297509da6d42ab.YwwL3W8HRUxLNjIk`
  - `HAIKU_PROVIDER_BASE_URL=https://api.z.ai/api/anthropic`
  - `GLM_HAIKU_MODEL=glm-4.7`

#### 2. **clawdbot** (Claude Code CLI)
- **Image:** `claude-stack_clawdbot:latest`
- **Container:** `clawdbot`
- **Purpose:** Main AI agent/worker
- **Code:** `./clawdbot/`
- **Volumes:**
  - `workspace` → /workspace (shared working directory)
  - `claude-auth` → /root/.claude (Claude auth)
  - `./clawdbot/prompts` → /prompts (read-only prompts)
- **Default Model:** `claude-haiku-4-20250514`

#### 3. **clawdbot-telegram** (Node.js Bot)
- **Image:** `claude-stack_telegram-bot:latest`
- **Container:** `clawdbot-telegram`
- **Purpose:** Mobile interface via Telegram
- **Code:** `./clawdbot/bot/`
- **Token:** `8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y`
- **Access:** Search bot username on Telegram

#### 4. **scheduler** (Ofelia)
- **Image:** `mcuadros/ofelia:latest`
- **Container:** `scheduler`
- **Purpose:** Docker-native cron jobs
- **Config:** `./clawdbot/tasks/cron.ini`

### Volumes
- `proxy-config` - Proxy configuration
- `claude-auth` - Claude authentication data
- `workspace` - Shared workspace for all agents

### Network
- `claude-network` - Bridge network for inter-container communication

---

## Roadmap to Option A (Multi-Agent System)

### Phase 1: Enhanced Bot (Current - Implementing Now)
**Status:** 🔄 In Progress
**Goal:** Make current bot more useful without changing architecture

**Changes:**
- [ ] Remove `/chat` requirement - chat by default
- [ ] Better command parsing and error handling
- [ ] Add more specialized prompts for tasks
- [ ] Improve status reporting
- [ ] Add file/document handling

**Timeline:** Complete today

---

### Phase 2: Agent Foundation (Week 1-2)
**Goal:** Set up infrastructure for multiple specialized agents

**New Components:**
```
┌──────────────────────────────────────────────────────────┐
│                 Message Broker (RabbitMQ/Redis)           │
└──────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Agent 1 │      │ Agent 2 │      │ Agent 3 │
   │ PR      │      │ Coder   │      │ Scraper │
   └─────────┘      └─────────┘      └─────────┘
```

**Tasks:**
1. Choose message broker (RabbitMQ or Redis)
2. Create agent base Dockerfile
3. Implement message protocol
4. Create agent registry

**Deliverables:**
- `docker-compose.yml` with message broker
- `agents/base/` - Base agent image
- `agents/protocol.md` - Message format spec
- `agents/registry.json` - Agent catalog

---

### Phase 3: Specialized Agents (Week 2-4)
**Goal:** Create individual agents for specific tasks

**Agents to Build:**

#### Agent 1: PR Reviewer Agent
```
Container: agent-pr-reviewer
Skills:
  - Clone GitHub repo
  - Fetch PR diff
  - Analyze code for bugs/security
  - Post review comments
Prompts: ./agents/pr-reviewer/prompts/
```

#### Agent 2: Code Writer Agent
```
Container: agent-code-writer
Skills:
  - Create feature branches
  - Write code based on specs
  - Run tests
  - Create PRs
Prompts: ./agents/code-writer/prompts/
```

#### Agent 3: Web Scraper Agent
```
Container: agent-scraper
Skills:
  - Scrape todo websites
  - Parse structured data
  - Export to markdown/JSON
Prompts: ./agents/scraper/prompts/
```

#### Agent 4: Repo Manager Agent
```
Container: agent-repo-manager
Skills:
  - Git operations
  - Branch management
  - Conflict resolution
Prompts: ./agents/repo-manager/prompts/
```

---

### Phase 4: Orchestration Layer (Week 4-6)
**Goal:** Coordinate multiple agents for complex workflows

**Options to Evaluate:**
1. **LangGraph** - Google's agent framework
2. **CrewAI** - Multi-agent orchestration
3. **AutoGen** - Microsoft's agent framework
4. **Custom** - Build our own orchestrator

**Decision Criteria:**
- Ease of integration with Claude Code
- Docker compatibility
- Message passing support
- Community support

**Recommended:** Start with **CrewAI** (Python-based, good Docker support)

**Implementation:**
```
Container: orchestrator
Purpose: Coordinate agent workflows
Files:
  - ./orchestrator/workflows/ - Workflow definitions
  - ./orchestrator/agents.py - Agent management
  - ./orchestrator/router.py - Task → Agent routing
```

**Example Workflow: PR Review**
```python
# ./orchestrator/workflows/pr_review.py
def pr_review_workflow(repo_url, pr_number):
    tasks = [
        ("agent-repo-manager", "clone", repo_url),
        ("agent-scraper", "fetch_pr", pr_number),
        ("agent-pr-reviewer", "review", diff),
        ("agent-repo-manager", "post_comment", review)
    ]
    return execute_sequence(tasks)
```

---

### Phase 5: Enhanced Bot Interface (Week 6-7)
**Goal:** Smart bot that routes to appropriate agents

**Changes to `./clawdbot/bot/`:**
```javascript
// Intelligent routing
function routeMessage(message) {
    if (message.includes("PR") || message.includes("review")) {
        return "orchestrator:pr_review";
    }
    if (message.includes("todo") || message.includes("sync")) {
        return "agent-scraper:scrape";
    }
    if (message.includes("create") && message.includes("PR")) {
        return "orchestrator:create_pr";
    }
    return "clawdbot:general_chat";
}
```

**New Commands:**
- `/review <repo> <pr>` → Orchestrator workflow
- `/sync-todos <url>` → Scraper agent
- `/create-pr <repo> <task>` → Orchestrator workflow
- Anything else → General chat (clawdbot)

---

### Phase 6: Production Hardening (Week 7-8)
**Tasks:**
- [ ] Add authentication/authorization
- [ ] Rate limiting per user
- [ ] Persistent storage for agent state
- [ ] Monitoring and logging (ELK stack?)
- [ ] Error recovery and retry logic
- [ ] Backup/restore procedures

---

## Directory Structure (Target - Option A)

```
claude-stack/
├── README.md                    # This file
├── docker-compose.yml           # Full stack
├── .env                         # Environment variables
│
├── proxy/                       # ClaudeProxy (existing)
├── clawdbot/                    # Main agent (existing)
│   ├── Dockerfile
│   ├── settings.json
│   ├── prompts/                 # System prompts
│   ├── bot/                     # Telegram bot (existing)
│   │   ├── index.js
│   │   ├── commands/            # Command handlers
│   │   └── Dockerfile
│   └── tasks/                   # Cron jobs
│       └── cron.ini
│
├── agents/                      # NEW: Specialized agents
│   ├── base/
│   │   ├── Dockerfile           # Base image for all agents
│   │   └── agent.py             # Base agent class
│   ├── pr-reviewer/
│   │   ├── Dockerfile
│   │   ├── agent.py
│   │   └── prompts/
│   ├── code-writer/
│   ├── scraper/
│   └── repo-manager/
│
├── orchestrator/                # NEW: Workflow orchestration
│   ├── Dockerfile
│   ├── main.py                  # CrewAI orchestrator
│   ├── workflows/               # Workflow definitions
│   │   ├── pr_review.py
│   │   ├── create_pr.py
│   │   └── sync_todos.py
│   └── agents.py                # Agent registry
│
├── message-broker/              # NEW: RabbitMQ/Redis
│   └── docker-compose.yml
│
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md          # This file
│   ├── API.md                   # Agent API spec
│   ├── WORKFLOWS.md             # Workflow documentation
│   └── TROUBLESHOOTING.md
│
└── scripts/                     # Utility scripts
    ├── deploy.sh
    ├── backup.sh
    └── test-agent.sh
```

---

## Git Strategy

### Repository: `claude-stack`

**Branches:**
- `main` - Current Option B implementation
- `feature/phase2-foundation` - Message broker + base agents
- `feature/phase3-agents` - Specialized agents
- `feature/phase4-orchestration` - CrewAI integration
- `feature/phase5-smart-bot` - Enhanced bot interface

**Commits:**
- Each phase gets tagged (v1.1, v1.2, etc.)
- Feature branches merged to main when complete
- Keep `main` deployable at all times

---

## Current Status

**Version:** 1.0.0
**Phase:** Option B (Enhancement)
**Next Steps:**
1. Make chat-by-default work
2. Commit to git
3. Start Phase 2 planning

**Known Limitations (Current):**
- No real sub-agents
- No workflow orchestration
- Single Claude Code instance does everything
- No parallel task execution
- Bot can't handle long-running tasks well

**Priority Improvements:**
1. Better bot UX (chat by default)
2. Proper error handling
3. Task status tracking
4. File/document upload support
