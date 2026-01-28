// ============================================================
// DOCKER MANAGER SKILL - Create and manage Docker containers
// ============================================================

const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Generate a Dockerfile based on requirements
 */
function generateDockerfile(config) {
  const { language, dependencies, command, exposePort = false } = config;

  let dockerfile = '';

  switch (language) {
    case 'python':
      dockerfile = `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
${dependencies ? `COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt` : ''}

COPY . .

${exposePort ? 'EXPOSE ' + exposePort : ''}

CMD ["${command || 'python', 'main.py'}"]
`;
      break;

    case 'node':
      dockerfile = `FROM node:20-slim

WORKDIR /app

# Install dependencies
${dependencies ? `COPY package*.json ./
RUN npm install` : ''}

COPY . .

${exposePort ? 'EXPOSE ' + exposePort : ''}

CMD ["${command || 'node', 'index.js'}"]
`;
      break;

    case 'bash':
      dockerfile = `FROM bash:latest

WORKDIR /app

COPY . .

CMD ["${command || 'bash', 'script.sh'}"]
`;
      break;

    default:
      dockerfile = `FROM ubuntu:22.04

WORKDIR /app

RUN apt-get update && apt-get install -y \\
    curl \\
    vim \\
    && rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["${command || 'bash'}"]
`;
  }

  return dockerfile;
}

/**
 * Create a Docker container for running code/scripts
 */
async function createContainer(config) {
  const {
    name,
    language,
    code,
    dependencies,
    command,
    port,
    detach = true
  } = config;

  try {
    // Create project directory
    const projectDir = `/workspace/docker-containers/${name}`;
    execSync(`mkdir -p ${projectDir}`);

    // Write code file
    const extension = {
      python: 'py',
      javascript: 'js',
      node: 'js',
      bash: 'sh'
    }[language] || 'txt';

    fs.writeFileSync(`${projectDir}/main.${extension}`, code);

    // Write dependencies file if provided
    if (dependencies && dependencies.length > 0) {
      if (language === 'python') {
        fs.writeFileSync(`${projectDir}/requirements.txt`, dependencies.join('\n'));
      } else if (language === 'node' || language === 'javascript') {
        fs.writeFileSync(`${projectDir}/package.json`, JSON.stringify({
          name: name,
          version: '1.0.0',
          dependencies: dependencies.reduce((acc, dep) => ({ ...acc, [dep]: 'latest' }), {})
        }, null, 2));
      }
    }

    // Generate Dockerfile
    const dockerfile = generateDockerfile({
      language,
      dependencies: dependencies && dependencies.length > 0,
      command,
      exposePort: port
    });

    fs.writeFileSync(`${projectDir}/Dockerfile`, dockerfile);

    // Build image
    const imageName = `claude-${name}`;
    execSync(`docker build -t ${imageName} ${projectDir}`, { timeout: 300000 });

    // Run container
    let runCmd = `docker run --name ${name}`;
    if (detach) runCmd += ` -d`;
    if (port) runCmd += ` -p ${port}:${port}`;
    runCmd += ` ${imageName}`;

    execSync(runCmd, { timeout: 60000 });

    return {
      success: true,
      containerName: name,
      imageName: imageName,
      projectDir: projectDir,
      status: 'running'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Stop and remove a container
 */
async function removeContainer(name, removeImage = false) {
  try {
    // Stop container
    execSync(`docker stop ${name}`, { stdio: 'ignore' });
    execSync(`docker rm ${name}`);

    let result = {
      success: true,
      container: name,
      status: 'removed'
    };

    // Remove image if requested
    if (removeImage) {
      const { stdout } = execSync(`docker images ${name} -q`, { encoding: 'utf8' });
      if (stdout.trim()) {
        execSync(`docker rmi ${name}`);
        result.imageRemoved = true;
      }
    }

    return result;

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all clawdbot-managed containers
 */
async function listContainers() {
  try {
    const output = execSync('docker ps -a --filter "name=claude-" --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"', {
      encoding: 'utf8'
    });

    const containers = output.trim().split('\n').filter(line => line).map(line => {
      const [name, status, ports] = line.split('\t');
      return { name, status, ports };
    });

    return {
      success: true,
      containers: containers
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      containers: []
    };
  }
}

/**
 * Execute a command in a running container
 */
async function execInContainer(containerName, command) {
  try {
    const output = execSync(`docker exec ${containerName} ${command}`, {
      encoding: 'utf8',
      timeout: 60000
    });

    return {
      success: true,
      container: containerName,
      command: command,
      output: output
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr || ''
    };
  }
}

/**
 * Get logs from a container
 */
async function getLogs(containerName, tail = 100) {
  try {
    const output = execSync(`docker logs --tail ${tail} ${containerName}`, {
      encoding: 'utf8'
    });

    return {
      success: true,
      container: containerName,
      logs: output
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createContainer,
  removeContainer,
  listContainers,
  execInContainer,
  getLogs,
  generateDockerfile
};
