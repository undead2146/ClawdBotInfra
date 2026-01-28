require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot Token
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y';

// Create bot with reaction support (polling starts later after init)
const bot = new TelegramBot(TOKEN, {
  polling: false,
  allowed_updates: ['message', 'message_reaction', 'message_reaction_count']
});

// Import orchestrator
const { orchestrate, createSession } = require('./orchestrator/main.js');

// Import session store
const sessionStore = require('./storage/session-store');

// Import fast responder
const fastResponder = require('./storage/fast-responder');

// Import metrics and reaction modules
const MetricsCollector = require('./metrics-collector');
const { getInstance: getMetadataStore } = require('./message-metadata-store');
const { handleReaction, formatResponseWithVerbosity } = require('./reaction-handler');
const { getModelEmoji, getStatusReaction, getReactionsForVerbosity, EMOJI } = require('./emoji-mappings');

// Initialize metadata store
const metadataStore = getMetadataStore();

// Start metadata cleanup every hour
setInterval(() => metadataStore.cleanup(3600000), 3600000);

// Store user sessions (with orchestrator)
const userSessions = new Map();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Helper: Format long messages
function formatMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper: Get or create user session
function getUserSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, createSession(userId));
  }
  return userSessions.get(userId);
}

// Helper: Update status message with progress indicators
async function updateStatus(bot, chatId, messageId, status, emoji = '🤖') {
  const statusMessages = {
    'thinking': '🤖 Thinking...',
    'analyzing': '🔍 Analyzing your request...',
    'processing': '⚙️ Processing...',
    'generating': '✨ Generating response...',
    'error': '❌ Error occurred',
    'done': '✅ Done'
  };

  const text = statusMessages[status] || `${emoji} ${status}`;

  try {
    await bot.editMessageText(chatId, messageId, { text });
  } catch (error) {
    // Ignore edit errors (message might be too old)
    console.debug(`[Bot] Status update failed: ${error.message}`);
  }
}

