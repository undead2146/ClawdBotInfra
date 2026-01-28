# Changelog

All notable changes to the Claude Stack project will be documented in this file.

## [2.0.0] - 2026-01-28

### Added
- **Metrics Collection System** (`clawdbot/bot/metrics-collector.js`)
  - Real-time response time tracking
  - Detailed timing breakdown for each stage (skill detection, model selection, API call, formatting)
  - Flow metadata tracking (skill, model, complexity, sub-agents)

- **Session Persistence** (`clawdbot/storage/session-store.js`)
  - Conversation history saved to `/tmp/clawdbot-sessions.json`
  - Context maintained across bot restarts
  - Automatic session cleanup (1 hour retention)
  - Proper initialization before polling starts

- **Enhanced Bot Context** (`clawdbot/orchestrator/main.js`)
  - AI now knows it's Clawdbot v4.0
  - Understands its 9 skills and capabilities
  - Knows available models (Haiku/Sonnet)
  - Provides accurate answers about architecture

- **Metrics Display** (`clawdbot/bot/index.js`)
  - Model indicator (⚡ Haiku / 🧠 Sonnet)
  - Skill detection display
  - Total response time in milliseconds
  - Clean formatting without markdown

### Changed
- **Bot Initialization** - Sessions now load BEFORE polling starts
- **Conversation History** - Fixed to extract text content properly (was sending objects before)
- **API Format** - Fixed history serialization for API compatibility

### Fixed
- **API 422 Errors** - Conversation history was storing result objects instead of text
- **Session Race Condition** - Bot was processing messages before sessions loaded
- **Missing Context** - AI had no knowledge of its capabilities

### Files Added
```
clawdbot/bot/metrics-collector.js
clawdbot/bot/emoji-mappings.js
clawdbot/bot/message-metadata-store.js
clawdbot/bot/reaction-handler.js
clawdbot/bot/user-prompt-handler.js
```

### Files Modified
```
clawdbot/bot/index.js - Enhanced with metrics, session loading, and proper initialization
clawdbot/orchestrator/main.js - Added context injection and history text extraction
clawdbot/storage/session-store.js - Fixed path to use /tmp for writability
```

## [1.1.0] - Previous
- Chat-by-default Telegram bot
- Basic skill detection
- Model selection (Haiku/Sonnet)
- Fast responder for instant answers

## [1.0.0] - Initial Release
- Claude proxy with dashboard
- Clawdbot Claude Code agent
- Docker orchestration
- Basic Telegram integration
