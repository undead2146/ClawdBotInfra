require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Telegram Bot Token
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y';

// Create bot
const bot = new TelegramBot(TOKEN, { polling: true });

// Store user sessions
const userSessions = new Map();

// Task queue for long-running operations
const taskQueue = new Map();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Helper: Execute clawdbot command
async function executeClawdbot(prompt, userId) {
  try {
    const { execSync } = require('child_process');
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const command = `docker exec clawdbot claude "${escapedPrompt}" --dangerously-skip-permissions`;

    const stdout = execSync(command, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    return stdout;
  } catch (error) {
    console.error('Clawdbot execution error:', error.message);
    return error.stderr || error.stdout || `Error: ${error.message}`;
  }
}

// Helper: Format long messages
function formatMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper: Detect command type from message
function detectCommandType(message) {
  const lower = message.toLowerCase();

  // PR review requests
  if (lower.includes('pr') && (lower.includes('review') || lower.includes('check'))) {
    return 'pr_review';
  }

  // PR creation requests
  if (lower.includes('create') && lower.includes('pr')) {
    return 'create_pr';
  }

  // Todo sync requests
  if (lower.includes('todo') || lower.includes('sync')) {
    return 'sync_todos';
  }

  // Status checks
  if (lower === 'status' || lower === '/status') {
    return 'status';
  }

  // Help requests
  if (lower === 'help' || lower === '/help') {
    return 'help';
  }

  // Default: chat
  return 'chat';
}

// Helper: Build specialized prompt based on command type
function buildPrompt(commandType, message, userId) {
  switch (commandType) {
    case 'pr_review':
      return `You are a PR review specialist. ${message}

Analyze the pull request thoroughly:
1. Code quality and bugs
2. Security vulnerabilities
3. Performance concerns
4. Best practices

Be concise but thorough. Use severity labels: [CRITICAL], [HIGH], [MEDIUM], [LOW].`;

    case 'create_pr':
      return `You are a code implementation specialist. ${message}

Steps:
1. Clone the repository if needed
2. Create a feature branch
3. Implement the required changes
4. Commit with clear message
5. Create a detailed PR

Work in /workspace/repos. Report progress at each step.`;

    case 'sync_todos':
      return `You are a data extraction specialist. ${message}

Extract todo items and structure them:
- Title
- Due date
- Priority
- Status

Save to /workspace/tasks/todos.md organized by category.`;

    case 'status':
      return null; // Handle separately

    case 'help':
      return null; // Handle separately

    default:
      return message; // Just pass through for chat
  }
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

// Command: /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
🤖 *Welcome to Clawdbot!*

Your AI-powered development assistant.

*Quick Start:*
• Just type anything to chat with Claude
• Mention "PR review" to review pull requests
• Say "create PR for..." to make pull requests
• Ask to "sync todos from <url>"

*Commands:*
/status - System status
/help - Show this message

*Tips:*
• No need for /chat - just type!
• Attach files for Claude to analyze
• Works with GitHub, GitLab, and more
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
📚 *Clawdbot Help*

*Chat Mode (Default)*
Just type anything! Claude will respond naturally.

*Special Tasks:*
• "Review PR in <repo> #123"
• "Create PR for <task description>"
• "Sync todos from <url>"
• "Check status of my repos"

*System Commands:*
/status - Show system status
/help - This message

*Examples:*
• "What's the difference between let and const?"
• "Review https://github.com/user/repo/pull/42"
• "Create a PR that adds user authentication"
• "Sync my todos from ticktick.com"
  `, { parse_mode: 'Markdown' });
});

// Command: /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const { execSync } = require('child_process');
    const { stdout } = execSync('docker ps --filter "name=clawdbot" --format "table {{.Names}}\t{{.Status}}"', {
      encoding: 'utf8'
    });

    const statusMessage = `
📊 *Clawdbot Status*

${stdout}

✅ All systems operational
  `;

    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error checking status: ${error.message}`);
  }
});

// ============================================================
// MAIN MESSAGE HANDLER (Chat by Default)
// ============================================================

bot.on('message', async (msg) => {
  // Skip commands (they're handled above)
  if (msg.text?.startsWith('/')) return;

  const chatId = msg.chat.id;
  const message = msg.text;

  if (!message) return;

  // Detect command type
  const commandType = detectCommandType(message);

  // Handle special commands
  if (commandType === 'status') {
    // Trigger status command
    msg.text = '/status';
    return; // Will be caught by /status handler
  }

  if (commandType === 'help') {
    msg.text = '/help';
    return;
  }

  // Build appropriate prompt
  const prompt = buildPrompt(commandType, message, chatId);

  // Send thinking indicator
  const statusMsg = await bot.sendMessage(chatId, '💭 ');

  try {
    const result = await executeClawdbot(prompt, chatId);

    // Update with response
    try {
      await bot.editMessageText(chatId, statusMsg.message_id, {
        text: formatMessage(result),
        parse_mode: 'Markdown'
      });
    } catch (editError) {
      // If edit fails, send new message
      await bot.sendMessage(chatId, formatMessage(result), { parse_mode: 'Markdown' });
    }
  } catch (error) {
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
    // Get file info
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

    // Download and analyze
    const prompt = `Analyze this file: ${fileName}. Download it from ${fileUrl} and provide:
1. File type and purpose
2. Key contents summary
3. Any issues or improvements needed
4. Security concerns (if applicable)`;

    const result = await executeClawdbot(prompt, chatId);

    await bot.editMessageText(chatId, statusMsg.message_id, {
      text: formatMessage(`📄 ${fileName}\n\n${result}`),
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
console.log('✅ Clawdbot Telegram Bot v2.0 is running!');
console.log('📱 Connected to Telegram');
console.log('💬 Chat-by-default mode enabled');
console.log('🤖 Ready to receive messages');