// Helper: Format orchestrator result for Telegram with verbosity support
function formatOrchestratorResult(result, metrics = null, verbosity = 'medium') {
  let output = '';

  // Add metrics header based on verbosity (always show if model available)
  if (result.model) {
    const modelEmoji = getModelEmoji(result.model);
    const breakdown = metrics?.getBreakdown();

    if (verbosity === 'full' && breakdown) {
      output += `📊 Request Metrics\n`;
      output += `${modelEmoji} Model: ${result.model}\n`;
      output += `🎯 Skill: ${result.skill}\n`;
      output += `⏱️ Total: ${breakdown.total}ms\n\n`;

      output += `⏱️ Timing Breakdown\n`;
      if (breakdown.skillDetection) output += `• Skill detection: ${breakdown.skillDetection}ms\n`;
      if (breakdown.modelSelection) output += `• Model selection: ${breakdown.modelSelection}ms\n`;
      if (breakdown.apiCall) output += `• API call: ${breakdown.apiCall}ms\n`;
      if (breakdown.formatting) output += `• Response formatting: ${breakdown.formatting}ms\n`;
      if (breakdown.orchestrator) output += `• Orchestrator: ${breakdown.orchestrator}ms\n`;
      output += '\n';
    } else {
      // Medium and minimal verbosity - show one-line header
      const totalTime = breakdown?.total || result.executionTime || 'N/A';
      output += `${modelEmoji} ${result.model}`;
      if (result.skill) output += ` | ${result.skill}`;
      output += ` | ${totalTime}ms\n\n`;
    }
  }

  // Add main result
  if (result.result) {
    const { output: resultOutput, method, result: skillResult, error: resultError } = result.result;

    // Handle error in result
    if (resultError) {
      output += `❌ Error: ${resultError}`;
    }
    // Handle skill results with nested results property
    else if (skillResult && skillResult.results) {
      output += skillResult.results;
    }
    // Handle direct output from Claude API
    else if (resultOutput) {
      output += resultOutput;
    }
    // Handle skill result as string
    else if (typeof skillResult === 'string') {
      output += skillResult;
    }
    // Handle nested skill result with output property
    else if (skillResult && skillResult.output) {
      output += skillResult.output;
    }
    // Fallback: stringify the result object
    else if (skillResult) {
      output += JSON.stringify(skillResult, null, 2);
    }
    // No content available
    else {
      output += '⚠️ No response content received from the AI service. The service may be unavailable or returned an empty response.';
    }
  }

  // Handle error at top level
  if (result.error && !result.result) {
    if (output) output += '\n\n';
    output += `❌ Error: ${result.error}`;
  }

  // If still empty after all processing
  if (!output || output.trim() === '') {
    output = '⚠️ Empty response received. Please try again or rephrase your question.';
  }

  // Clean up problematic characters for Telegram
  output = output
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
    .replace(/\*\*/g, '')  // Remove bold markers that can break
    .replace(/__([^_]+)__/g, '$1');  // Fix underlines

  return output;
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🤖 *Welcome to Clawdbot v2.0!*

Your AI-powered development assistant with **Skills & Orchestration**.

*Smart Features:*
• 🎯 Auto-detects task type (PR review, web search, code exec, etc.)
• 🧠 Chooses fast vs smart model automatically
• 🔧 Specialized skills for complex tasks
• 💬 Natural chat - just type!

*Skills Available:*
• 🔍 Web Search
• 📝 PR Review
• 💻 Code Execution (Docker sandbox)
• 🐳 Docker Management
• 📄 File Operations
• 🗂️ Organization
• 🗣️ Text-to-Speech
• 🌐 Web Scraping

*Quick Start:*
Just type naturally! The bot will figure out what you need.

Examples:
• "Search for latest React updates"
• "Review PR #123 in facebook/react"
• "Run this code: \`print('hello')\`"
• "Create a Docker container for Python"
• "Organize my tasks"

*Commands:*
/status - System status
/skills - List all skills
/clear - Clear chat history
/help - Show this message
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📚 *Clawdbot v2.0 Help*

*How It Works:*
1. You send a message
2. Bot detects what you need (skill detection)
3. Chooses right model (fast/smart)
4. Routes to specialized skill if needed
5. Returns results

*Skills:*
/web-search - Search the web
/pr-review - Review pull requests
/code-exec - Execute code in Docker
/docker-mgr - Manage containers
/file-ops - Download/upload files
/organize - Organize information
/tts - Text to speech
/web-scrape - Scrape websites

*Model Selection:*
Fast (Haiku) → Simple questions, quick answers
Smart (Sonnet) → Complex tasks, analysis

*Tips:*
• Be natural - no need for commands
• Attach code files for analysis
• Use code blocks for execution
  `, { parse_mode: 'Markdown' });
});

// Command: /skills
bot.onText(/\/skills/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
🎯 *Available Skills*

1. **Web Search** 🔍
   Keywords: search, find, look up, google
   Example: "Search for Python 3.12 features"

2. **PR Review** 📝
   Keywords: PR, pull request, review
   Example: "Review PR #42 in user/repo"

3. **Code Execution** 💻
   Keywords: run, execute, test code
   Example: "Run this code: \`print('hello')\`"

4. **Docker Manager** 🐳
   Keywords: docker, container, deploy
   Example: "Create a container for Node.js app"

5. **File Operations** 📄
   Keywords: download, upload, save file
   Example: "Download this URL"

6. **Organizer** 🗂️
   Keywords: organize, sort, categorize
   Example: "Organize these tasks by priority"

7. **Text-to-Speech** 🗣️
   Keywords: speak, say, voice
   Example: "Say this message aloud"

8. **Web Scraper** 🌐
   Keywords: scrape, extract, crawl
   Example: "Scrape product data from URL"
  `, { parse_mode: 'Markdown' });
});

// Command: /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const { execSync } = require('child_process');
    const containers = execSync('docker ps --filter "name=clawdbot" --format "table {{.Names}}\t{{.Status}}"', {
      encoding: 'utf8'
    });

    const statusMessage = `
📊 *Clawdbot Status*

${containers}

✅ All systems operational
    `;

    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// Command: /clear
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  const session = getUserSession(chatId);
  session.clearHistory();
  sessionStore.deleteSession(chatId);
  await sessionStore.saveSessions();
  bot.sendMessage(chatId, '🗑️ Chat history cleared');
});

// ============================================================
// REACTION HANDLER
// ============================================================

bot.on('message_reaction', async (reaction) => {
  await handleReaction(reaction, metadataStore, bot);
});

// ============================================================
// MAIN MESSAGE HANDLER (With Orchestrator & Metrics)
// ============================================================

