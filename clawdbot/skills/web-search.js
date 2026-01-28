// ============================================================
// WEB SEARCH SKILL
// ============================================================

/**
 * Search the web using multiple search engines and APIs
 */

async function webSearch(query, context = {}) {
  const { execSync } = require('child_process');
  const axios = require('axios');

  try {
    // Method 1: Use duckduckgo for privacy-focused search
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;

    // Method 2: Build a comprehensive search prompt for Claude
    const prompt = `
Search the web for: "${query}"

Use these methods:
1. If you have web search capability, use it
2. If you can browse websites, do so
3. Provide the most current and accurate information
4. Include source URLs
5. Summarize key findings

Focus on:
- Direct answers to the question
- Recent information (2024-2025)
- Reliable sources
- Multiple perspectives if applicable
`;

    // Execute with Claude
    const result = execSync(
      `docker exec clawdbot claude "${prompt.replace(/"/g, '\\"')}" --dangerously-skip-permissions`,
      { encoding: 'utf8', timeout: 60000 }
    );

    return {
      success: true,
      query: query,
      results: result,
      sources: [],
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      query: query
    };
  }
}

/**
 * Quick search (for fast model)
 */
async function quickSearch(query) {
  // Simpler search for quick answers
  const prompt = `Quick web search: ${query}\n\nProvide a concise answer with sources.`;
  const { execSync } = require('child_process');

  try {
    const result = execSync(
      `docker exec clawdbot claude "${prompt.replace(/"/g, '\\"')}" --dangerously-skip-permissions`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return { success: true, results: result, quick: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  webSearch,
  quickSearch
};
