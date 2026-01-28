FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    docker.io \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy bot code
COPY . .

# Expose port (not needed for polling, but good practice)
EXPOSE 3000

# Environment variables
ENV TELEGRAM_BOT_TOKEN=8558008669:AAFPdgQ0-9snUSjbsjrvvjP00mw7lUIIV5Y
ENV CLAWDBOT_URL=http://clawdbot:8082

# Start the bot
CMD ["npm", "start"]
