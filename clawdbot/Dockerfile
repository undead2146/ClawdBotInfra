# ============================================================
# Clawdbot Dockerfile
# ============================================================
# Base image with Node.js and common CLI tools
FROM node:20-slim

# Set working directory
WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    vim \
    jq \
    bash \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
# Note: This will install the latest version
RUN npm install -g @anthropic-ai/claude-code

# Create directories for Claude
RUN mkdir -p /root/.claude

# Copy settings file (will be mounted as volume in compose)
COPY settings.json /root/.claude/settings.json

# Set up prompts directory
RUN mkdir -p /prompts

# Create workspace directory
RUN mkdir -p /workspace/repos /workspace/tasks

# Set up a non-root user (optional, for security)
RUN useradd -m -u 1000 clawdbot && \
    chown -R clawdbot:clawdbot /workspace /root/.claude /prompts

# Switch to non-root user
USER clawdbot

# Expose working directory
WORKDIR /workspace

# Default command (can be overridden)
CMD ["bash"]
