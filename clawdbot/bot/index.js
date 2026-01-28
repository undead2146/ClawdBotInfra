require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Telegram Bot Token
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y';

// Create bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Import orchestrator
const { orchestrate, createSession } = require('./orchestrator/main.js');

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

// Helper: Format orchestrator result for Telegram
function formatOrchestratorResult(result) {
  let output = '';

  // Add metadata header only for concise responses
  if (result.metadata && result.metadata.confidence > 2) {
    output = `🎯 ${result.skill} | 🧠 ${result.model}\n\n`;
  }

  // Add main result
  if (result.result) {
    const { output: resultOutput, method, result: skillResult } = result.result;

    if (skillResult && skillResult.results) {
      output += skillResult.results;
    } else if (resultOutput) {
      output += resultOutput;
    } else if (typeof skillResult === 'string') {
      output += skillResult;
    } else {
      output += JSON.stringify(skillResult, null, 2);
    }
  }

  if (result.error && !result.result) {
    output += `❌ Error: ${result.error}`;
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
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  userSessions.delete(chatId);
  bot.sendMessage(chatId, '🗑️ Chat history cleared');
});

// ============================================================
// MAIN MESSAGE HANDLER (With Orchestrator)
// ============================================================

bot.on('message', async (msg) => {
  // Skip commands
  if (msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  const message = msg.text;

  if (!message) return;

  // Get or create user session
  const session = getUserSession(chatId);

  // Send thinking indicator
  const statusMsg = await bot.sendMessage(chatId, '🤖 ');

  try {
    // Use orchestrator to process the message
    const result = await session.sendMessage(message);

    console.log(`[Bot] User ${chatId}: ${message.substring(0, 50)}...`);
    console.log(`[Bot] Skill: ${result.skill}, Model: ${result.model}, Time: ${result.executionTime}ms`);

    // Format and send response
    const responseText = formatOrchestratorResult(result);

    try {
      await bot.editMessageText(chatId, statusMsg.message_id, {
        text: responseText.substring(0, 4000),  // Hard limit
        disable_web_page_preview: true
      });
    } catch (editError) {
      // If edit fails, send new message
      await bot.sendMessage(chatId, responseText.substring(0, 4000), {
        disable_web_page_preview: true
      });
    }

  } catch (error) {
    console.error(`[Bot] Error: ${error.message}`);

    try {
      await bot.editMessageText(chatId, statusMsg.message_id, `❌ Error: ${error.message}`);
    } catch (editError) {
      await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
    }
  }
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

// Success message
console.log('✅ Clawdbot v3.0 with Skills & Orchestrator is running!');
console.log('📱 Connected to Telegram');
console.log('🧠 Orchestrator: Active');
console.log('🎯 Skills: 8 available');
console.log('💬 Chat mode: Natural language with smart routing');
