// ============================================================
// SKILL ROUTER - Chooses the right skill for the task
// ============================================================

const skills = {
  'web-search': {
    name: 'Web Search',
    description: 'Search the web and fetch information',
    keywords: ['search', 'find', 'look up', 'google', 'web', 'information'],
    models: ['fast', 'smart'], // Can use either
    timeout: 30000,
    handler: './skills/web-search.js'
  },
  'pr-review': {
    name: 'PR Reviewer',
    description: 'Review pull requests for bugs, security, and quality',
    keywords: ['pr', 'pull request', 'review', 'check code'],
    models: ['smart'], // Requires smart model
    timeout: 120000,
    handler: './skills/pr-review.js'
  },
  'code-exec': {
    name: 'Code Executor',
    description: 'Execute code in a Docker sandbox',
    keywords: ['run', 'execute', 'compile', 'test code'],
    models: ['fast'],
    timeout: 60000,
    handler: './skills/code-exec.js'
  },
  'file-ops': {
    name: 'File Operations',
    description: 'Download, upload, and manage files',
    keywords: ['download', 'upload', 'file', 'save', 'fetch'],
    models: ['fast'],
    timeout: 60000,
    handler: './skills/file-ops.js'
  },
  'web-scrape': {
    name: 'Web Scraper',
    description: 'Scrape websites for structured data',
    keywords: ['scrape', 'extract', 'crawl', 'parse'],
    models: ['smart'],
    timeout: 90000,
    handler: './skills/web-scrape.js'
  },
  'organize': {
    name: 'Organizer',
    description: 'Organize information, tasks, and data',
    keywords: ['organize', 'sort', 'categorize', 'structure'],
    models: ['smart'],
    timeout: 60000,
    handler: './skills/organize.js'
  },
  'docker-mgr': {
    name: 'Docker Manager',
    description: 'Create and manage Docker containers',
    keywords: ['docker', 'container', 'deploy', 'spin up'],
    models: ['smart'],
    timeout: 120000,
    handler: './skills/docker-mgr.js'
  },
  'tts': {
    name: 'Text to Speech',
    description: 'Convert text to speech',
    keywords: ['speak', 'say', 'voice', 'audio', 'tts'],
    models: ['fast'],
    timeout: 15000,
    handler: './skills/tts.js'
  },
  'skill-creator': {
    name: 'Skill Creator',
    description: 'Autonomously create new skills from descriptions',
    keywords: ['create skill', 'new skill', 'add skill', 'make skill', 'skill creator'],
    models: ['smart'],
    timeout: 120000,
    handler: './skills/skill-creator.js'
  }
};

/**
 * Detect which skill should handle this request
 */
function detectSkill(message) {
  const lower = message.toLowerCase();

  // Score each skill based on keyword matches
  const scores = {};
  for (const [skillId, skill] of Object.entries(skills)) {
    let score = 0;
    for (const keyword of skill.keywords) {
      if (lower.includes(keyword)) {
        score += 1;
        // Exact phrase match gets bonus
        if (lower.includes(keyword.toLowerCase())) {
          score += 0.5;
        }
      }
    }
    scores[skillId] = score;
  }

  // Find highest score
  let bestSkill = null;
  let bestScore = 0;
  for (const [skillId, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestSkill = skillId;
    }
  }

  // Return skill if score > 0, otherwise 'general'
  return bestScore > 0 ? { skill: bestSkill, confidence: bestScore } : { skill: 'general', confidence: 0 };
}

/**
 * Get model recommendation based on task complexity
 */
function getModelPreference(task, userPreferences = {}) {
  const skillConfig = skills[task];

  // User preference overrides
  if (userPreferences.forceModel) {
    return userPreferences.forceModel;
  }

  // Check if skill specifies model preference
  if (skillConfig && skillConfig.models.length === 1) {
    return skillConfig.models[0]; // Skill requires specific model
  }

  // Smart decision based on task type
  if (task === 'pr-review' || task === 'web-scrape' || task === 'organize') {
    return 'smart'; // Complex tasks need smart model
  }

  // Default: fast model for initial response
  return 'fast';
}

/**
 * Build prompt for the specific skill
 */
function buildSkillPrompt(skillId, userMessage, context = {}) {
  const skill = skills[skillId];

  if (!skill) {
    // General chat - no special prompt
    return userMessage;
  }

  // Build skill-specific prompt
  let prompt = `You are a ${skill.name} specialist.\n\n`;
  prompt += `Task: ${userMessage}\n\n`;
  prompt += `Use your expertise to complete this task.\n`;

  // Add skill-specific instructions
  switch (skillId) {
    case 'pr-review':
      prompt += `
Review the pull request thoroughly:
1. Check for bugs and logic errors
2. Look for security vulnerabilities
3. Evaluate code quality and best practices
4. Suggest improvements

Use severity labels: [CRITICAL], [HIGH], [MEDIUM], [LOW]
`;
      break;

    case 'web-search':
      prompt += `
Search for the requested information and provide:
1. Direct answers to the question
2. Source URLs
3. Relevant context
4. Additional resources if helpful
`;
      break;

    case 'code-exec':
      prompt += `
Execute the requested code safely:
1. Create a temporary Docker container
2. Run the code in isolation
3. Capture output/errors
4. Clean up the container
5. Report results clearly

Support: Python, JavaScript, Bash, and more.
`;
      break;

    case 'docker-mgr':
      prompt += `
Manage Docker containers:
1. Create appropriate Dockerfile if needed
2. Build the image
3. Run the container with proper settings
4. Provide commands to manage it
5. Handle cleanup and errors

Always include security best practices.
`;
      break;

    case 'organize':
      prompt += `
Organize the information by:
1. Categorizing items logically
2. Prioritizing by importance/urgency
3. Creating clear structure
4. Providing action items
5. Making it easy to follow
`;
      break;

    case 'web-scrape':
      prompt += `
Scrape the website and:
1. Extract structured data
2. Preserve important information
3. Handle pagination if needed
4. Respect rate limits
5. Output in organized format
`;
      break;

    case 'file-ops':
      prompt += `
Handle file operations:
1. Download/upload as requested
2. Verify file integrity
3. Organize files properly
4. Report success/failure clearly
5. Handle errors gracefully
`;
      break;

    case 'tts':
      prompt += `
Convert text to speech:
1. Use appropriate speed and tone
2. Handle punctuation correctly
3. Generate audio file
4. Provide the file path
`;
      break;

    case 'skill-creator':
      prompt += `
Create a new skill based on the description:
1. Analyze requirements from the description
2. Generate skill code with proper structure
3. Add skill to skill-router.js
4. Wire up skill in orchestrator/main.js
5. Test the skill
6. Provide summary of what was created

Return a summary including:
- Skill ID
- Files created/modified
- Test results
- Next steps for the user
`;
      break;
  }

  return prompt;
}

module.exports = {
  skills,
  detectSkill,
  getModelPreference,
  buildSkillPrompt
};
