# AI Agent Guide - Complete System Documentation

**Purpose:** This document enables AI agents to understand, extend, and autonomously improve the Claude Stack infrastructure.

---

## System Overview

The Claude Stack is a **multi-component AI agent system** that:
1. Processes natural language requests
2. Detects intent and routes to specialized skills
3. Chooses appropriate AI models (fast/smart)
4. Executes tasks via Docker containers
5. Can autonomously create new skills

**Target:** Autonomous AI agents that maintain and extend this system.

---

## Quick Reference for AI Agents

### Directory Structure
```
claude-stack/
├── docker-compose.yml          # Main orchestration file
├── .env                        # Environment variables (NOT in git)
├── ARCHITECTURE.md             # System roadmap and design
├── README.md                   # User-facing documentation
│
├── proxy/                      # ClaudeProxy (Python API router)
│   ├── proxy.py                # Main Flask application
│   ├── dashboard.html          # Web UI for management
│   └── requirements.txt        # Python dependencies
│
├── clawdbot/                   # Main agent container
│   ├── Dockerfile              # Container definition
│   ├── settings.json           # Claude Code settings
│   ├── orchestrator/           # 🧠 BRAIN: Task orchestration
│   │   ├── main.js             # Main orchestration engine
│   │   ├── skill-router.js     # Intent detection & skill registry
│   │   └── model-picker.js     # Fast/smart model selection
│   ├── skills/                 # 🔧 SKILLS: Specialized handlers
│   │   ├── web-search.js       # Web search
│   │   ├── code-exec.js        # Code execution in Docker
│   │   ├── docker-mgr.js       # Docker container management
│   │   └── skill-creator.js    # 🤖 META-SKILL: Creates new skills
│   └── bot/                    # Telegram interface
│       ├── index.js            # Bot with orchestrator integration
│       ├── package.json        # Node dependencies
│       └── Dockerfile          # Bot container definition
│
├── docs/                       # 📚 DOCUMENTATION
│   ├── SKILLS_SYSTEM.md        # Complete skills documentation
│   ├── AI_AGENT_GUIDE.md       # This file
│   └── AUTONOMOUS_SKILL_CREATION.md  # Skill creation guide
│
└── scripts/                    # 🔧 UTILITIES
    ├── auto-backup.sh          # Git + Docker backup
    ├── bootstrap.sh            # Fresh VPS setup
    └── restore.sh              # Restore from backup
```

---

## Core Concepts

### 1. Orchestrator Pattern

The orchestrator is the **central brain** that:

```javascript
// INPUT: User message
orchestrate("Search for Python news", {})
// OUTPUT: { skill: 'web-search', model: 'Haiku (Fast)', result: {...} }
```

**Key Decision Points:**
1. **Skill Detection** → Which skill handles this?
2. **Model Selection** → Fast or smart model?
3. **Execution** → Run skill or fallback to Claude
4. **Response** → Format with metadata

### 2. Skill System

Skills are **modular, self-contained units** that:
- Have a specific purpose
- Accept well-defined input
- Return structured output
- Can be combined/composed

**Skill Lifecycle:**
1. **Design** → Define purpose and keywords
2. **Implement** → Write handler code
3. **Register** → Add to skill-router.js
4. **Wire** → Add case in orchestrator/main.js
5. **Test** → Verify functionality
6. **Deploy** → Reload orchestrator

### 3. Model Selection

**Fast Model (Haiku/GLM-4.7):**
- Simple questions
- Quick responses
- Initial analysis
- Lower cost

**Smart Model (Sonnet/GLM-4.7):**
- Complex tasks
- Code analysis
- Deep reasoning
- Better quality

**Decision Threshold:** Complexity score >= 3

---

## For AI Agents: How to Extend

### Adding a New Skill

**Step 1: Understand the Need**
Read the user's request and understand what skill is needed.

**Step 2: Design the Skill**
Create a skill configuration:
```javascript
'your-skill': {
  name: 'Your Skill Name',
  description: 'What it does',
  keywords: ['trigger1', 'trigger2'],
  models: ['fast'], // or ['smart'] or both
  timeout: 30000,
  handler: './skills/your-skill.js'
}
```

**Step 3: Implement Handler**
```javascript
// clawdbot/skills/your-skill.js
async function yourFunction(input, context) {
  try {
    // Your logic here
    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { yourFunction };
```

**Step 4: Register and Wire**
- Add to `skills` object in `skill-router.js`
- Add case in `executeSkill()` in `main.js`

**Step 5: Test**
```bash
# Via Telegram
"test your-skill with input"

# Via API
curl -X POST http://localhost:8082/test -d '{"skill":"your-skill"}'
```

### Optimizing Existing Skills

