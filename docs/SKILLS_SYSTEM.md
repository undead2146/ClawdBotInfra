# Skills System - Complete Documentation

**For AI Agents and Developers**

This document explains the entire Skills & Orchestrator system so that AI agents can understand, extend, and autonomously create new skills.

---

## System Architecture

```
User Message
    ↓
[Telegram Bot]
    ↓
[Orchestrator] ← Intelligently routes to skills
    ↓
[Model Picker] ← Chooses fast/smart model
    ↓
[Skill Router] ← Detects which skill to use
    ↓
[Skill Handler] ← Executes specialized logic
    ↓
[Claude Code CLI] ← Main AI engine
    ↓
[Response]
```

---

## Component Breakdown

### 1. Orchestrator (`clawdbot/orchestrator/main.js`)

**Purpose:** Central brain that coordinates everything

**Key Function:** `orchestrate(userMessage, context)`

**Workflow:**
1. Detects which skill to use
2. Chooses appropriate model (fast/smart)
3. Builds specialized prompt
4. Executes skill or falls back to Claude
5. Returns result with metadata

**Example Usage:**
```javascript
const { orchestrate } = require('./orchestrator/main.js');

const result = await orchestrate("Search for Python news", {});
// Returns: { skill: 'web-search', model: 'Haiku (Fast)', result: {...} }
```

---

### 2. Skill Router (`clawdbot/orchestrator/skill-router.js`)

**Purpose:** Detects which skill should handle a request

**Function:** `detectSkill(message)`

**How It Works:**
- Scores each skill based on keyword matches
- Returns skill with highest score
- Falls back to 'general' if no skill matches

**Skill Configuration Format:**
```javascript
skills['skill-id'] = {
  name: 'Human Readable Name',
  description: 'What this skill does',
  keywords: ['keyword1', 'keyword2', 'keyword3'],
  models: ['fast'], // or ['smart'] or ['fast', 'smart']
  timeout: 30000,    // max execution time (ms)
  handler: './skills/skill-file.js'
}
```

---

### 3. Model Picker (`clawdbot/orchestrator/model-picker.js`)

**Purpose:** Automatically chooses between fast and smart models

**Function:** `chooseModel(message, context)`

**Decision Logic:**
- Analyzes task complexity (score 0-10+)
- Simple tasks → Fast model (Haiku/GLM-4.7)
- Complex tasks → Smart model (Sonnet/GLM-4.7)

**Complexity Indicators:**
- `analyze`, `review`, `implement` → +2 points
- `code`, `PR`, `refactor` → +2 points
- `architecture`, `design` → +3 points
- Long messages (>200 chars) → +1 point
- Deep conversation (3+ turns) → +1 point

**Threshold:** Score >= 3 → Smart model

---

## Creating New Skills

### Step 1: Define the Skill

Add to `clawdbot/orchestrator/skill-router.js`:

```javascript
'your-skill': {
  name: 'Your Skill Name',
  description: 'What it does',
  keywords: ['trigger1', 'trigger2', 'trigger3'],
  models: ['fast', 'smart'],
  timeout: 60000,
  handler: './skills/your-skill.js'
}
```

### Step 2: Implement the Skill

Create `clawdbot/skills/your-skill.js`:

```javascript
/**
 * Your Skill Description
 */

async function yourMainFunction(input, context = {}) {
  try {
    // Your skill logic here
    const result = await doSomething(input);

    return {
      success: true,
      result: result,
      metadata: {
        processingTime: Date.now()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Export functions
module.exports = {
  yourMainFunction,
  // optional: otherHelperFunction
};
```

### Step 3: Add Execution Logic

In `orchestrator/main.js`, add to `executeSkill()`:

```javascript
case 'your-skill':
  const input = extractInput(userMessage);
  skillResult = await skillHandler.yourMainFunction(input);
  break;
```

---

## Existing Skills Reference

### Web Search (`web-search.js`)
**Purpose:** Search the web for information
**Input:** Query string
**Output:** Search results with sources
**Usage:** "Search for X" or "Find information about Y"

### Code Execution (`code-exec.js`)
**Purpose:** Execute code in Docker sandbox
**Input:** Code block, language, stdin
**Output:** Execution results, errors
**Features:**
- Auto-detects language
- Creates isolated container
- 512MB memory limit
- 30 second timeout
**Languages:** Python, JavaScript, Bash, Java, Go, Rust

### Docker Manager (`docker-mgr.js`)
**Purpose:** Create and manage Docker containers
**Input:** Container config, code, dependencies
**Output:** Container status, logs
**Features:**
- Generates Dockerfiles
- Builds images
- Runs containers
- Manages lifecycle

---

## Session Management

**ChatSession** class handles multi-turn conversations:

```javascript
const { createSession } = require('./orchestrator/main.js');

const session = createSession(userId);
const result = await session.sendMessage("Hello");
const result2 = await session.sendMessage("What did you just say?");
// Session remembers context
```

**Session Features:**
- Maintains conversation history
- Tracks turn count
- Preserves context across messages
- Can be cleared with `/clear`

---

## Model Configurations