bot.on('message', async (msg) => {
  // Skip commands
  if (msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  const message = msg.text;

  if (!message) return;

  console.log(`[Bot] User ${chatId}: ${message}`);

  // Initialize metrics collector
  const metrics = new MetricsCollector(msg.message_id, message);

  // FAST PATH: Try instant answer first
  metrics.mark('fastPathCheck');
  const instantResult = fastResponder.tryInstantAnswer(message);

  if (instantResult.answered) {
    // Send instant answer immediately
    console.log(`[Bot] Instant answer: ${instantResult.text.substring(0, 30)}...`);
    await bot.sendMessage(chatId, instantResult.text, { disable_web_page_preview: true })
      .catch(err => console.error(`[Bot] Send error: ${err.message}`));
    metrics.mark('responseSent');
    return;
  }

  // Get acknowledgment for this message
  const acknowledgment = fastResponder.getAcknowledgment(message);
  console.log(`[Bot] Intent: ${acknowledgment.intent}, Acknowledgment: ${acknowledgment.text}`);

  // Send acknowledgment IMMEDIATELY
  await bot.sendMessage(chatId, acknowledgment.text)
    .catch(err => console.error(`[Bot] Ack error: ${err.message}`));

  metrics.mark('acknowledgmentSent');

  // Get or create user session
  const session = getUserSession(chatId);

  // Process in background - don't block
  setImmediate(async () => {
    try {
      metrics.mark('orchestratorStart');

      // Use orchestrator to process the message with metrics
      const result = await session.sendMessage(message, { metrics });

      metrics.mark('responseFormatStart');
      const responseText = formatOrchestratorResult(result, metrics, 'medium');
      metrics.mark('responseFormatEnd');

      // Debug: log the response text to verify metrics are included
      console.log(`[Bot] Response preview: ${responseText.substring(0, 100)}...`);

      metrics.mark('responseSent');
      const processingTime = Date.now() - metrics.timings.receivedAt;

      console.log(`[Bot] User ${chatId}: Skill=${result.skill}, Model=${result.model}, Time=${result.executionTime}ms, Total=${processingTime}ms`);

      // Send as new message (more reliable than edit)
      const response = await bot.sendMessage(chatId, responseText.substring(0, 4000), {
        disable_web_page_preview: true
      }).catch(err => console.error(`[Bot] Response send error: ${err.message}`));

      if (response) {
        // Store metadata for reaction handling
        const metricsBreakdown = metrics.getBreakdown();
        metadataStore.store(response.message_id, {
          chatId,
          originalMessage: message,
          responseText: responseText.substring(0, 4000),
          skill: result.skill,
          model: result.model,
          metrics: metricsBreakdown,
          modelExplanation: result.metadata?.modelExplanation,
          complexityScore: result.metadata?.modelExplanation?.complexity,
          verbosity: 'medium', // Default verbosity
          type: 'bot-response'
        });
      }

    } catch (error) {
      console.error(`[Bot] Error: ${error.message}`);
      console.error(`[Bot] Stack: ${error.stack}`);

      metrics.markError(error);

      await bot.sendMessage(chatId, `❌ Error: ${error.message}`)
        .catch(err => console.error(`[Bot] Error send failed: ${err.message}`));
    }
  });
});

// Handle document/file uploads
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;

  const statusMsg = await bot.sendMessage(chatId, `📄 Processing ${fileName}...`);

  try {
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

    const session = getUserSession(chatId);
    const result = await session.sendMessage(`Analyze this file: ${fileName}. Download from ${fileUrl} and provide a summary.`);

    const responseText = formatOrchestratorResult(result);

    await bot.editMessageText(chatId, statusMsg.message_id, {
      text: formatMessage(`📄 ${fileName}\n\n${responseText}`),
      parse_mode: 'Markdown'
    });

  } catch (error) {
    await bot.editMessageText(chatId, statusMsg.message_id, `❌ Error: ${error.message}`);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// ============================================================
// INITIALIZATION
// ============================================================

(async () => {
  try {
    // IMPORTANT: Initialize session store BEFORE starting polling
    const sessionCount = await sessionStore.init();
    console.log(`[Bot] Session store initialized with ${sessionCount} sessions`);

    // Start auto-save
    sessionStore.startAutoSave();
    console.log('[Bot] Session auto-save enabled');

    // NOW start polling (after sessions are loaded)
    bot.startPolling();
    console.log('[Bot] Started polling for messages');

    // Success message
    console.log('✅ Clawdbot v4.0 with HTTP API & Session Persistence is running!');
    console.log('📱 Connected to Telegram');
    console.log('🧠 Orchestrator: Active');
    console.log('💾 Session Persistence: Enabled');
    console.log('🎯 Skills: 8 available');
    console.log('💬 Chat mode: Natural language with smart routing');
  } catch (error) {
    console.error('[Bot] Initialization failed:', error);
    process.exit(1);
  }
})();
