// ============================================================
// MAIN ORCHESTRATOR - Routes tasks to skills and models
// ============================================================

const { detectSkill, buildSkillPrompt } = require('./skill-router');
const { chooseModel, explainChoice } = require('./model-picker');
const axios = require('axios');
const sessionStore = require('../storage/session-store');

// Proxy configuration
const PROXY_URL = process.env.CLAUDE_PROXY_URL || 'http://proxy:8082';
const PROXY_TIMEOUT = process.env.CLAUDE_PROXY_TIMEOUT || 60000;

/**
 * Main orchestration function
 * Analyzes the request, chooses model and skill, executes task
 */
async function orchestrate(userMessage, context = {}, metrics = null) {
  const startTime = Date.now();

  try {
    // Step 1: Detect which skill to use
    const skillDetection = detectSkill(userMessage);
    const skillId = skillDetection.skill;

    console.log(`[Orchestrator] Detected skill: ${skillId} (confidence: ${skillDetection.confidence})`);

    // Record skill detection timing
    if (metrics) {
      metrics.mark('skillDetection');
      metrics.setFlow('skill', skillId);
      metrics.setFlow('confidence', skillDetection.confidence);
    }

    // Step 2: Choose model (fast vs smart)
    const modelChoice = chooseModel(userMessage, context);
    const modelExplanation = explainChoice(userMessage, modelChoice.name);

    console.log(`[Orchestrator] Chosen model: ${modelChoice.name}`);
    console.log(`[Orchestrator] Reason: ${modelExplanation.reason}`);

    // Record model selection timing and flow info
    if (metrics) {
      metrics.mark('modelSelection');
      metrics.setFlow('model', modelChoice.name);
      metrics.setFlow('modelExplanation', modelExplanation);
      metrics.setFlow('complexityScore', modelExplanation.complexity);
    }

    // Step 3: Build specialized prompt for the skill
    const specializedPrompt = buildSkillPrompt(skillId, userMessage, context);

    if (metrics) metrics.mark('promptBuilding');

    // Step 4: Execute the task
    let result;

    // For general chat, just use Claude directly
    if (skillId === 'general') {
      result = await executeClaude(specializedPrompt, modelChoice, context, metrics);
    } else {
      // For specialized skills, try to use skill handler if available
      result = await executeSkill(skillId, userMessage, specializedPrompt, modelChoice, context, metrics);
    }

    const executionTime = Date.now() - startTime;

    // Mark orchestrator end time
    if (metrics) metrics.mark('orchestratorEnd');

    return {
      success: true,
      skill: skillId,
      model: modelChoice.name,
      executionTime: executionTime,
      result: result,
      metadata: {
        confidence: skillDetection.confidence,
        modelExplanation: modelExplanation
      }
    };

  } catch (error) {
    console.error(`[Orchestrator] Error: ${error.message}`);

    if (metrics) metrics.markError(error);

    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Format conversation history for Claude API
 */
function formatConversationHistory(history, maxTurns = 10) {
  if (!history || history.length === 0) return [];

  // Get last maxTurns*2 messages (user + assistant pairs)
  const recentHistory = history.slice(-maxTurns * 2);

  return recentHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
}

/**
 * Execute task using Claude via HTTP API (async, non-blocking)
 */
async function executeClaude(prompt, modelConfig, context = {}, metrics = null) {
  const startTime = Date.now();

  if (metrics) metrics.mark('apiCallStart');

  try {
    // Determine timeout based on model tier
    const modelTier = modelConfig.name.toLowerCase();
    let timeout = 60000; // Default 60s

    if (modelTier.includes('haiku') || modelTier.includes('flash')) {
      timeout = 30000; // 30s for fast models
    } else if (modelTier.includes('sonnet') || modelTier.includes('pro')) {
      timeout = 60000; // 60s for smart models
    } else if (modelTier.includes('opus')) {
      timeout = 90000; // 90s for complex models
    }

    console.log(`[Orchestrator] executeClaude: model=${modelConfig.name}, timeout=${timeout}ms`);

    // Build messages array
    const messages = [];

    // Add conversation history if available
    const history = context.history || [];
    const formattedHistory = formatConversationHistory(history);
    messages.push(...formattedHistory);

    // Prepend Clawdbot context to every prompt so the AI always knows what it is
    const clawdbotContext = `IMPORTANT: You are Clawdbot v4.0, an AI assistant on Telegram with 9 specialized skills.
Skills: general, web-search, pr-review, code-exec, docker-mgr, file-ops, organize, tts, web-scrape.
Models: Haiku (Fast) or Sonnet (Smart). Currently: ${modelConfig.name}.
When asked about skills/capabilities: You have exactly 9 skills. List them all.
---`;

    console.log(`[Orchestrator] Sending prompt with context (${clawdbotContext.length} chars context)`);

    // Add current prompt as user message with context prepended
    messages.push({
      role: 'user',
      content: clawdbotContext + prompt
    });

    // Make HTTP request to proxy
    const requestBody = {
      model: modelConfig.name,
      messages: messages,
      max_tokens: 4096,
      stream: false
    };

    console.log(`[Orchestrator] Sending request to proxy with ${messages.length} messages`);

    const response = await axios({
      method: 'POST',
      url: `${PROXY_URL}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      data: requestBody,
      timeout: timeout
    });

    const elapsedTime = Date.now() - startTime;
    if (metrics) metrics.mark('apiCallEnd');

    console.log(`[Orchestrator] Response received in ${elapsedTime}ms`);

    // Extract text content from response
    let output = '';
    if (response.data && response.data.content) {
      // Handle both text blocks and complex content
      const content = response.data.content;
      if (Array.isArray(content)) {
        output = content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else if (typeof content === 'string') {
        output = content;
      } else if (content.text) {
        output = content.text;
      }
    }

    return {
      method: 'claude-http',
      output: output || JSON.stringify(response.data, null, 2),
      model: modelConfig.name,
      executionTime: elapsedTime
    };

  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    if (metrics) metrics.mark('apiCallEnd');

    console.error(`[Orchestrator] executeClaude error after ${elapsedTime}ms: ${error.message}`);

    if (metrics) metrics.markError(error);

    // Handle different error types
    let errorMessage = error.message;
    let errorDetails = '';

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Cannot connect to proxy service. Is the proxy running?';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorMessage = `Request timed out after ${elapsedTime}ms. The model may be overloaded or the request too complex.`;
    } else if (error.response) {
      // API returned an error
      const statusCode = error.response.status;
      const errorData = error.response.data;

      if (errorData && errorData.error) {
        errorMessage = `API Error (${statusCode}): ${errorData.error.message || errorData.error}`;
      } else {
        errorMessage = `API Error (${statusCode}): ${error.statusText || 'Unknown error'}`;
      }

      errorDetails = JSON.stringify(errorData, null, 2);
    }

    return {
      method: 'claude-http',
      error: errorMessage,
      output: errorDetails || '',
      executionTime: elapsedTime
    };
  }
}

/**
 * Execute a specialized skill
 */
async function executeSkill(skillId, userMessage, prompt, modelConfig, context, metrics = null) {
  try {
    // Check if we have a skill handler
    let skillHandler;

    try {
      skillHandler = require(`../skills/${skillId}`);
    } catch (e) {
      // No specific handler, use Claude with specialized prompt
      console.log(`[Orchestrator] No handler for ${skillId}, using Claude with specialized prompt`);
      return await executeClaude(prompt, modelConfig, context, metrics);
    }

    // Execute the skill
    console.log(`[Orchestrator] Executing skill: ${skillId}`);

    if (metrics) {
      metrics.setFlow('subAgent', skillId);
    }

    let skillResult;
    switch (skillId) {
      case 'web-search':
        const query = userMessage.replace(/search|find|look up|google for/gi, '').trim();
        skillResult = await skillHandler.webSearch(query);
        break;

      case 'code-exec':
        // Extract code from message (simplified)
        const codeMatch = userMessage.match(/```(?:python|javascript|bash)?\n([\s\S]+?)```/);
        if (codeMatch) {
          skillResult = await skillHandler.executeCode(codeMatch[1]);
        } else {
          // No code block, ask Claude to help
          skillResult = await executeClaude(prompt, modelConfig, context, metrics);
        }
        break;

      case 'docker-mgr':
        // For Docker management, use Claude with specialized prompt
        skillResult = await executeClaude(prompt, modelConfig, context, metrics);
        break;

      case 'skill-creator':
        // Extract skill description from message
        const skillDesc = userMessage.replace(/create skill|make skill|add skill|new skill|skill for/gi, '').trim();
        skillResult = await skillHandler.createSkillFromDescription(skillDesc);
        break;

      default:
        // Default to Claude with specialized prompt
        skillResult = await executeClaude(prompt, modelConfig, context, metrics);
    }

    return {
      method: 'skill-handler',
      skill: skillId,
      result: skillResult
    };

  } catch (error) {
    if (metrics) metrics.markError(error);

    return {
      method: 'skill-handler',
      error: error.message,
      fallback: await executeClaude(prompt, modelConfig, context, metrics)
    };
  }
}

/**
 * Chat mode - handles multi-turn conversations
 */
class ChatSession {
  constructor(userId, initialData = null) {
    this.userId = userId;
    this.history = initialData?.history || [];
    this.context = initialData?.context || {};
    this.turnCount = initialData?.turnCount || 0;
  }

  async sendMessage(message, options = {}) {
    this.turnCount++;

    // Add to history
    this.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Orchestrate the response with metrics if provided
    const response = await orchestrate(message, {
      ...this.context,
      conversationTurns: this.turnCount,
      history: this.history
    }, options.metrics);

    // Extract actual text content from response for history
    // The response.result can be an object with method/output, or have nested result/output
    let responseText = '';
    if (response.result) {
      if (typeof response.result === 'string') {
        responseText = response.result;
      } else if (response.result.output && typeof response.result.output === 'string') {
        responseText = response.result.output;
      } else if (response.result.result && typeof response.result.result === 'string') {
        responseText = response.result.result;
      } else if (response.result.result && response.result.result.output && typeof response.result.result.output === 'string') {
        responseText = response.result.result.output;
      }
    }

    // Fall back to error message if no content
    if (!responseText && response.error) {
      responseText = `Error: ${response.error}`;
    }

    // Add response to history (must be a string for API)
    this.history.push({
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString()
    });

    // Update context based on response
    if (response.skill) {
      this.context.lastSkill = response.skill;
    }

    // Save to session store (async, don't wait)
    sessionStore.setSession(this.userId, this.getState());
    sessionStore.saveSessions().catch(err => {
      console.error(`[ChatSession] Failed to save: ${err.message}`);
    });

    return response;
  }

  getHistory() {
    return this.history;
  }

  getState() {
    return {
      history: this.history,
      context: this.context,
      turnCount: this.turnCount,
      lastActive: new Date().toISOString()
    };
  }

  clearHistory() {
    this.history = [];
    this.turnCount = 0;
    // Save cleared state
    sessionStore.setSession(this.userId, this.getState());
    sessionStore.saveSessions().catch(err => {
      console.error(`[ChatSession] Failed to save cleared state: ${err.message}`);
    });
  }
}

/**
 * Create or restore a chat session
 */
function createSession(userId) {
  const existingSession = sessionStore.getSession(userId);
  if (existingSession) {
    console.log(`[Orchestrator] Restoring session for user ${userId} with ${existingSession.history.length} messages`);
    return new ChatSession(userId, existingSession);
  }
  return new ChatSession(userId);
}

module.exports = {
  orchestrate,
  executeClaude,
  executeSkill,
  ChatSession,
  createSession
};