**Fast Model (Haiku):**
```javascript
{
  model: 'claude-haiku-4-20250514',
  provider: 'glm',
  glmModel: 'glm-4.7',
  maxTokens: 4000,
  temperature: 0.7,
  useCase: 'Simple questions, quick responses'
}
```

**Smart Model (Sonnet):**
```javascript
{
  model: 'claude-sonnet-4-20250514',
  provider: 'glm',
  glmModel: 'glm-4.7',
  maxTokens: 8000,
  temperature: 0.5,
  useCase: 'Complex tasks, code analysis'
}
```

---

## Error Handling

**Skill Execution Errors:**
1. Try skill handler
2. If fails, fall back to Claude with specialized prompt
3. If that fails, return error message

**Timeout Handling:**
- Each skill has configurable timeout
- Docker exec has 120s timeout
- Long-running tasks should use background mode

---

## Testing Skills

### Manual Testing via Telegram:
```
/send your message
```

### Programmatic Testing:
```javascript
const { orchestrate } = require('./orchestrator/main.js');

const result = await orchestrate("your test message", {});
console.log(result);
```

### Docker Exec Testing:
```bash
docker exec clawdbot-telegram node -e "
const { orchestrate } = require('./orchestrator/main.js');
orchestrate('test message', {}).then(console.log);
"
```

---

## Performance Optimization

**Fast Path:**
- Simple chat → Fast model → Direct Claude execution
- No skill overhead

**Smart Path:**
- Complex tasks → Smart model → Specialized skill handler
- More processing time, better results

**Caching (Future):**
- Cache skill detection results
- Cache model choice decisions
- Cache common responses

---

## Integration Points

**With Proxy:**
- All requests go through `claude-proxy` on port 8082
- Proxy routes to GLM API
- Dashboard: http://<IP>:8082/dashboard

**With Docker:**
- Skills can spawn containers
- Code execution uses Docker sandbox
- Docker manager creates/containers

**With Git:**
- Can clone repositories
- Can create PRs
- Can manage branches

---

## Future Extensions

**Planned Additions:**
1. Async task queue for long-running operations
2. Skill composition (chaining skills)
3. Parallel skill execution
4. Skill result caching
5. A/B testing for models
6. Custom skill prompts per user
7. Skill marketplace

**Meta-Skills:**
- Skill Creator (autonomous skill generation)
- Skill Optimizer (improves existing skills)
- Skill Tester (validates skill functionality)

---

## Troubleshooting

**Skill Not Triggering:**
- Check keywords in `skill-router.js`
- Verify skill is registered
- Check bot logs: `docker logs clawdbot-telegram`

**Model Always Using Fast:**
- Check complexity scoring
- Adjust threshold in `model-picker.js`
- Verify task keywords

**Docker Errors in Skills:**
- Check Docker socket mount
- Verify Docker is accessible from container
- Check resource limits

---

## File Reference

```
clawdbot/
├── orchestrator/
│   ├── main.js           # Orchestration engine
│   ├── skill-router.js   # Intent detection & skill registry
│   └── model-picker.js   # Model selection logic
├── skills/
│   ├── web-search.js     # Web search implementation
│   ├── code-exec.js      # Code execution in Docker
│   ├── docker-mgr.js     # Docker container management
│   └── [future skills]
└── bot/
    └── index.js          # Telegram bot with orchestrator
```

---

## For AI Agents: How to Extend This System

### Adding a New Skill:

1. **Understand the pattern:** All skills follow the same structure
2. **Register the skill:** Add to `skills` object in `skill-router.js`
3. **Implement the handler:** Create file in `skills/` directory
4. **Wire it up:** Add case in `executeSkill()` in `main.js`
5. **Test:** Use orchestrator directly or via Telegram

### Creating Meta-Skills:

Meta-skills are skills that manipulate other skills:

```javascript
// Example: Skill that analyzes skill performance
'skill-analyzer': {
  name: 'Skill Performance Analyzer',
  description: 'Analyzes which skills perform best',
  keywords: ['analyze skills', 'skill performance', 'skill stats'],
  models: ['smart'],
  timeout: 30000,
  handler: './skills/skill-analyzer.js'
}
```

This meta-skill could:
- Track execution times
- Measure success rates
- Suggest optimizations
- Auto-tune thresholds

### Autonomous Skill Creation:

The "Skill Creator" skill (to be implemented) would:

1. Accept natural language description of desired skill
2. Generate skill configuration
3. Implement skill handler code
4. Register in skill-router.js
5. Write tests
6. Deploy (reload orchestrator)

See `docs/AUTONOMOUS_SKILL_CREATION.md` for details.

---

## Maintenance

**Regular Tasks:**
- Monitor skill performance
- Update keywords based on usage
- Tune model selection thresholds
- Add new skills based on demand
- Optimize slow skills

**Health Checks:**
- `docker logs clawdbot-telegram` - Bot logs
- `docker logs clawdbot` - Claude logs
- `/status` command - Container status

**Backup Strategy:**
- Git commits track all code
- Docker volumes persist workspace
- Use `scripts/backup.sh` for full backups
