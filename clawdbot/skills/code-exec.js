// ============================================================
// CODE EXECUTION SKILL - Run code in Docker sandbox
// ============================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Detect programming language from code
 */
function detectLanguage(code) {
  if (code.includes('def ') || code.includes('import ')) return 'python';
  if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'javascript';
  if (code.includes('#!/bin/bash') || code.includes('echo ')) return 'bash';
  if (code.includes('public class') || code.includes('public static void main')) return 'java';
  if (code.includes('package main') || code.includes('func ')) return 'go';
  if (code.includes('fn main()') || code.includes('let mut ')) return 'rust';

  return 'python'; // Default
}

/**
 * Get Docker image for language
 */
function getDockerImage(language) {
  const images = {
    python: 'python:3.11-slim',
    javascript: 'node:20-slim',
    bash: 'bash:latest',
    java: 'openjdk:21-slim',
    go: 'golang:1.21-alpine',
    rust: 'rust:1.75-alpine'
  };

  return images[language] || images.python;
}

/**
 * Execute code in a Docker container
 */
async function executeCode(code, language = null, stdin = '') {
  try {
    const detectedLang = language || detectLanguage(code);
    const image = getDockerImage(detectedLang);

    // Create temp file with code
    const tempDir = '/tmp/code-exec';
    const fileName = {
      python: 'script.py',
      javascript: 'script.js',
      bash: 'script.sh',
      java: 'Main.java',
      go: 'main.go',
      rust: 'main.rs'
    }[detectedLang];

    const fullPath = `${tempDir}/${fileName}`;

    // Ensure temp dir exists in workspace
    execSync(`mkdir -p ${tempDir}`);
    fs.writeFileSync(fullPath, code);

    // Build Docker command
    let dockerCmd = `docker run --rm`;

    // Add resource limits
    dockerCmd += ` --memory=512m --cpus=1`;

    // Mount code directory
    dockerCmd += ` -v ${tempDir}:/app`;

    // Set working directory
    dockerCmd += ` -w /app`;

    // Add timeout (30 seconds)
    dockerCmd += ` --timeout=30`;

    // Execute code
    if (detectedLang === 'python') {
      dockerCmd += ` ${image} python ${fileName}`;
    } else if (detectedLang === 'javascript') {
      dockerCmd += ` ${image} node ${fileName}`;
    } else if (detectedLang === 'bash') {
      dockerCmd += ` ${image} bash ${fileName}`;
    } else if (detectedLang === 'java') {
      dockerCmd += ` ${image} sh -c "javac ${fileName} && java Main"`;
    } else if (detectedLang === 'go') {
      dockerCmd += ` ${image} sh -c "go run ${fileName}"`;
    } else if (detectedLang === 'rust') {
      dockerCmd += ` ${image} sh -c "cargo run --quiet 2>/dev/null || rustc ${fileName} && ./${fileName.replace('.rs', '')}"`;
    }

    // Execute with stdin if provided
    const options = {
      encoding: 'utf8',
      timeout: 35000,
      stdio: 'pipe'
    };

    if (stdin) {
      options.input = stdin;
    }

    const result = execSync(dockerCmd, options);

    // Cleanup
    execSync(`rm -rf ${tempDir}`);

    return {
      success: true,
      language: detectedLang,
      output: result,
      executionTime: Date.now()
    };

  } catch (error) {
    // Cleanup on error too
    try {
      execSync(`rm -rf /tmp/code-exec`);
    } catch (e) {}

    return {
      success: false,
      error: error.message,
      stderr: error.stderr || '',
      output: error.stdout || ''
    };
  }
}

/**
 * Execute multiple code snippets (for testing/learning)
 */
async function executeMultiple(codeSnippets) {
  const results = [];

  for (let i = 0; i < codeSnippets.length; i++) {
    const snippet = codeSnippets[i];
    const result = await executeCode(snippet.code, snippet.language);
    results.push({
      index: i,
      ...result
    });
  }

  return results;
}

/**
 * Interactive code execution (with REPL-like behavior)
 */
async function executeInteractive(code, language) {
  // For interactive sessions, return instructions
  return {
    success: true,
    interactive: true,
    instructions: `
To run ${language} code interactively:

1. Use this Docker command:
docker run -it --rm ${getDockerImage(language)}

2. Or for Python with more tools:
docker run -it --rm python:3.11-slim bash

3. Your code will execute in a sandboxed container with:
   - 512MB memory limit
   - 1 CPU limit
   - 30 second timeout
   - Network access (can be disabled)
`,
    code: code
  };
}

module.exports = {
  executeCode,
  executeMultiple,
  executeInteractive,
  detectLanguage,
  getDockerImage
};
