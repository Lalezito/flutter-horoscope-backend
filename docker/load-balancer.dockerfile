# Dockerfile for dedicated load balancer instance
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/
COPY public/ ./public/

# Create load balancer specific startup script
COPY docker/load-balancer-start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use load balancer startup script
CMD ["./start.sh"]