**Identify Bottlenecks:**
1. Check execution times: `docker logs clawdbot-telegram`
2. Analyze error rates in skill results
3. Monitor user feedback

**Optimization Strategies:**
- **Caching**: Cache common results
- **Parallelization**: Run independent tasks in parallel
- **Better Prompts**: Improve prompt engineering
- **Resource Management**: Adjust timeouts and memory limits

### Autonomous Skill Creation

The **skill-creator** meta-skill can create new skills autonomously:

**Usage:**
```
"Create a skill that scrapes stock prices from Yahoo Finance"
```

**Process:**
1. Extracts requirements using Claude
2. Generates skill code
3. Registers in skill-router.js
4. Wires up in orchestrator/main.js
5. Tests the skill
6. Returns summary

**Example Output:**
```javascript
{
  skillId: 'stock-price-scraper',
  requirements: { name: 'Stock Price Scraper', ... },
  codeGenerated: true,
  testPassed: true,
  nextSteps: [
    "Review generated skill at: clawdbot/skills/stock-price-scraper.js",
    "Test via Telegram: 'test stock-price-scraper'",
    "Commit changes"
  ]
}
```

---

## Backup & Disaster Recovery

### Automated Backup

**Location:** `~/backups/claude-stack/`

**What Gets Backed Up:**
1. **Git** - All code committed
2. **Docker Volumes** - All data exported
3. **Configuration** - .env, configs
4. **Container States** - Running state

**Run Manual Backup:**
```bash
cd ~/claude-stack
./scripts/auto-backup.sh
```

