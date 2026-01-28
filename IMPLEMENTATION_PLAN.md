# Implementation Plan: Metrics & Emoji Reaction System

## Overview

Add comprehensive timing metrics, emoji reactions, and user interaction features to the Telegram bot for better transparency and control.

## Requirements Summary

Based on user feedback:
1. **Metrics Display**: Toggleable verbosity levels (minimal/medium/full) controlled via emoji reactions
2. **Reaction Actions**:
   - 🧠 Retry with smarter model
   - 🤔 Explain reasoning (why this model/skill was chosen)
   - 📊 Show detailed metrics breakdown
   - 👍/👎 Feedback for user prompts (AskUserQuestion-style)
3. **Auto Reactions**: Full status (model emoji + status emoji)

## Architecture Changes

### 1. New File: `clawdbot/bot/metrics-collector.js`

**Purpose**: Centralized timing metrics collection throughout the message flow

**Structure**:
```javascript
class MetricsCollector {
  constructor(messageId) {
    this.messageId = messageId;
    this.timings = {
      receivedAt: null,          // When bot receives message
      fastPathCheck: null,       // After fast path check
      acknowledgmentSent: null,  // When acknowledgment is sent
      orchestratorStart: null,   // Before orchestration
      skillDetection: null,      // After skill detection
      modelSelection: null,      // After model selection
      apiCallStart: null,        // Before API call
      apiCallEnd: null,          // After API response
      responseFormatStart: null, // Before formatting
      responseFormatEnd: null,   // After formatting
      responseSent: null         // When response is sent
    };
    this.flow = {
      skill: null,
      model: null,
      modelExplanation: null,
      agent: null,
      subAgents: [],
      complexityScore: null
    };
  }

  mark(event) { /* Record timestamp */ }
  setFlow(key, value) { /* Set flow metadata */ }
  getBreakdown() { /* Return timing breakdown */ }
  getSummary() { /* Return one-line summary */ }
}
```

### 2. New File: `clawdbot/bot/message-metadata-store.js`

**Purpose**: Store message metadata for reaction handling

**Structure**:
```javascript
class MessageMetadataStore {
  constructor() {
    this.messages = new Map(); // messageId -> metadata
  }

  store(messageId, metadata) {
    this.messages.set(messageId, {
      ...metadata,
      createdAt: Date.now()
    });
  }

  get(messageId) { /* Get metadata */ }
  cleanup(olderThanMs) { /* Remove old entries */ }
}
```

**Metadata stored per message**:
- Original user message
- Skill used
- Model used
- Full metrics breakdown
- User's chatId
- Verbosity level (minimal/medium/full)

### 3. New File: `clawdbot/bot/reaction-handler.js`

**Purpose**: Handle all emoji reaction interactions

**Functions**:
```javascript
async function handleReaction(reaction, metadataStore, bot) {
  const { message_id, user_id, old_reaction, new_reaction } = reaction;

  // Get metadata for this message
  const metadata = metadataStore.get(message_id);
  if (!metadata) return;

  // Handle different reaction types
  const emoji = new_reaction?.[0]?.emoji;

  switch (emoji) {
    case '🔇': // Minimal verbosity
    case '🔉': // Medium verbosity
    case '🔊': // Full verbosity
      await changeVerbosity(message_id, emoji, metadata, bot);
      break;

    case '🧠': // Retry with smart model
      await retryWithSmartModel(metadata, bot);
      break;

    case '🤔': // Explain reasoning
      await explainReasoning(metadata, bot);
      break;

    case '📊': // Full metrics
      await showFullMetrics(metadata, bot);
      break;

    case '👍': // Yes/Confirm
    case '👎': // No/Deny
      await handleUserFeedback(emoji, metadata, bot);
      break;
  }
}
```

### 4. Modify: `clawdbot/bot/index.js`

**Changes**:

1. **Import new modules**:
```javascript
const MetricsCollector = require('./metrics-collector');
const MessageMetadataStore = require('./message-metadata-store');
const { handleReaction, getReactionsForVerbosity, getModelReaction, getStatusReaction } = require('./reaction-handler');
```

2. **Initialize stores**:
```javascript
const metadataStore = new MessageMetadataStore();
setInterval(() => metadataStore.cleanup(3600000), 3600000); // Cleanup every hour
```

