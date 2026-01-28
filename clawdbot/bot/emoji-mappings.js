// ============================================================
// EMOJI MAPPINGS - Define emoji constants and mappings
// ============================================================

/**
 * Emoji mappings for models, status, verbosity, and actions
 */
const EMOJI = {
  // Model emojis
  MODEL: {
    HA: '⚡',     // Haiku - Fast model
    SONNET: '🧠',  // Sonnet - Smart model
    OPUS: '👑',    // Opus - Premium model
    DEFAULT: '🤖'  // Default/fallback
  },

  // Status emojis
  STATUS: {
    PROCESSING: '⏳',
    SUCCESS: '✅',
    ERROR: '❌',
    THINKING: '🤔',
    WARNING: '⚠️'
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
    NO: '👎',
    REFRESH: '🔄'
  }
};

/**
 * Get model emoji from model name
 */
function getModelEmoji(modelName) {
  if (!modelName) return EMOJI.MODEL.DEFAULT;

  const lower = modelName.toLowerCase();

  if (lower.includes('haiku') || lower.includes('fast') || lower.includes('glm-4')) {
    return EMOJI.MODEL.HA;
  }
  if (lower.includes('sonnet') || lower.includes('smart')) {
    return EMOJI.MODEL.SONNET;
  }
  if (lower.includes('opus') || lower.includes('premium')) {
    return EMOJI.MODEL.OPUS;
  }

  return EMOJI.MODEL.DEFAULT;
}

/**
 * Get model name from emoji (reverse lookup)
 */
function getModelNameFromEmoji(emoji) {
  switch (emoji) {
    case EMOJI.MODEL.HA: return 'Haiku (Fast)';
    case EMOJI.MODEL.SONNET: return 'Sonnet (Smart)';
    case EMOJI.MODEL.OPUS: return 'Opus (Premium)';
    default: return null;
  }
}

/**
 * Get status reaction array for setMessageReaction
 * Returns array of { type: 'emoji', emoji: '...' }
 */
function getStatusReaction(modelName, success = true) {
  return [
    { type: 'emoji', emoji: getModelEmoji(modelName) },
    { type: 'emoji', emoji: success ? EMOJI.STATUS.SUCCESS : EMOJI.STATUS.ERROR }
  ];
}

/**
 * Get processing status reaction
 */
function getProcessingReaction() {
  return [
    { type: 'emoji', emoji: EMOJI.STATUS.PROCESSING }
  ];
}

/**
 * Get verbosity control reactions based on current verbosity
 * Returns reactions that TOGGLE to other verbosity levels
 */
function getReactionsForVerbosity(currentVerbosity) {
  const reactions = [];

  // Always show the other options (not the current one)
  if (currentVerbosity !== 'minimal') {
    reactions.push({ type: 'emoji', emoji: EMOJI.VERBOSITY.MINIMAL });
  }
  if (currentVerbosity !== 'medium') {
    reactions.push({ type: 'emoji', emoji: EMOJI.VERBOSITY.MEDIUM });
  }
  if (currentVerbosity !== 'full') {
    reactions.push({ type: 'emoji', emoji: EMOJI.VERBOSITY.FULL });
  }

  return reactions;
}

/**
 * Get action reactions for bot responses
 */
function getActionReactions() {
  return [
    { type: 'emoji', emoji: EMOJI.ACTION.RETRY_SMART },
    { type: 'emoji', emoji: EMOJI.ACTION.EXPLAIN },
    { type: 'emoji', emoji: EMOJI.ACTION.METRICS }
  ];
}

/**
 * Get yes/no reactions for prompts
 */
function getYesNoReactions() {
  return [
    { type: 'emoji', emoji: EMOJI.ACTION.YES },
    { type: 'emoji', emoji: EMOJI.ACTION.NO }
  ];
}

/**
 * Check if emoji is a verbosity control emoji
 */
function isVerbosityEmoji(emoji) {
  return Object.values(EMOJI.VERBOSITY).includes(emoji);
}

/**
 * Check if emoji is an action emoji
 */
function isActionEmoji(emoji) {
  return Object.values(EMOJI.ACTION).includes(emoji);
}

/**
 * Get verbosity level from emoji
 */
function getVerbosityFromEmoji(emoji) {
  switch (emoji) {
    case EMOJI.VERBOSITY.MINIMAL: return 'minimal';
    case EMOJI.VERBOSITY.MEDIUM: return 'medium';
    case EMOJI.VERBOSITY.FULL: return 'full';
    default: return null;
  }
}

module.exports = {
  EMOJI,
  getModelEmoji,
  getModelNameFromEmoji,
  getStatusReaction,
  getProcessingReaction,
  getReactionsForVerbosity,
  getActionReactions,
  getYesNoReactions,
  isVerbosityEmoji,
  isActionEmoji,
  getVerbosityFromEmoji
};
