FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY bot/package*.json ./

# Install dependencies
RUN npm install

# Copy bot code
COPY bot/ ./

# Copy orchestrator modules
COPY orchestrator/ ./orchestrator/

# Copy skills
COPY skills/ ./skills/

# Copy storage modules (including fast-responder)
COPY storage/ ./storage/

# Expose port (not needed for polling)
EXPOSE 3000

# Environment variables
ENV TELEGRAM_BOT_TOKEN=8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y
ENV CLAWDBOT_URL=http://clawdbot:8082

# Start the bot
CMD ["node", "index.js"]