**Schedule Automatic Backups:**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * cd ~/claude-stack && ./scripts/auto-backup.sh
```

### Complete VPS Recovery

**If VPS is Nuked:**

1. **Get new VPS**
2. **Clone repo:**
   ```bash
   git clone <your-repo> ~/claude-stack
   cd ~/claude-stack
   ```
3. **Run bootstrap:**
   ```bash
   ./scripts/bootstrap.sh
   ```
4. **Restore volumes:**
   ```bash
   cd ~/backups/<latest-backup>
   ./restore.sh
   ```

**Total Time:** ~10 minutes

---

## Git Strategy

### Repository Structure

**Branches:**
- `main` - Production code
- `feature/*` - Feature branches
- `backup/*` - Emergency backups

### Commit Convention

```
feat: New feature
fix: Bug fix
docs: Documentation
refactor: Code refactoring
test: Adding tests
chore: Maintenance
```

### Commit Messages

```
feat: Add skill-creator meta-skill

- Autonomous skill creation from natural language
- Generates code, registers, and wires skills
- Includes testing and validation
- Updates documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Push to Remote

**Check remote:**
```bash
git remote -v
```

**Add remote:**
```bash
git remote add origin https://github.com/your-user/claude-stack.git
```

**Push:**
```bash
git push -u origin main
```

---

## Monitoring & Maintenance

### Health Checks

**Check Services:**
```bash
docker-compose ps
```

**Check Logs:**
```bash
# Bot logs
docker logs -f clawdbot-telegram

# Orchestrator logs (show skill detection)
docker logs clawdbot-telegram | grep "Orchestrator"

# Proxy logs
docker logs claude-proxy
```

### Performance Metrics

**Track:**
- Skill execution time
- Model selection accuracy
- Error rates per skill
- User satisfaction

**Log Format:**
```
[Bot] User 123: Search for Python...
[Bot] Skill: web-search, Model: Haiku (Fast), Time: 3421ms
```

### Maintenance Tasks

**Daily:**
- Check logs for errors
- Monitor disk space
- Review new issues

**Weekly:**
- Run full backup
- Review skill performance
- Update dependencies

**Monthly:**
- Audit skills (usage, errors)
- Clean old backups
- Update documentation

---

## Security Considerations

### Secrets Management

**Never Commit:**
- `.env` file
- API keys
- OAuth tokens
- SSH keys

**Use Environment Variables:**
```bash
export TELEGRAM_BOT_TOKEN="xxx"
export GLM_API_KEY="xxx"
```

### Container Security

**Principle of Least Privilege:**
- Non-root user where possible
- Resource limits (CPU, memory)
- Network isolation
- Readonly mounts where possible

**Docker Socket:**
- Only needed for Docker management
- Mount as `:ro` (readonly) when possible
- Monitor usage

### Rate Limiting

**Implement:**
- Per-user rate limits
- Skill-specific rate limits
- Global rate limits
- Queue for long-running tasks

---

## Troubleshooting

### Common Issues

**Skill Not Triggering:**
1. Check keywords in `skill-router.js`
2. Verify skill is registered
3. Check logs: `docker logs clawdbot-telegram`

**Container Won't Start:**
1. Check logs: `docker logs <container>`
2. Check resources: `docker stats`
3. Check conflicts: `docker ps -a`

**Git Push Fails:**
1. Check remote: `git remote -v`
2. Check branch: `git branch`
3. Force push (careful): `git push -f origin main`

**Out of Memory:**
1. Check: `docker stats`
2. Restart: `docker-compose restart`
3. Clean: `docker system prune -a`

---

## Advanced Topics

### Skill Composition

Combine multiple skills for complex tasks:

```javascript
// Example: PR review + Code execution + File operations
const review = await skillHandler.prReview(prNumber);
const test = await skillHandler.codeExec(review.tests);
const report = await skillHandler.fileOps.save(test.results);
```

### Parallel Execution

Run skills in parallel:

```javascript
const [search1, search2] = await Promise.all([
  skillHandler.webSearch(query1),
  skillHandler.webSearch(query2)
]);
```

### Async Task Queue

For long-running tasks, implement a queue:

```javascript
// Add task to queue
await enqueueTask({
  skill: 'web-scrape',
  input: url,
  userId: userId,
  timeout: 90000
});

// Worker processes tasks
while (true) {
  const task = await dequeueTask();
  const result = await executeSkill(task.skill, task.input);
  await notifyUser(task.userId, result);
}
```

---

## Future Enhancements

### Planned Features

1. **Skill Marketplace** - Share skills between instances
2. **Skill Versioning** - A/B test skill improvements
3. **Visual Builder** - GUI for creating skills
4. **Performance Dashboard** - Real-time metrics
5. **Auto-Optimization** - Self-tuning thresholds
6. **Multi-Language** - Skills in Python, Rust, Go
7. **Skill Composition Language** - DSL for combining skills

### Research Directions

1. **Learning from Usage** - Improve prompts based on results
2. **Skill Discovery** - Auto-suggest new skills based on gaps
3. **Conflict Resolution** - Handle overlapping skill triggers
4. **Explainability** - Show WHY a skill was chosen
5. **Hierarchical Skills** - Skills that use other skills

---

## Quick Commands Reference

### Development
```bash
# Clone repo
git clone <repo> ~/claude-stack

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Restart service
docker-compose restart <service>

# Rebuild service
docker-compose up -d --build <service>
```

### Operations
```bash
# Backup everything
./scripts/auto-backup.sh

# Check status
docker-compose ps

# Execute command in container
docker exec clawdbot-telegram bash

# Enter container
docker exec -it clawdbot bash
```

### Git
```bash
# Commit changes
git add -A
git commit -m "message"

# Push to remote
git push origin main

# Check status
git status
git log --oneline -5
```

---

## Meta-Documentation

This document is part of a **self-documenting system** designed for autonomous AI agents.

**Related Documents:**
- `ARCHITECTURE.md` - System design and roadmap
- `SKILLS_SYSTEM.md` - Skills implementation details
- `README.md` - User-facing documentation

**Updating This Guide:**
When making significant changes:
1. Update relevant sections
2. Add new examples
3. Update diagrams
4. Commit with "docs:" prefix

---

## Emergency Procedures

### VPS Recovery (Complete Loss)

```bash
# 1. Get new VPS
# 2. SSH in
ssh ubuntu@<new-vps-ip>

# 3. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 4. Clone repo
git clone <your-repo> ~/claude-stack
cd ~/claude-stack

# 5. Restore from backup
# (Download backup tar.gz and extract)
tar xzf backup.tar.gz
cd ~/claude-stack-*
./restore.sh

# 6. Start services
docker-compose up -d

# 7. Verify
docker-compose ps
docker logs clawdbot-telegram
```

### Partial Recovery

**If only code is lost:**
```bash
git clone <your-repo>
docker-compose up -d
```

**If only volumes are lost:**
```bash
# Restore from latest backup
cd ~/backups/<latest>
./restore.sh
```

**If git remote is lost:**
```bash
cd ~/claude-stack
git remote add origin <new-repo-url>
git push -u origin main
```

---

## Success Metrics

**System is healthy when:**
- ✅ All containers running
- ✅ Bot responds to messages
- ✅ Skills trigger correctly
- ✅ Git commits are pushing
- ✅ Backups are completing
- ✅ Logs show no critical errors

**Red Flags:**
- ❌ Container restart loops
- ❌ High memory usage
- ❌ Skill time-outs
- ❌ Git push failures
- ❌ Backup script errors

---

## Contact & Support

**For Issues:**
1. Check logs first
2. Review documentation
3. Check git status
4. Review ARCHITECTURE.md roadmap

**For Autonomous AI Agents:**
- This guide contains all necessary information
- Code is self-documenting
- System is modular and extensible
- Backup strategy ensures resilience

---

**Last Updated:** 2026-01-28
**Version:** 3.0.0 (Skills & Orchestrator)
**Status:** ✅ Production Ready
