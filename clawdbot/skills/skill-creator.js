// ============================================================
// SKILL CREATOR META-SKILL
// Creates new skills autonomously based on natural language descriptions
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Analyze requirements and create a new skill
 */
async function createSkillFromDescription(description, context = {}) {
  const startTime = Date.now();

  try {
    console.log(`[SkillCreator] Creating skill from: ${description.substring(0, 100)}...`);

    // Step 1: Extract skill requirements using Claude
    const requirements = await extractRequirements(description);

    // Step 2: Generate skill ID
    const skillId = generateSkillId(requirements.name);

    // Step 3: Generate skill code
    const skillCode = await generateSkillCode(requirements);

    // Step 4: Update skill-router.js
    await registerSkill(skillId, requirements);

    // Step 5: Update orchestrator/main.js
    await wireSkill(skillId, requirements);

    // Step 6: Test the skill
    const testResult = await testSkill(skillId);

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      skillId: skillId,
      requirements: requirements,
      codeGenerated: skillCode.length > 0,
      testPassed: testResult.success,
      executionTime: executionTime,
      nextSteps: [
        `1. Review generated skill at: clawdbot/skills/${skillId}.js`,
        `2. Test via Telegram: "test ${skillId}"`,
        `3. Adjust keywords in skill-router.js if needed`,
        `4. Commit changes: git add . && git commit -m "feat: Add ${skillId} skill"`
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Extract skill requirements from description
 */
async function extractRequirements(description) {
  const prompt = `
You are a skill architect. Analyze this request for a new skill:

"${description}"

Extract and return ONLY valid JSON:
{
  "name": "Skill Name",
  "description": "What this skill does",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "models": ["fast"] or ["smart"] or ["fast", "smart"],
  "timeout": 30000,
  "inputFormat": "What input this skill accepts",
  "outputFormat": "What this skill returns",
  "logic": "Step-by-step logic for the skill"
}

Be specific and realistic.
`;

  try {
    const result = execSync(
      `docker exec clawdbot claude "${prompt.replace(/"/g, '\\"')}" --dangerously-skip-permissions`,
      { encoding: 'utf8', timeout: 60000 }
    );

    // Extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    // Fallback: basic extraction
    return {
      name: description.split(' ').slice(0, 3).join('-').toLowerCase(),
      description: description.substring(0, 100),
      keywords: extractKeywords(description),
      models: ['smart'],
      timeout: 60000,
      inputFormat: 'text',
      outputFormat: 'json',
      logic: description
    };
  }
}

/**
 * Generate skill implementation code
 */
async function generateSkillCode(requirements) {
  const prompt = `
You are a Node.js developer. Create a skill implementation with these requirements:

${JSON.stringify(requirements, null, 2)}

Generate a complete Node.js module with:
1. Proper async/await patterns
2. Error handling with try-catch
3. JSDoc comments
4. Module.exports
5. Input validation
6. Clear return format

Return ONLY the code, no markdown, no explanations.
`;

  try {
    const result = execSync(
      `docker exec clawdbot claude "${prompt.replace(/"/g, '\\"')}" --dangerously-skip-permissions`,
      { encoding: 'utf8', timeout: 90000 }
    );

    // Extract code block if present
    const codeMatch = result.match(/```(?:javascript)?\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : result;
  } catch (error) {
    // Generate basic template
    return generateBasicTemplate(requirements);
  }
}

/**
 * Register skill in skill-router.js
 */
async function registerSkill(skillId, requirements) {
  const skillRouterPath = '/home/ubuntu/claude-stack/clawdbot/orchestrator/skill-router.js';
  const skillConfig = `
  '${skillId}': {
    name: '${requirements.name}',
    description: '${requirements.description.replace(/'/g, "\\'")}',
    keywords: ${JSON.stringify(requirements.keywords)},
    models: ${JSON.stringify(requirements.models)},
    timeout: ${requirements.timeout},
    handler: './skills/${skillId}.js'
  },`;

  // Read current file
  let content = fs.readFileSync(skillRouterPath, 'utf8');

  // Insert before closing brace of skills object
  const insertPoint = content.lastIndexOf('};');
  if (insertPoint === -1) {
    throw new Error('Could not find skills object in skill-router.js');
  }

  content = content.slice(0, insertPoint) + skillConfig + '\n' + content.slice(insertPoint);

  // Write back
  fs.writeFileSync(skillRouterPath, content);

  console.log(`[SkillCreator] Registered ${skillId} in skill-router.js`);
  return true;
}

/**
 * Wire skill in orchestrator/main.js
 */
async function wireSkill(skillId, requirements) {
  const orchestratorPath = '/home/ubuntu/claude-stack/clawdbot/orchestrator/main.js';
  const caseCode = `
      case '${skillId}':
        // Extract input from user message
        const input = userMessage; // TODO: Add proper extraction
        skillResult = await skillHandler.${camelize(skillId)}(input);
        break;`;

  // Read current file
  let content = fs.readFileSync(orchestratorPath, 'utf8');

  // Find switch statement and add case
  const switchMatch = content.match(/(switch \(skillId\) \{[\s\S]*?)(    default:)/);
  if (!switchMatch) {
    console.log(`[SkillCreator] Could not find switch statement, adding case manually`);
    // Add case before the default case in executeSkill
    const defaultPos = content.indexOf('    // Default to Claude');
    if (defaultPos !== -1) {
      content = content.slice(0, defaultPos) + caseCode + '\n' + content.slice(defaultPos);
    }
  } else {
    content = content.replace(switchMatch[0], switchMatch[1] + caseCode + '\n' + switchMatch[2]);
  }

  // Write back
  fs.writeFileSync(orchestratorPath, content);

  console.log(`[SkillCreator] Wired ${skillId} in orchestrator/main.js`);
  return true;
}

/**
 * Test the newly created skill
 */
async function testSkill(skillId) {
  try {
    // Try to load the skill
    const skillPath = `/home/ubuntu/claude-stack/clawdbot/skills/${skillId}.js`;

    if (!fs.existsSync(skillPath)) {
      return {
        success: false,
        error: `Skill file not found: ${skillPath}`
      };
    }

    // Basic syntax check
    const result = execSync(`node -c ${skillPath}`, {
      stdio: 'pipe',
      encoding: 'utf8'
    });

    return {
      success: true,
      message: `Skill ${skillId} passed syntax check`
    };
  } catch (error) {
    return {
      success: false,
      error: `Syntax error: ${error.message}`
    };
  }
}

/**
 * Extract keywords from description
 */
function extractKeywords(description) {
  const words = description.toLowerCase().split(/\s+/);
  const keywords = words.filter(w => w.length > 3).slice(0, 5);
  return [...new Set(keywords)]; // Deduplicate
}

/**
 * Generate skill ID from name
 */
function generateSkillId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert to camelCase
 */
function camelize(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
      return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
    .replace(/[\s_-]+/g, '');
}

/**
 * Generate basic skill template (fallback)
 */
function generateBasicTemplate(requirements) {
  return `/**
 * ${requirements.name}
 * ${requirements.description}
 */

async function ${camelize(generateSkillId(requirements.name))}(input, context = {}) {
  try {
    // TODO: Implement skill logic
    // ${requirements.logic || 'Add implementation here'}

    return {
      success: true,
      result: {
        input: input,
        processed: true,
        message: 'Skill executed (implementation needed)'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  ${camelize(generateSkillId(requirements.name))}
};
`;
}

/**
 * List all existing skills
 */
async function listSkills() {
  const skillsDir = '/home/ubuntu/claude-stack/clawdbot/skills';
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js'));

  return files.map(file => ({
    name: file,
    path: path.join(skillsDir, file),
    size: fs.statSync(path.join(skillsDir, file)).size
  }));
}

/**
 * Analyze skill performance
 */
async function analyzeSkillPerformance(skillId) {
  // This would track metrics like:
  // - Execution time
  // - Success rate
  // - Error frequency
  // - User satisfaction

  return {
    skillId: skillId,
    avgExecutionTime: 0,
    successRate: 0,
    lastExecuted: null,
    recommendation: 'Not enough data'
  };
}

module.exports = {
  createSkillFromDescription,
  listSkills,
  analyzeSkillPerformance,
  generateSkillId,
  extractKeywords
};
