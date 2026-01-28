// ============================================================
// MODEL PICKER - Choose between fast and smart models
// ============================================================

/**
 * Model configurations
 * fast: Quick responses for simple tasks
 * smart: Detailed responses for complex tasks
 */
const models = {
  fast: {
    name: 'Haiku (Fast)',
    model: 'claude-haiku-4-20250514',
    provider: 'glm',
    glmModel: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.7,
    useCase: 'Simple questions, quick responses, initial analysis'
  },
  smart: {
    name: 'Sonnet (Smart)',
    model: 'claude-sonnet-4-20250514',
    provider: 'glm',
    glmModel: 'glm-4.7',
    maxTokens: 8000,
    temperature: 0.5,
    useCase: 'Complex tasks, code analysis, deep reasoning'
  }
};

/**
 * Analyze task complexity to choose model
 */
function analyzeTaskComplexity(message, context = {}) {
  let complexityScore = 0;

  const lower = message.toLowerCase();

  // High complexity indicators
  if (lower.includes('analyze') || lower.includes('analysis')) complexityScore += 2;
  if (lower.includes('review') || lower.includes('audit')) complexityScore += 2;
  if (lower.includes('implement') || lower.includes('create')) complexityScore += 2;
  if (lower.includes('debug') || lower.includes('fix')) complexityScore += 2;
  if (lower.includes('optimize') || lower.includes('improve')) complexityScore += 2;
  if (lower.includes('architecture') || lower.includes('design')) complexityScore += 3;

  // Code-related tasks
  if (lower.includes('code') || lower.includes('function') || lower.includes('class')) complexityScore += 1;
  if (lower.includes('pr') || lower.includes('pull request')) complexityScore += 2;
  if (lower.includes('refactor')) complexityScore += 2;

  // Length of message (longer = more complex)
  if (message.length > 200) complexityScore += 1;
  if (message.length > 500) complexityScore += 2;

  // Context from previous turns
  if (context.conversationTurns > 3) complexityScore += 1; // Deep conversation

  // Low complexity indicators
  if (lower.includes('what is') || lower.includes('define')) complexityScore -= 1;
  if (lower.includes('list') || lower.includes('show me')) complexityScore -= 1;
  if (message.length < 50) complexityScore -= 1;

  return Math.max(0, complexityScore);
}

/**
 * Choose the best model for the task
 */
function chooseModel(message, context = {}) {
  const complexity = analyzeTaskComplexity(message, context);
  const threshold = 3; // Adjust based on testing

  // Allow override from context
  if (context.forceModel === 'fast') return models.fast;
  if (context.forceModel === 'smart') return models.smart;

  // Decision based on complexity
  if (complexity >= threshold) {
    return models.smart;
  }

  return models.fast;
}

/**
 * Get model configuration for Claude Code
 */
function getModelConfig(modelPreference) {
  const model = models[modelPreference] || models.fast;

  return {
    model: model.model,
    provider: model.provider,
    maxTokens: model.maxTokens,
    temperature: model.temperature
  };
}

/**
 * Explain why a model was chosen (for debugging/transparency)
 */
function explainChoice(message, chosenModel) {
  const complexity = analyzeTaskComplexity(message);

  return {
    chosen: chosenModel.name,
    complexity: complexity,
    reason: complexity >= 3
      ? 'Task requires deep analysis and reasoning'
      : 'Quick response sufficient for this task'
  };
}

module.exports = {
  models,
  analyzeTaskComplexity,
  chooseModel,
  getModelConfig,
  explainChoice
};
