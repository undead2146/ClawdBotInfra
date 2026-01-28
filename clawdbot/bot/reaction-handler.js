// ============================================================
// REACTION HANDLER - Handle all emoji reaction interactions
// ============================================================

const {
  EMOJI,
  getModelEmoji,
  getStatusReaction,
  getReactionsForVerbosity,
  getActionReactions,
  isVerbosityEmoji,
  isActionEmoji,
  getVerbosityFromEmoji
} = require('./emoji-mappings');

/**
 * Handle user reaction to a bot message
 */
async function handleReaction(reaction, metadataStore, bot) {
  const { message_id, user, old_reaction, new_reaction } = reaction;

  // Get the emoji from the reaction
  const emoji = new_reaction?.type === 'emoji' ? new_reaction.emoji : null;
  if (!emoji) return;

  console.log(`[ReactionHandler] User ${user?.id || 'unknown'} reacted with ${emoji} to message ${message_id}`);

  // Get metadata for this message
  const metadata = metadataStore.get(message_id);
  if (!metadata) {
    console.debug(`[ReactionHandler] No metadata found for message ${message_id}`);
    return;
  }

  try {
    // Handle different reaction types
    if (isVerbosityEmoji(emoji)) {
      await changeVerbosity(message_id, emoji, metadata, metadataStore, bot);
    } else if (emoji === EMOJI.ACTION.RETRY_SMART) {
      await retryWithSmartModel(message_id, metadata, metadataStore, bot);
    } else if (emoji === EMOJI.ACTION.EXPLAIN) {
      await explainReasoning(message_id, metadata, metadataStore, bot);
    } else if (emoji === EMOJI.ACTION.METRICS) {
      await showFullMetrics(message_id, metadata, metadataStore, bot);
    } else if (emoji === EMOJI.ACTION.YES || emoji === EMOJI.ACTION.NO) {
      await handleUserFeedback(emoji, message_id, metadata, metadataStore, bot);
    } else {
      console.debug(`[ReactionHandler] Unhandled reaction: ${emoji}`);
    }
  } catch (error) {
    console.error(`[ReactionHandler] Error handling reaction: ${error.message}`);
  }
}

/**
 * Change verbosity level of the message
 */
async function changeVerbosity(messageId, emoji, metadata, metadataStore, bot) {
  const newVerbosity = getVerbosityFromEmoji(emoji);
  if (!newVerbosity) return;

  const { chatId, originalMessage, skill, model, metrics: metricsData, modelExplanation, complexityScore } = metadata;

  console.log(`[ReactionHandler] Changing verbosity to ${newVerbosity} for message ${messageId}`);

  // Reformat the response with new verbosity
  const newText = formatResponseWithVerbosity(
    metadata.originalResponse || metadata.responseText,
    skill,
    model,
    metricsData,
    modelExplanation,
    complexityScore,
    newVerbosity
  );

  // Edit the message with new content
  await bot.editMessageText(chatId, messageId, newText)
    .catch(err => console.error(`[ReactionHandler] Failed to edit message: ${err.message}`));

  // Update metadata with new verbosity
  metadataStore.update(messageId, { verbosity: newVerbosity });

  // Update reactions to show current state
  const verbReactions = getReactionsForVerbosity(newVerbosity);
  await bot.setMessageReaction(chatId, messageId, verbReactions)
    .catch(() => {}); // Ignore failures
}

/**
 * Retry the response with a smarter model
 */
async function retryWithSmartModel(messageId, metadata, metadataStore, bot) {
  const { chatId, originalMessage, model } = metadata;

  console.log(`[ReactionHandler] Retrying with smart model for message ${messageId}`);

  // Check if already using smart model
  if (model && model.toLowerCase().includes('sonnet')) {
    await bot.sendMessage(chatId, `🧠 Already using the smart model (${model}).`);
    return;
  }

  // Send processing indicator
  await bot.sendMessage(chatId, `🔄 Retrying with smart model...`);

  // Store retry request so orchestrator can pick it up
  // (This would be handled by the orchestrator seeing a pending retry)
  metadataStore.update(messageId, { pendingRetry: true, forceModel: 'smart' });

  // Trigger re-processing (this would normally be done through the session/orchestrator)
  // For now, just inform the user
  await bot.sendMessage(chatId, `💡 *Note*: Full retry support requires orchestrator integration.\n\nPlease send your message again with "smart model" hint if needed.`, {
    parse_mode: 'Markdown'
  });
}

/**
 * Explain why this model/skill was chosen
 */
