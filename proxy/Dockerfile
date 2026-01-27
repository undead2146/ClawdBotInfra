# ============================================================
# Claude Proxy Dockerfile
# ============================================================
# Build context for the custom proxy router
# ============================================================

FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create config directory
RUN mkdir -p /app/config

# Expose port
EXPOSE 8082

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# Start the application
CMD ["node", "index.js"]
