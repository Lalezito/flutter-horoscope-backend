# 🚀 Enhanced Zodiac Backend - Deployment Guide

## Overview

This enhanced backend provides production-ready horoscope services with weekly predictions, monitoring, analytics, and recovery systems.

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Railway account (or alternative hosting)
- Environment variables configured

## 🗄️ Database Setup

### 1. Run Migrations

Execute these SQL files in order on your PostgreSQL database:

```bash
# 1. Create weekly horoscopes table
psql $DATABASE_URL -f migrations/001_create_weekly_horoscopes.sql

# 2. Create analytics and monitoring tables  
psql $DATABASE_URL -f migrations/002_create_analytics_tables.sql
```

### 2. Verify Tables Created

```sql
-- Check that all tables exist
\dt

-- Expected tables:
-- daily_horoscopes (existing)
-- weekly_horoscopes (new)
-- usage_analytics (new)
-- system_health_logs (new)
-- error_logs (new)
```

## ⚙️ Environment Variables

Configure these environment variables in Railway or your hosting platform:

```bash
# Database (Railway provides this automatically)
DATABASE_URL=postgresql://user:password@host:port/database

# Security
ADMIN_KEY=your_super_secret_admin_key_here

# Optional: External alert webhook (Discord, Slack, etc.)
WEBHOOK_ALERT_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Environment
NODE_ENV=production

# Optional: CORS configuration
ALLOWED_ORIGINS=https://yourapp.com,https://yourdomain.com
```

## 📦 Railway Deployment

### 1. Deploy to Railway

```bash
# If using Railway CLI
railway login
railway link
railway up
```

### 2. Set Environment Variables

```bash
railway variables set ADMIN_KEY=your_secret_key
railway variables set NODE_ENV=production
railway variables set WEBHOOK_ALERT_URL=your_webhook_url
```

### 3. Run Database Migrations

```bash
# Connect to Railway PostgreSQL
railway connect

# Then run the migration files:
\i migrations/001_create_weekly_horoscopes.sql
\i migrations/002_create_analytics_tables.sql
```

## 🔄 n8n Workflow Updates

### Daily Horoscopes (Existing)
Keep your current n8n workflow that runs daily at 6 AM.

### Weekly Horoscopes (New)
Create a new n8n workflow for weekly horoscopes:

**Trigger:** Every Monday at 6 AM
```
Cron: 0 6 * * 1
```

**Webhook Payload:**
```json
{
  "type": "weekly",
  "horoscopes": [
    {
      "sign": "Aries",
      "language_code": "es", 
      "week_start": "2025-08-25",
      "week_end": "2025-08-31",
      "content": {
        "general": "Contenido general de la semana...",
        "love": "Predicción de amor...",
        "health": "Consejos de salud...",
        "money": "Finanzas de la semana...",
        "weekly_trend": "Tendencia principal"
      }
    }
    // ... 71 more combinations (12 signs × 6 languages)
  ]
}
```

**Send to:** `POST https://your-railway-app.com/api/coaching/notify`

## 🏥 Health Monitoring

### Health Check Endpoints

```bash
# Basic health check
curl https://your-app.railway.app/health

# Comprehensive admin health check
curl "https://your-app.railway.app/api/admin/health?admin_key=YOUR_KEY"
```

### Automated Monitoring

The system automatically:
- Checks health every 5 minutes
- Sends alerts for missing horoscopes  
- Cleans up old data every 6 hours
- Monitors API usage patterns

### Manual Recovery

If weekly horoscopes are missing:

```bash
# Force generate missing weekly horoscopes
curl -X POST "https://your-app.railway.app/api/admin/force-weekly?admin_key=YOUR_KEY"
```

## 📊 Analytics Dashboard

Access system analytics:

```bash
curl "https://your-app.railway.app/api/admin/analytics?admin_key=YOUR_KEY"
```

View detailed system status:

```bash
curl "https://your-app.railway.app/api/admin/system-status?admin_key=YOUR_KEY"
```

## 🔧 Maintenance

### Manual Cleanup

```bash
# Clean up old data and perform maintenance
curl -X POST "https://your-app.railway.app/api/admin/cleanup?admin_key=YOUR_KEY"
```

### Test Alert System

```bash
# Test your alert webhook
curl -X POST "https://your-app.railway.app/api/admin/test-alert?admin_key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test alert", "type": "info"}'
```

## 🛡️ Security Features

### Rate Limiting
- **API Endpoints:** 200 requests/minute per IP
- **Admin Endpoints:** 10 requests/minute per IP  
- **Webhooks:** 20 requests/5 minutes per IP
- **Adaptive:** Reduces limits for suspicious IPs

### Security Headers
- XSS Protection
- Content Type Sniffing Prevention
- Frame Options
- Cache Control

### Request Validation
- URL length limits
- Malicious pattern detection
- SQL injection prevention
- XSS attempt blocking

## 📚 API Documentation

Visit your deployed app:
```
https://your-app.railway.app/api/docs
```

### New Endpoints

**Weekly Horoscopes:**
- `GET /api/weekly/getWeeklyHoroscope?sign=Aries&lang=es`
- `GET /api/weekly/getAllWeeklyHoroscopes?lang=es`

**Admin Panel:**
- `GET /api/admin/health?admin_key=KEY`
- `GET /api/admin/analytics?admin_key=KEY`
- `POST /api/admin/force-weekly?admin_key=KEY`
- `POST /api/admin/cleanup?admin_key=KEY`

## 🚨 Alerting Setup

### Slack Integration
1. Create a Slack webhook: https://api.slack.com/messaging/webhooks
2. Set `WEBHOOK_ALERT_URL` environment variable
3. Test with the admin panel

### Discord Integration  
1. Create a Discord webhook in your server
2. Set `WEBHOOK_ALERT_URL` environment variable
3. Test alerts

## 📈 Monitoring Checklist

- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Weekly n8n workflow created
- [ ] Health checks responding
- [ ] Rate limiting working
- [ ] Analytics logging data
- [ ] Alert system tested
- [ ] Recovery system tested

## 🔍 Troubleshooting

### Weekly Horoscopes Not Generating
1. Check n8n workflow is running Mondays at 6 AM
2. Verify webhook payload format matches expected schema
3. Use recovery endpoint to manually generate missing ones
4. Check system health and error logs

### High Memory Usage
```bash
# Check system status
curl "https://your-app.railway.app/api/admin/system-status?admin_key=YOUR_KEY"

# Run cleanup
curl -X POST "https://your-app.railway.app/api/admin/cleanup?admin_key=YOUR_KEY"
```

### Rate Limiting Issues
- Check if IP is flagged as suspicious
- Verify rate limit headers in responses
- Adjust limits in `middleware/rateLimiter.js` if needed

## 🎯 Success Metrics

After deployment, monitor:
- **Uptime:** Should be >99.9%
- **Response Time:** <200ms average
- **Error Rate:** <0.1%
- **Coverage:** 100% daily and weekly horoscopes
- **Memory Usage:** Stable over time

## 📞 Support

- Health status: `/health`
- API docs: `/api/docs`  
- System status: `/api/admin/system-status`
- GitHub Issues: [Report problems](https://github.com/your-repo/issues)

---

**✅ Your enhanced Zodiac Backend is now production-ready with weekly horoscopes, monitoring, and recovery systems!**