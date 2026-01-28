// ============================================================
// MAIN ORCHESTRATOR - Routes tasks to skills and models
// ============================================================

const { detectSkill, buildSkillPrompt } = require('./skill-router');
const { chooseModel, explainChoice } = require('./model-picker');
const { execSync } = require('child_process');

/**
 * Main orchestration function
 * Analyzes the request, chooses model and skill, executes task
 */
async function orchestrate(userMessage, context = {}) {
  const startTime = Date.now();

  try {
    // Step 1: Detect which skill to use
    const skillDetection = detectSkill(userMessage);
    const skillId = skillDetection.skill;

    console.log(`[Orchestrator] Detected skill: ${skillId} (confidence: ${skillDetection.confidence})`);

    // Step 2: Choose model (fast vs smart)
    const modelChoice = chooseModel(userMessage, context);
    const modelExplanation = explainChoice(userMessage, modelChoice.name);

    console.log(`[Orchestrator] Chosen model: ${modelChoice.name}`);
    console.log(`[Orchestrator] Reason: ${modelExplanation.reason}`);

    // Step 3: Build specialized prompt for the skill
    const specializedPrompt = buildSkillPrompt(skillId, userMessage, context);

    // Step 4: Execute the task
    let result;

    // For general chat, just use Claude directly
    if (skillId === 'general') {
      result = await executeClaude(specializedPrompt, modelChoice);
    } else {
      // For specialized skills, try to use skill handler if available
      result = await executeSkill(skillId, userMessage, specializedPrompt, modelChoice, context);
    }

    const executionTime = Date.now() - startTime;

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

    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Execute task using Claude Code CLI
 */
async function executeClaude(prompt, modelConfig) {
  try {
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const command = `docker exec clawdbot claude "${escapedPrompt}" --dangerously-skip-permissions`;

    const stdout = execSync(command, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
      encoding: 'utf8'
    });

    return {
      method: 'claude-cli',
      output: stdout
    };

  } catch (error) {
    return {
      method: 'claude-cli',
      error: error.message,
      output: error.stderr || error.stdout || ''
    };
  }
}

/**
 * Execute a specialized skill
 */
async function executeSkill(skillId, userMessage, prompt, modelConfig, context) {
  try {
    // Check if we have a skill handler
    let skillHandler;

    try {
      skillHandler = require(`../skills/${skillId}`);
    } catch (e) {
      // No specific handler, use Claude with specialized prompt
      console.log(`[Orchestrator] No handler for ${skillId}, using Claude with specialized prompt`);
      return await executeClaude(prompt, modelConfig);
    }

    // Execute the skill
    console.log(`[Orchestrator] Executing skill: ${skillId}`);

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
          skillResult = await executeClaude(prompt, modelConfig);
        }
        break;

      case 'docker-mgr':
        // For Docker management, use Claude with specialized prompt
        skillResult = await executeClaude(prompt, modelConfig);
        break;

      case 'skill-creator':
        // Extract skill description from message
        const skillDesc = userMessage.replace(/create skill|make skill|add skill|new skill|skill for/gi, '').trim();
        skillResult = await skillHandler.createSkillFromDescription(skillDesc);
        break;

      default:
        // Default to Claude with specialized prompt
        skillResult = await executeClaude(prompt, modelConfig);
    }

    return {
      method: 'skill-handler',
      skill: skillId,
      result: skillResult
    };

  } catch (error) {
    return {
      method: 'skill-handler',
      error: error.message,
      fallback: await executeClaude(prompt, modelConfig)
    };
  }
}

/**
 * Chat mode - handles multi-turn conversations
 */
class ChatSession {
  constructor(userId) {
    this.userId = userId;
    this.history = [];
    this.context = {};
    this.turnCount = 0;
  }

  async sendMessage(message) {
    this.turnCount++;

    // Add to history
    this.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Orchestrate the response
    const response = await orchestrate(message, {
      ...this.context,
      conversationTurns: this.turnCount,
      history: this.history
    });

    // Add response to history
    this.history.push({
      role: 'assistant',
      content: response.result?.output || response.result?.result || response.error,
      timestamp: new Date().toISOString()
    });

    // Update context based on response
    if (response.skill) {
      this.context.lastSkill = response.skill;
    }

    return response;
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.history = [];
    this.turnCount = 0;
  }
}

/**
 * Create a new chat session
 */
function createSession(userId) {
  return new ChatSession(userId);
}

module.exports = {
  orchestrate,
  executeClaude,
  executeSkill,
  ChatSession,
  createSession
};
