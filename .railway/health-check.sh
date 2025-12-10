#!/bin/bash
# Railway Health Check Script
# Ensures backend is healthy before marking deployment as successful

MAX_ATTEMPTS=30
SLEEP_INTERVAL=10
HEALTH_ENDPOINT="http://localhost:${PORT:-3000}/health"

echo "🔍 Starting health check for Railway deployment..."
echo "Health endpoint: $HEALTH_ENDPOINT"
echo "Max attempts: $MAX_ATTEMPTS"
echo "Sleep interval: ${SLEEP_INTERVAL}s"
echo ""

for i in $(seq 1 $MAX_ATTEMPTS); do
  echo "Attempt $i/$MAX_ATTEMPTS..."

  # Try to hit the health endpoint
  if curl -f -s -o /dev/null -w "%{http_code}" "$HEALTH_ENDPOINT" | grep -q "200"; then
    echo "✅ Health check passed!"
    echo ""

    # Get full health status
    HEALTH_STATUS=$(curl -s "$HEALTH_ENDPOINT")
    echo "Health status:"
    echo "$HEALTH_STATUS" | jq '.' 2>/dev/null || echo "$HEALTH_STATUS"
    echo ""

    exit 0
  fi

  if [ $i -lt $MAX_ATTEMPTS ]; then
    echo "⏳ Health check failed, retrying in ${SLEEP_INTERVAL}s..."
    sleep $SLEEP_INTERVAL
  fi
done

echo "❌ Health check failed after $MAX_ATTEMPTS attempts"
echo "Backend did not become healthy in time"
exit 1
