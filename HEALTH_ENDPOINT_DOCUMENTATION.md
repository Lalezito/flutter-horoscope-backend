# Health Check Endpoint Documentation

## Overview

The `/health` endpoint provides comprehensive monitoring of all backend services and infrastructure components. This endpoint is essential for:
- Load balancer health checks
- Monitoring and alerting systems
- DevOps automation
- Service mesh integration
- Production readiness validation

## Endpoint Details

### GET /health

**URL**: `http://localhost:3000/health` (development) or `https://your-domain.com/health` (production)

**Method**: GET

**Authentication**: None (public endpoint)

**Response Format**: JSON

**Response Codes**:
- `200 OK` - All critical services are operational
- `503 Service Unavailable` - Database connection failed (critical service down)
- `500 Internal Server Error` - Health check itself failed

## Response Schema

```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T09:38:30.736Z",
  "version": "2.1.0",
  "services": {
    "api": "operational",
    "database": "connected",
    "firebase": {
      "status": "initialized",
      "hasServiceAccount": false
    },
    "cache": {
      "mode": "mock",
      "status": "operational"
    },
    "redis": {
      "status": "fallback",
      "mode": "fallback"
    }
  },
  "uptime": 17,
  "environment": "production",
  "memory": {
    "used": 32,
    "total": 111,
    "unit": "MB"
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall system health status: "healthy" or "unhealthy" |
| `timestamp` | string (ISO 8601) | Current server time in UTC |
| `version` | string | Backend API version |
| `services.api` | string | API service status: "operational" |
| `services.database` | string | Database connection status: "connected", "disconnected", "timeout", "error", "unknown" |
| `services.firebase.status` | string | Firebase initialization status: "initialized" or "mock" |
| `services.firebase.hasServiceAccount` | boolean | Whether Firebase service account credentials are configured |
| `services.cache.mode` | string | Cache service mode: "redis", "memory", or "mock" |
| `services.cache.status` | string | Cache service status: "operational" |
| `services.redis.status` | string | Redis connection status: "connected" or "fallback" |
| `services.redis.mode` | string | Redis mode: "redis" or "fallback" (in-memory) |
| `uptime` | number | Server uptime in seconds |
| `environment` | string | Current environment: "development", "production", etc. |
| `memory.used` | number | Heap memory used in MB |
| `memory.total` | number | Total heap memory allocated in MB |
| `memory.unit` | string | Memory unit: "MB" |

## Service Status Details

### Database Status
- **connected**: PostgreSQL database is connected and responding
- **disconnected**: Unable to connect to database
- **timeout**: Database connection attempt timed out (>3 seconds)
- **error**: Database connection error occurred
- **unknown**: Status could not be determined

### Firebase Status
- **initialized**: Firebase Admin SDK is initialized with service account
- **mock**: Running in mock mode (development/testing without credentials)

### Cache Mode
- **redis**: Using Redis for distributed caching
- **memory**: Using in-memory caching (single instance)
- **mock**: Using mock cache service (development/testing)

### Redis Status
- **connected**: Redis server is connected and operational
- **fallback**: Using in-memory fallback (Redis not configured or unavailable)

## Usage Examples

### Basic Health Check (curl)
```bash
curl http://localhost:3000/health
```

### Check HTTP Status Code
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health
```

### Health Check with Pretty JSON
```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

### Monitor Database Status
```bash
curl -s http://localhost:3000/health | jq '.services.database'
```

### Monitor Memory Usage
```bash
curl -s http://localhost:3000/health | jq '.memory'
```

### Docker Health Check (Dockerfile)
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Kubernetes Liveness Probe (kubernetes.yaml)
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

### Railway Health Check Configuration
Railway automatically monitors this endpoint when deployed.

## Monitoring Integration

### Prometheus Metrics
The health endpoint can be scraped by Prometheus for monitoring:

```yaml
scrape_configs:
  - job_name: 'zodiac-backend'
    metrics_path: '/health'
    static_configs:
      - targets: ['backend:3000']