3. **Update bot initialization** to include `message_reaction`:
```javascript
const bot = new TelegramBot(TOKEN, {
  polling: true,
  allowed_updates: ['message', 'message_reaction', 'message_reaction_count']
});
```

4. **Add reaction listener**:
```javascript
bot.on('message_reaction', async (reaction) => {
  await handleReaction(reaction, metadataStore, bot);
});
```

5. **Wrap main message handler** with metrics:
```javascript
bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  const message = msg.text;
  if (!message) return;

  // Initialize metrics collector
  const metrics = new MetricsCollector(msg.message_id);
  metrics.mark('receivedAt');

  // FAST PATH: Try instant answer first
  metrics.mark('fastPathCheck');
  const instantResult = fastResponder.tryInstantAnswer(message);

  if (instantResult.answered) {
    console.log(`[Bot] Instant answer: ${instantResult.text.substring(0, 30)}...`);
    const response = await bot.sendMessage(chatId, instantResult.text, { disable_web_page_preview: true })
      .catch(err => console.error(`[Bot] Send error: ${err.message}`));

    // Add status reaction
    if (response) {
      await bot.setMessageReaction(chatId, response.message_id, [
        { type: 'emoji', emoji: '⚡' }
      ]).catch(() => {});
    }
    return;
  }

  // Get acknowledgment
  const acknowledgment = fastResponder.getAcknowledgment(message);
  const ackMsg = await bot.sendMessage(chatId, acknowledgment.text);
  metrics.mark('acknowledgmentSent');

  // Add processing reaction to acknowledgment
  await bot.setMessageReaction(chatId, ackMsg.message_id, [
    { type: 'emoji', emoji: '⏳' }
  ]).catch(() => {});

  // Get or create user session
  const session = getUserSession(chatId);

  // Process in background
  setImmediate(async () => {
    try {
      metrics.mark('orchestratorStart');

      // Use orchestrator to process the message
      const result = await session.sendMessage(message, { metrics });

      metrics.mark('responseFormatStart');
      const responseText = formatOrchestratorResult(result, metrics);
      metrics.mark('responseFormatEnd');

      metrics.mark('responseSent');
      const totalProcessingTime = Date.now() - metrics.timings.receivedAt;

      console.log(`[Bot] User ${chatId}: Skill=${result.skill}, Model=${result.model}, Time=${result.executionTime}ms, Total=${totalProcessingTime}ms`);

      // Send response
      const response = await bot.sendMessage(chatId, responseText.substring(0, 4000), {
        disable_web_page_preview: true
      }).catch(err => console.error(`[Bot] Response send error: ${err.message}`));

      if (response) {
        // Store metadata for reaction handling
        metadataStore.store(response.message_id, {
          chatId,
          originalMessage: message,
          skill: result.skill,
          model: result.model,
          metrics: metrics.getBreakdown(),
          modelExplanation: result.metadata?.modelExplanation,
          complexityScore: result.metadata?.modelExplanation?.complexity,
          verbosity: 'medium' // Default verbosity
        });

        // Add full status reactions
        const statusReactions = getStatusReaction(result.model, true);
        await bot.setMessageReaction(chatId, response.message_id, statusReactions)
          .catch(() => {});

        // Add verbosity control reactions after a short delay
        setTimeout(async () => {
          const verbReactions = getReactionsForVerbosity('medium');
          await bot.setMessageReaction(chatId, response.message_id, verbReactions)
            .catch(() => {});
        }, 500);
      }

    } catch (error) {
      console.error(`[Bot] Error: ${error.message}`);
      console.error(`[Bot] Stack: ${error.stack}`);
      await bot.sendMessage(chatId, `❌ Error: ${error.message}`)
        .catch(err => console.error(`[Bot] Error send failed: ${err.message}`));
    }
  });
});
```

### 5. Modify: `clawdbot/bot/index.js` - `formatOrchestratorResult` function

**New signature**:
```javascript
function formatOrchestratorResult(result, metrics = null, verbosity = 'medium')
```

