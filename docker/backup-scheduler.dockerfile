# Dockerfile for automated backup system
# Runs alongside main application for production backup management

FROM node:18-alpine

# Install PostgreSQL client tools and system dependencies
RUN apk add --no-cache \
    postgresql-client \
    bash \
    gzip \
    openssl \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=America/New_York

# Create app directory
WORKDIR /app

# Copy backup system
COPY scripts/backup-system.js .
COPY package.json .
COPY package-lock.json .

# Install dependencies
RUN npm ci --only=production

# Create backup storage directory
RUN mkdir -p /data/backups

# Copy backup scheduling script
COPY scripts/backup-cron.sh /usr/local/bin/backup-cron.sh
RUN chmod +x /usr/local/bin/backup-cron.sh

# Setup cron for automated backups
RUN echo "0 3 * * * /usr/local/bin/backup-cron.sh full" > /var/spool/cron/crontabs/root
RUN echo "0 */6 * * * /usr/local/bin/backup-cron.sh incremental" >> /var/spool/cron/crontabs/root
RUN echo "0 4 * * 0 /usr/local/bin/backup-cron.sh retention" >> /var/spool/cron/crontabs/root
RUN echo "0 5 * * 0 /usr/local/bin/backup-cron.sh test" >> /var/spool/cron/crontabs/root

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node backup-system.js status || exit 1

# Start cron daemon and keep container running
CMD ["crond", "-f", "-d", "8"]