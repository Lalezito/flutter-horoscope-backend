#!/bin/sh

# Load Balancer Startup Script
# This script configures the application to run in load balancer mode

echo "🚀 Starting Load Balancer Service..."

# Set load balancer mode
export LOAD_BALANCER_MODE=true
export DISABLE_CRON_JOBS=true  # Load balancer doesn't need cron jobs

# Wait for Redis to be available
echo "⏳ Waiting for Redis to be available..."
while ! nc -z ${REDIS_HOST:-localhost} ${REDIS_PORT:-6379}; do
  sleep 1
done
echo "✅ Redis is available"

# Wait for backend instances to be available
echo "⏳ Waiting for backend instances to be available..."
sleep 10

# Start the application in load balancer mode
echo "🎯 Starting load balancer..."
exec node src/load-balancer-app.js