```

### Uptime Monitoring (UptimeRobot, Pingdom, etc.)
Configure your uptime monitoring service to check:
- URL: `https://your-domain.com/health`
- Interval: 5 minutes
- Expected Status: 200
- Expected Content: `"status":"healthy"`

### Application Monitoring (Datadog, New Relic, etc.)
Use the health endpoint for:
- Service availability checks
- Response time monitoring
- Service dependency tracking
- Alert configuration

## Critical vs Non-Critical Services

### Critical Services (affect HTTP status code)
- **Database**: If disconnected, endpoint returns 503 status

### Non-Critical Services (don't affect HTTP status code)
- **Firebase**: Mock mode is acceptable for some operations
- **Redis**: Fallback mode uses in-memory storage
- **Cache**: Mock mode is acceptable for development

## Testing

### Unit Test Example (Jest)
```javascript
test('health endpoint returns 200 and correct structure', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('status', 'healthy');
  expect(response.body).toHaveProperty('version', '2.1.0');
  expect(response.body.services).toHaveProperty('database');
  expect(response.body.services).toHaveProperty('api', 'operational');
});
```

### Integration Test
```bash
# Start server
npm start &

# Wait for startup
sleep 5

# Test health endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ $STATUS -eq 200 ]; then
  echo "Health check passed"
  exit 0
else
  echo "Health check failed with status $STATUS"
  exit 1
fi
```

## Troubleshooting

### Database Shows "timeout"
- Check DATABASE_URL environment variable
- Verify PostgreSQL is running and accessible
- Check network connectivity
- Review firewall rules

### Database Shows "error"
- Check database credentials
- Verify database exists
- Check PostgreSQL logs
- Review SSL/TLS configuration

### Firebase Shows "mock"
- Normal for development environment
- For production, set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CONFIG
- Verify service account JSON is valid

### Redis Shows "fallback"
- Normal when Redis is not configured
- For production scaling, configure REDIS_URL
- Verify Redis server is running
- Check Redis connection credentials

### High Memory Usage
- Monitor `memory.used` and `memory.total`
- Consider increasing NODE_OPTIONS="--max-old-space-size=4096"
- Review memory leaks
- Check for unhandled promises

## Related Endpoints

- **GET /ping**: Simple availability check (lightweight)
- **GET /api/docs**: API documentation with all available endpoints
- **GET /api/admin/health**: Detailed admin health check (requires admin_key)

## Version History

- **v2.1.0** (2025-10-27): Enhanced health check with comprehensive service monitoring
  - Added database connection status
  - Added Redis health monitoring
  - Added memory usage metrics
  - Added environment information
  - Improved error handling with proper HTTP status codes

- **v2.0.0**: Basic health check with Firebase and cache status

## Security Considerations

- The health endpoint is public (no authentication required)
- Sensitive information (credentials, keys) is not exposed
- Error messages are sanitized in production
- Database connection details are not revealed
- Use `/api/admin/health` for detailed diagnostics (requires authentication)

## Performance

- Response time: < 100ms (typical)
- Database check timeout: 3 seconds
- No heavy computation or external API calls
- Suitable for frequent polling (every 10-30 seconds)

## Best Practices

1. **Monitor regularly**: Check every 1-5 minutes in production
2. **Set up alerts**: Alert on 503 status or high response times
3. **Use caching**: Cache health check results for load balancers
4. **Check dependencies**: Verify all critical services are monitored
5. **Log failures**: Review logs when health checks fail
6. **Test failover**: Ensure monitoring detects failures correctly
7. **Document SLAs**: Define acceptable uptime and response times

## Support

For issues or questions about the health endpoint:
- Check backend logs: `logs/error.log`
- Review environment variables: `.env` or `.env.production`
- Verify service dependencies are running
- Contact DevOps team for infrastructure issues
