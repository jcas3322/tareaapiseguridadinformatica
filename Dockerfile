# Spotify API - Multi-stage Docker build for production
# Optimized for security, performance, and minimal image size

# =============================================================================
# Build Stage
# =============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Build the application
RUN npm run build

# Remove dev dependencies and install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# Runtime Stage
# =============================================================================
FROM node:18-alpine AS runtime

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S spotify -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=spotify:nodejs /app/dist ./dist
COPY --from=builder --chown=spotify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=spotify:nodejs /app/package*.json ./

# Copy configuration files
COPY --chown=spotify:nodejs config/ ./config/

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R spotify:nodejs /app/logs /app/uploads /app/temp

# Set file permissions
RUN chmod -R 755 /app && \
    chmod -R 700 /app/logs /app/uploads /app/temp

# Switch to non-root user
USER spotify

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]

# =============================================================================
# Development Stage (for docker-compose.dev.yml)
# =============================================================================
FROM node:18-alpine AS development

# Install development tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S spotify -u 1001 -G nodejs

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY --chown=spotify:nodejs . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R spotify:nodejs /app

# Switch to non-root user
USER spotify

# Expose port
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"]

# =============================================================================
# Testing Stage
# =============================================================================
FROM development AS testing

# Switch back to root to install test dependencies
USER root

# Install additional testing tools
RUN apk add --no-cache \
    chromium \
    && rm -rf /var/cache/apk/*

# Set Chrome path for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Switch back to app user
USER spotify

# Run tests
CMD ["npm", "test"]

# =============================================================================
# Migration Stage (for running database migrations)
# =============================================================================
FROM runtime AS migration

# Copy migration files
COPY --chown=spotify:nodejs src/infrastructure/database/migrations ./migrations
COPY --chown=spotify:nodejs scripts/migrate.js ./

# Migration command
CMD ["node", "migrate.js"]