// ============================================================
// USER PROMPT HANDLER - AskUserQuestion-style prompts with emoji voting
// ============================================================

const { EMOJI, getYesNoReactions } = require('./emoji-mappings');

/**
 * UserPromptHandler - Manages interactive prompts with emoji-based responses
 * Similar to AskUserQuestion in Claude Code
 */
class UserPromptHandler {
  constructor(bot, metadataStore) {
    this.bot = bot;
    this.metadataStore = metadataStore;

    // Store pending prompts: messageId -> prompt data
    this.pendingPrompts = new Map();

    // Default timeout for prompts (5 minutes)
    this.defaultTimeout = 300000;

    // Cleanup interval
    this._startCleanup();
  }

  /**
   * Prompt user with a question and emoji options
   * @param {number} chatId - Telegram chat ID
   * @param {string} question - Question to ask
   * @param {Array} options - Array of { label, emoji, action, description }
   * @param {Object} context - Additional context to store
   * @returns {Promise<number>} - Message ID of the prompt
   */
  async promptUser(chatId, question, options = [], context = {}) {
    let messageText = `❓ **${question}**\n\n`;

    // Build the message with options
    options.forEach((opt, i) => {
      const emoji = opt.emoji || (i === 0 ? EMOJI.ACTION.YES : EMOJI.ACTION.NO);
      messageText += `${emoji} **${opt.label}**`;
      if (opt.description) {
        messageText += ` - ${opt.description}`;
      }
      messageText += `\n`;
    });

    // Send the message
    const message = await this.bot.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown'
    });

    const messageId = message.message_id;

    // Store the prompt
    this.pendingPrompts.set(String(messageId), {
      chatId,
      question,
      options: options.map(opt => ({
        label: opt.label,
        emoji: opt.emoji || (options.indexOf(opt) === 0 ? EMOJI.ACTION.YES : EMOJI.ACTION.NO),
        action: opt.action || opt.label.toLowerCase().replace(/\s+/g, '_'),
        description: opt.description
      })),
      createdAt: Date.now(),
      expiresAt: Date.now() + (context.timeout || this.defaultTimeout),
      context
    });

    // Add reaction options
    const emojis = options.map(opt => ({
      type: 'emoji',
      emoji: opt.emoji || (options.indexOf(opt) === 0 ? EMOJI.ACTION.YES : EMOJI.ACTION.NO)
    }));

    await this.bot.setMessageReaction(chatId, messageId, emojis).catch(() => {});

    console.log(`[UserPromptHandler] Created prompt ${messageId} for user ${chatId}: ${question}`);

    // Store in metadata store for reaction handling
    this.metadataStore.store(messageId, {
      chatId,
      type: 'user-prompt',
      promptData: this.pendingPrompts.get(String(messageId))
    });

    return messageId;
  }

  /**
   * Prompt user with a simple yes/no question
   */
  async promptYesNo(chatId, question, context = {}) {
    return this.promptUser(chatId, question, [
      { label: 'Yes', emoji: EMOJI.ACTION.YES, action: 'yes' },
      { label: 'No', emoji: EMOJI.ACTION.NO, action: 'no' }
    ], context);
  }

  /**
   * Handle user's reaction to a prompt
   * @returns {Object|null} - The selected option or null if invalid
   */
  async handleResponse(messageId, emoji) {
    const promptData = this.pendingPrompts.get(String(messageId));

    if (!promptData) {
      console.debug(`[UserPromptHandler] No pending prompt found for message ${messageId}`);
      return null;
    }

    // Check if expired
    if (Date.now() > promptData.expiresAt) {
      this.pendingPrompts.delete(String(messageId));
      console.debug(`[UserPromptHandler] Prompt ${messageId} expired`);
      return null;
    }

    // Find the matching option
    const selectedOption = promptData.options.find(opt => opt.emoji === emoji);

    if (!selectedOption) {
      console.debug(`[UserPromptHandler] No matching option for emoji ${emoji}`);
      return null;
    }

    console.log(`[UserPromptHandler] User selected: ${selectedOption.label} (${selectedOption.action})`);

    // Remove from pending (user has responded)
    this.pendingPrompts.delete(String(messageId));

    // Mark the message as answered in metadata store
    this.metadataStore.update(messageId, {
      promptAnswered: true,
      selectedOption
    });

    return {
      question: promptData.question,
      answer: selectedOption.label,
      action: selectedOption.action,
      context: promptData.context
    };
  }

  /**
   * Check if a message ID is a pending prompt
   */
  isPendingPrompt(messageId) {
    return this.pendingPrompts.has(String(messageId));
  }

  /**
   * Get prompt data for a message
   */
  getPromptData(messageId) {
    return this.pendingPrompts.get(String(messageId));
  }

  /**
   * Cancel a pending prompt
   */
  cancelPrompt(messageId) {
    const promptData = this.pendingPrompts.get(String(messageId));

    if (promptData) {
      this.pendingPrompts.delete(String(messageId));
      console.log(`[UserPromptHandler] Cancelled prompt ${messageId}`);
      return true;
    }

    return false;
  }

  /**
   * Cancel all pending prompts for a chat
   */
  cancelAllForChat(chatId) {
    let cancelled = 0;

    for (const [messageId, promptData] of this.pendingPrompts.entries()) {
      if (promptData.chatId === chatId) {
        this.pendingPrompts.delete(messageId);
        cancelled++;
      }
    }

    if (cancelled > 0) {
      console.log(`[UserPromptHandler] Cancelled ${cancelled} prompts for chat ${chatId}`);
    }

    return cancelled;
  }

  /**
   * Clean up expired prompts
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [messageId, promptData] of this.pendingPrompts.entries()) {
      if (now > promptData.expiresAt) {
        this.pendingPrompts.delete(messageId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[UserPromptHandler] Cleaned up ${cleaned} expired prompts`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup
   */
  _startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Check every minute

    this.cleanupTimer.unref();
  }

  /**
   * Stop cleanup timer
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pending: this.pendingPrompts.size
    };
  }
}

// Singleton instance
let promptHandlerInstance = null;

/**
 * Get or create the singleton instance
 */
function getInstance(bot, metadataStore) {
  if (!promptHandlerInstance && bot && metadataStore) {
    promptHandlerInstance = new UserPromptHandler(bot, metadataStore);
  }
  return promptHandlerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
function resetInstance() {
  if (promptHandlerInstance) {
    promptHandlerInstance.stop();
    promptHandlerInstance = null;
  }
}

module.exports = {
  UserPromptHandler,
  getInstance,
  resetInstance
};
