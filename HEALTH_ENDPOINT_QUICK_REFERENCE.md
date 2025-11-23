# Health Endpoint Quick Reference

## Quick Test Commands

### Basic Health Check
```bash
curl http://localhost:3000/health
```

### Pretty JSON Output
```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

### Check HTTP Status
```bash
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/health
```

### Check Database Status Only
```bash
curl -s http://localhost:3000/health | jq '.services.database'
```

### Check All Services Status
```bash
curl -s http://localhost:3000/health | jq '.services'
```

### Monitor Memory Usage
```bash
curl -s http://localhost:3000/health | jq '.memory'
```

### Check Server Uptime
```bash
curl -s http://localhost:3000/health | jq '.uptime'
```

### Continuous Monitoring (every 10 seconds)
```bash
watch -n 10 'curl -s http://localhost:3000/health | jq'
```

### Simple Ping Test
```bash
curl http://localhost:3000/ping
```

---

## Expected Response

### Healthy System (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T09:38:30.736Z",
  "version": "2.1.0",
  "services": {
    "api": "operational",
    "database": "connected",
    "firebase": { "status": "initialized", "hasServiceAccount": false },
    "cache": { "mode": "mock", "status": "operational" },
    "redis": { "status": "fallback", "mode": "fallback" }
  },
  "uptime": 17,
  "environment": "production",
  "memory": { "used": 32, "total": 111, "unit": "MB" }
}
```

### Unhealthy System (503 Service Unavailable)
```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T09:38:30.736Z",
  "version": "2.1.0",
  "services": {
    "api": "operational",
    "database": "timeout",  // or "disconnected" or "error"
    ...
  }
}
```

---

## Service Status Values

| Service | Possible Values | Critical? |
|---------|----------------|-----------|
| api | operational | ✅ Yes |
| database | connected, disconnected, timeout, error, unknown | ✅ Yes |
| firebase.status | initialized, mock | ❌ No |
| cache.mode | redis, memory, mock | ❌ No |
| redis.status | connected, fallback | ❌ No |

---

## HTTP Status Codes

- **200 OK**: All critical services operational (database connected)
- **503 Service Unavailable**: Database unavailable (critical service down)
- **500 Internal Server Error**: Health check failed unexpectedly

---

## Integration Examples

### Docker Compose
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 40s
```

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Shell Script Monitoring
```bash
#!/bin/bash

# Health check script
URL="http://localhost:3000/health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL)

if [ $STATUS -eq 200 ]; then
  echo "✅ Service healthy"
  exit 0
elif [ $STATUS -eq 503 ]; then
  echo "⚠️ Service degraded (database issue)"
  exit 1
else
  echo "❌ Service unhealthy (status: $STATUS)"
  exit 2
fi
```

---

## Troubleshooting Quick Checks

### Check if server is running
```bash
curl http://localhost:3000/ping
```

### Check database connection
```bash
curl -s http://localhost:3000/health | jq -r '.services.database'
```

### Check memory usage
```bash
curl -s http://localhost:3000/health | jq -r '.memory.used, .memory.total'
```

### Check all service statuses at once
```bash
curl -s http://localhost:3000/health | jq '.services | to_entries[] | "\(.key): \(.value)"'
```

### Monitor health in real-time
```bash
while true; do
  clear
  echo "=== Health Check ==="
  curl -s http://localhost:3000/health | jq
  echo ""
  echo "Press Ctrl+C to stop"
  sleep 10
done
```

---

## Production URLs

### Development
```
http://localhost:3000/health
```

### Production (Railway)
```
https://your-app.railway.app/health
```

Replace `your-app.railway.app` with your actual Railway domain.

---

## Related Endpoints

- **GET /health**: Comprehensive health check (this endpoint)
- **GET /ping**: Simple availability check
- **GET /api/docs**: Full API documentation
- **GET /api/admin/health**: Admin-level health check (requires authentication)

---

## Performance Expectations

- Response time: < 100ms (typical)
- Database check timeout: 3 seconds max
- Memory overhead: Minimal
- Safe for polling: Every 10-30 seconds

---

**Quick Reference Created**: October 27, 2025
**Endpoint Version**: 2.1.0
**Full Documentation**: See HEALTH_ENDPOINT_DOCUMENTATION.md