**New behavior**:
```javascript
function formatOrchestratorResult(result, metrics = null, verbosity = 'medium') {
  let output = '';

  // Add metrics header based on verbosity
  if (verbosity !== 'minimal' && metrics) {
    const breakdown = metrics.getBreakdown();
    const summary = metrics.getSummary();

    if (verbosity === 'full') {
      output += `📊 **Metrics**\n`;
      output += `⚡ Model: ${result.model}\n`;
      output += `🎯 Skill: ${result.skill}\n`;
      output += `⏱️ Total: ${summary.totalTime}ms\n`;
      output += `├─ Skill Detection: ${breakdown.skillDetection}ms\n`;
      output += `├─ Model Selection: ${breakdown.modelSelection}ms\n`;
      output += `├─ API Call: ${breakdown.apiCall}ms\n`;
      output += `└─ Formatting: ${breakdown.formatting}ms\n\n`;
    } else {
      // Medium verbosity
      output += `${getModelEmoji(result.model)} ${result.skill} | ${summary.totalTime}ms\n\n`;
    }
  }

  // Add main result (existing code)
  if (result.result) {
    // ... existing result handling ...
  }

  // Add reaction hint for messages that support it
  if (verbosity === 'full') {
    output += `\n\n💡 *Reactions*: 🔇🔉🔊 verbosity | 🧠 retry smart | 🤔 explain | 📊 metrics | 👍👎 feedback`;
  }

  return output;
}
```

### 6. Modify: `clawdbot/orchestrator/main.js`

**Changes to `orchestrate` function**:

1. **Accept metrics parameter**:
```javascript
async function orchestrate(userMessage, context = {})
```
becomes:
```javascript
async function orchestrate(userMessage, context = {}, metrics = null)
```

2. **Record timing at key points**:
```javascript
// Step 1: Detect which skill to use
const skillDetection = detectSkill(userMessage);
if (metrics) metrics.mark('skillDetection');

// Step 2: Choose model
const modelChoice = chooseModel(userMessage, context);
if (metrics) metrics.mark('modelSelection');

// Store flow info
if (metrics) {
  metrics.setFlow('skill', skillDetection.skill);
  metrics.setFlow('model', modelChoice.name);
  metrics.setFlow('modelExplanation', explainChoice(userMessage, modelChoice.name));
  metrics.setFlow('complexityScore', modelChoice.complexity);
}
```

3. **Pass metrics through API calls**:
```javascript
async function executeClaude(prompt, modelConfig, context = {}, metrics = null) {
  if (metrics) metrics.mark('apiCallStart');
  // ... existing code ...
  if (metrics) metrics.mark('apiCallEnd');
}
```

### 7. New File: `clawdbot/bot/emoji-mappings.js`

**Purpose**: Define emoji constants and mappings

```javascript
module.exports = {
  // Model emojis
  MODEL: {
    FAST: '⚡',     // Haiku
    SMART: '🧠',    // Sonnet
    OPUS: '👑'      // Opus
  },

  // Status emojis
  STATUS: {
    PROCESSING: '⏳',
    SUCCESS: '✅',
    ERROR: '❌',
    THINKING: '🤔'
  },

  // Verbosity emojis
  VERBOSITY: {
    MINIMAL: '🔇',
    MEDIUM: '🔉',
    FULL: '🔊'
  },

  // Action emojis
  ACTION: {
    RETRY_SMART: '🧠',
    EXPLAIN: '🤔',
    METRICS: '📊',
    YES: '👍',
    NO: '👎'
  },

  // Get model emoji from model name
  getModelEmoji(modelName) {
    if (modelName.toLowerCase().includes('haiku') || modelName.toLowerCase().includes('fast')) {
      return this.MODEL.FAST;
    }
    if (modelName.toLowerCase().includes('sonnet') || modelName.toLowerCase().includes('smart')) {
      return this.MODEL.SMART;
    }
    return '🤖';
  },

  // Get status reaction array
  getStatusReaction(modelName, success = true) {
    return [
      { type: 'emoji', emoji: this.getModelEmoji(modelName) },
      { type: 'emoji', emoji: success ? this.STATUS.SUCCESS : this.STATUS.ERROR }
    ];
  },

  // Get verbosity control reactions
  getReactionsForVerbosity(currentVerbosity) {
    const reactions = [];
    if (currentVerbosity !== 'minimal') reactions.push({ type: 'emoji', emoji: this.VERBOSITY.MINIMAL });
    if (currentVerbosity !== 'medium') reactions.push({ type: 'emoji', emoji: this.VERBOSITY.MEDIUM });
    if (currentVerbosity !== 'full') reactions.push({ type: 'emoji', emoji: this.VERBOSITY.FULL });
    return reactions;
  }
};
```