async function explainReasoning(messageId, metadata, metadataStore, bot) {
  const { chatId, skill, model, modelExplanation, complexityScore } = metadata;

  console.log(`[ReactionHandler] Explaining reasoning for message ${messageId}`);

  let explanation = `🤔 **Why this response?**\n\n`;

  if (skill) {
    explanation += `🎯 **Skill**: ${skill}\n`;
  }

  if (model) {
    explanation += `${getModelEmoji(model)} **Model**: ${model}\n`;
  }

  if (complexityScore !== null && complexityScore !== undefined) {
    explanation += `📊 **Complexity Score**: ${complexityScore}/3\n`;
  }

  if (modelExplanation) {
    explanation += `\n💭 **Reasoning**: ${modelExplanation.reason || 'N/A'}\n`;
  }

  explanation += `\nReact with 📊 for detailed timing metrics.`;

  await bot.sendMessage(chatId, explanation, { parse_mode: 'Markdown' });
}

/**
 * Show detailed metrics breakdown
 */
async function showFullMetrics(messageId, metadata, metadataStore, bot) {
  const { chatId, metrics: metricsData, skill, model } = metadata;

  console.log(`[ReactionHandler] Showing full metrics for message ${messageId}`);

  let message = `📊 **Detailed Metrics**\n\n`;

  if (skill) {
    message += `🎯 Skill: ${skill}\n`;
  }

  if (model) {
    message += `${getModelEmoji(model)} Model: ${model}\n`;
  }

  message += `\n`;

  if (metricsData) {
    message += formatMetricsDetails(metricsData);
  } else {
    message += `No detailed metrics available for this message.`;
  }

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

/**
 * Handle user feedback (yes/no reactions)
 */
async function handleUserFeedback(emoji, messageId, metadata, metadataStore, bot) {
  const { chatId } = metadata;

  console.log(`[ReactionHandler] User feedback: ${emoji}`);

  const feedback = emoji === EMOJI.ACTION.YES ? '👍 Positive' : '👎 Negative';

  // Log the feedback
  console.log(`[ReactionHandler] ${feedback} feedback received for message ${messageId}`);

  // Could trigger different actions based on feedback
  if (emoji === EMOJI.ACTION.YES) {
    await bot.sendMessage(chatId, `✅ Thanks for the feedback!`);
  } else {
    await bot.sendMessage(chatId, `📝 Thanks for the feedback! You can react with 🧠 to retry with a smarter model.`);
  }

  // Store feedback in metadata
  metadataStore.update(messageId, { userFeedback: emoji });
}

/**
 * Format response with verbosity level
 */
function formatResponseWithVerbosity(responseText, skill, model, metricsData, modelExplanation, complexityScore, verbosity) {
  let output = '';

  // Add header based on verbosity
  if (verbosity === 'full' && skill && model) {
    output += `${getModelEmoji(model)} **${model}** | 🎯 **${skill}**\n\n`;
  } else if (verbosity === 'medium' && model) {
    output += `${getModelEmoji(model)} ${model}`;
    if (skill) output += ` | ${skill}`;
    output += '\n\n';
  }

  // Add metrics if available
  if (verbosity === 'full' && metricsData) {
    output += formatMetricsDetails(metricsData) + '\n\n';
  } else if (verbosity === 'medium' && metricsData) {
    output += `⏱️ ${metricsData.total}ms\n\n`;
  }

  // Add main response
  output += responseText;

  // Add hint for reactions in full mode
  if (verbosity === 'full') {
    output += `\n\n💡 *Reactions*: 🔇🔉🔊 verbosity | 🧠 retry smart | 🤔 explain | 📊 metrics`;
  }

  return output;
}

/**
 * Format metrics details
 */
function formatMetricsDetails(metricsData) {
  let text = `⏱️ **Timing Breakdown**\n`;

  if (metricsData.total) {
    text += `Total: ${metricsData.total}ms\n`;
  }

  const segments = [
    { key: 'fastPathCheck', label: 'Fast Path Check' },
    { key: 'acknowledgment', label: 'Acknowledgment' },
    { key: 'skillDetection', label: 'Skill Detection' },
    { key: 'modelSelection', label: 'Model Selection' },
    { key: 'promptBuilding', label: 'Prompt Building' },
    { key: 'apiCall', label: 'API Call' },
    { key: 'formatting', label: 'Formatting' }
  ];

  const segmentsWithValues = segments.filter(s => metricsData[s.key]);

  if (segmentsWithValues.length > 0) {
    text += `├─ ${segmentsWithValues[0].label}: ${metricsData[segmentsWithValues[0].key]}ms\n`;

    for (let i = 1; i < segmentsWithValues.length - 1; i++) {
      text += `├─ ${segmentsWithValues[i].label}: ${metricsData[segmentsWithValues[i].key]}ms\n`;
    }

    if (segmentsWithValues.length > 1) {
      const last = segmentsWithValues[segmentsWithValues.length - 1];
      text += `└─ ${last.label}: ${metricsData[last.key]}ms\n`;
    }
  }

  return text;
}

module.exports = {
  handleReaction,
  formatResponseWithVerbosity,
  formatMetricsDetails
};