### 8. New File: `clawdbot/bot/user-prompt-handler.js`

**Purpose**: Implement AskUserQuestion-style prompts with emoji voting

**Structure**:
```javascript
class UserPromptHandler {
  constructor(bot, metadataStore) {
    this.bot = bot;
    this.metadataStore = metadataStore;
    this.pendingPrompts = new Map(); // messageId -> { chatId, question, options, callback }
  }

  async promptUser(chatId, question, options) {
    // options: [{ label: 'Yes', emoji: '👍', action: 'yes' }, ...]

    let messageText = `❓ ${question}\n\n`;
    options.forEach((opt, i) => {
      messageText += `${opt.emoji} ${opt.label}\n`;
    });

    const message = await this.bot.sendMessage(chatId, messageText);

    // Store pending prompt
    this.pendingPrompts.set(message.message_id, {
      chatId,
      question,
      options,
      createdAt: Date.now()
    });

    // Set timeout for cleanup
    setTimeout(() => {
      this.pendingPrompts.delete(message.message_id);
    }, 300000); // 5 minutes

    return message.message_id;
  }

  async handleResponse(messageId, emoji) {
    const prompt = this.pendingPrompts.get(messageId);
    if (!prompt) return null;

    const option = prompt.options.find(opt => opt.emoji === emoji);
    if (!option) return null;

    // Clean up
    this.pendingPrompts.delete(messageId);

    return {
      question: prompt.question,
      answer: option.label,
      action: option.action
    };
  }
}
```

## Implementation Steps

1. ✅ **Phase 1: Core Infrastructure**
   - Create `metrics-collector.js`
   - Create `message-metadata-store.js`
   - Create `emoji-mappings.js`

2. ✅ **Phase 2: Reaction System**
   - Create `reaction-handler.js`
   - Add reaction listener to bot
   - Implement status reactions

3. ✅ **Phase 3: Metrics Integration**
   - Modify `orchestrator/main.js` to accept and use metrics
   - Modify `bot/index.js` message handler with metrics
   - Update `formatOrchestratorResult` for verbosity levels

4. ✅ **Phase 4: User Prompts**
   - Create `user-prompt-handler.js`
   - Integrate with orchestrator for user questions

5. ✅ **Phase 5: Action Handlers**
   - Implement retry with smart model
   - Implement explain reasoning
   - Implement show full metrics
   - Implement verbosity toggling

## Testing Checklist

- [ ] Minimal verbosity shows only essential info
- [ ] Medium verbosity shows model + skill + time
- [ ] Full verbosity shows detailed breakdown
- [ ] 🔇🔉🔊 emojis toggle verbosity
- [ ] 🧠 retries message with smart model
- [ ] 🤔 explains model/skill choice
- [ ] 📊 shows detailed metrics
- [ ] Auto-reactions show model + status
- [ ] All timing metrics are accurate
- [ ] Metadata cleanup works correctly
- [ ] User prompts work with 👍/👎

## Files to Create

1. `clawdbot/bot/metrics-collector.js` - Timing metrics collection
2. `clawdbot/bot/message-metadata-store.js` - Message metadata storage
3. `clawdbot/bot/reaction-handler.js` - Reaction event handling
4. `clawdbot/bot/emoji-mappings.js` - Emoji constants and helpers
5. `clawdbot/bot/user-prompt-handler.js` - User prompt system

## Files to Modify

1. `clawdbot/bot/index.js` - Main bot handler
2. `clawdbot/orchestrator/main.js` - Orchestrator to support metrics
3. `clawdbot/storage/session-store.js` - Optionally store metrics in session

## Notes

- Bot must be admin in chat for reactions to work
- `setMessageReaction` may need a small delay for reliability
- Old metadata should be cleaned up periodically (1 hour)
- Reaction handler should be idempotent (handle duplicate events)
- Verbosity setting could be persisted per-user in session store
