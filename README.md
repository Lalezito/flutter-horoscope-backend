# 🌟 Enhanced Zodiac Backend v2.0

A production-ready Node.js backend for horoscope applications with daily and weekly predictions, monitoring, analytics, and recovery systems.

## ✨ Key Features

### 🔮 Horoscope Management
- **Daily Horoscopes:** Existing n8n integration (72 combinations)
- **Weekly Horoscopes:** NEW! Monday generation (72 combinations)
- **Multi-language:** 6 languages (es, en, de, fr, it, pt)
- **12 Zodiac Signs:** Complete coverage

### 🛡️ Production Features
- **Advanced Rate Limiting:** Adaptive limits with IP tracking
- **Security Headers:** XSS, CSRF, injection protection
- **Request Validation:** Malicious pattern detection
- **Error Handling:** Comprehensive logging and alerts

### 📊 Monitoring & Analytics
- **Health Checks:** Basic and comprehensive endpoints
- **Usage Analytics:** API usage patterns and metrics
- **Error Logging:** Detailed error tracking
- **System Monitoring:** Automated health checks every 5 minutes

### 🔄 Recovery Systems
- **Automatic Fallbacks:** Generate missing horoscopes from daily data
- **Manual Recovery:** Admin endpoints for force generation
- **Data Cleanup:** Automated old data removal
- **Alert System:** Webhook notifications for issues

### 👑 Admin Panel
- **Analytics Dashboard:** Comprehensive system metrics
- **System Status:** Detailed health information
- **Manual Controls:** Force generation, cleanup, alerts
- **Secure Access:** Admin key authentication

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database
```bash
# Run migrations
psql $DATABASE_URL -f migrations/001_create_weekly_horoscopes.sql
psql $DATABASE_URL -f migrations/002_create_analytics_tables.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Start Development
```bash
npm run dev
```

### 5. Deploy to Production
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🌐 API Endpoints

### Health & Status
- `GET /health` - Basic health check
- `GET /ping` - Simple ping response
- `GET /api/docs` - API documentation

### Daily Horoscopes (Existing)
- `GET /api/coaching/getDailyHoroscope?sign=Aries&lang=es`
- `GET /api/coaching/getAllHoroscopes?lang=es`
- `POST /api/coaching/notify` - n8n webhook

### Weekly Horoscopes (NEW!)
- `GET /api/weekly/getWeeklyHoroscope?sign=Aries&lang=es`
- `GET /api/weekly/getAllWeeklyHoroscopes?lang=es`
- `GET /api/weekly/checkMissing?admin_key=KEY`

### Admin Panel (NEW!)
- `GET /api/admin/health?admin_key=KEY` - Comprehensive health
- `GET /api/admin/analytics?admin_key=KEY` - System analytics
- `GET /api/admin/system-status?admin_key=KEY` - Detailed status
- `POST /api/admin/force-weekly?admin_key=KEY` - Force generation
- `POST /api/admin/cleanup?admin_key=KEY` - System cleanup
- `POST /api/admin/test-alert?admin_key=KEY` - Test alerts

## 📁 Project Structure

```
src/
├── app.js                          # Main application
├── config/
│   ├── database.js                 # Database connection
│   └── db.js                       # Database utilities
├── controllers/
│   ├── coachingController.js       # Daily horoscopes (enhanced)
│   ├── weeklyController.js         # Weekly horoscopes (NEW)
│   ├── recoveryController.js       # Recovery systems (NEW)
│   └── monitoringController.js     # Monitoring & analytics (NEW)
├── middleware/
│   └── rateLimiter.js             # Security & rate limiting (NEW)
└── routes/
    ├── coaching.js                 # Daily horoscope routes
    ├── weekly.js                   # Weekly horoscope routes (NEW)
    └── admin.js                    # Admin panel routes (NEW)

migrations/                         # Database migrations (NEW)
├── 001_create_weekly_horoscopes.sql
└── 002_create_analytics_tables.sql
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Security  
ADMIN_KEY=your_super_secret_admin_key

# Optional: External alerts
WEBHOOK_ALERT_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Optional: CORS
ALLOWED_ORIGINS=https://yourapp.com,https://yourdomain.com

# Environment
NODE_ENV=production
```

### Rate Limiting

Default limits per minute:
- **Regular API:** 200 requests
- **Admin endpoints:** 10 requests  
- **Webhooks:** 20 requests per 5 minutes
- **Health checks:** 500 requests

## 🔄 n8n Integration

### Daily Workflow (Existing)
- **Trigger:** Daily at 6 AM
- **Endpoint:** `POST /api/coaching/notify`
- **Payload:** Daily horoscope data

### Weekly Workflow (NEW!)
- **Trigger:** Every Monday at 6 AM  
- **Endpoint:** `POST /api/coaching/notify`
- **Payload:** 
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
        "general": "Weekly general content...",
        "love": "Weekly love prediction...",
        "health": "Weekly health advice...",
        "money": "Weekly money forecast...",
        "weekly_trend": "Main trend for the week"
      }
    }
    // ... 71 more combinations
  ]
}
```

## 📊 Monitoring

### Automated Systems
- **Health Checks:** Every 5 minutes
- **Data Cleanup:** Every 6 hours  
- **Error Tracking:** Real-time logging
- **Alert System:** Webhook notifications

### Manual Monitoring
```bash
# Check system health
curl https://your-app.com/api/admin/health?admin_key=KEY

# View analytics
curl https://your-app.com/api/admin/analytics?admin_key=KEY

# System status
curl https://your-app.com/api/admin/system-status?admin_key=KEY
```

## 🛠️ Development

### Scripts
```bash
npm run dev      # Development with nodemon
npm start        # Production start
```

### Testing
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test weekly horoscope
curl "http://localhost:3000/api/weekly/getWeeklyHoroscope?sign=Aries&lang=es"

# Test admin panel (set ADMIN_KEY first)
curl "http://localhost:3000/api/admin/health?admin_key=your_key"
```

## 🚨 Recovery & Fallbacks

### Missing Weekly Horoscopes
If n8n fails to generate weekly horoscopes, the system can:
1. **Detect missing data** automatically
2. **Generate fallbacks** from recent daily horoscopes
3. **Create generic content** if no daily data exists
4. **Send alerts** via webhook

### Manual Recovery
```bash
# Force generate missing weekly horoscopes
curl -X POST "https://your-app.com/api/admin/force-weekly?admin_key=KEY"
```

## 🔒 Security

### Features
- **Rate Limiting:** Per-IP adaptive limits
- **Request Validation:** Malicious pattern detection
- **Security Headers:** XSS, injection, clickjacking protection
- **Admin Authentication:** Secret key verification
- **IP Tracking:** Suspicious IP flagging

### Best Practices
- Use strong `ADMIN_KEY`
- Enable HTTPS in production
- Configure `ALLOWED_ORIGINS` for CORS
- Monitor admin endpoints usage
- Regularly review error logs

## 📈 Performance

### Optimizations
- **Database Indexing:** Optimized queries
- **Memory Management:** Automated cleanup
- **Response Caching:** Rate limit headers
- **Efficient Logging:** Async operations

### Monitoring
- **Response Times:** <200ms target
- **Memory Usage:** Tracked and cleaned
- **Error Rates:** <0.1% target
- **Uptime:** >99.9% target

## 🎯 Deployment Checklist

- [ ] Database migrations completed
- [ ] Environment variables set
- [ ] Weekly n8n workflow created  
- [ ] Health checks responding
- [ ] Rate limiting active
- [ ] Analytics logging data
- [ ] Alert system configured
- [ ] Recovery system tested

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📞 Support

- **Health Status:** `/health`
- **API Documentation:** `/api/docs`
- **System Status:** `/api/admin/system-status`
- **Issues:** GitHub Issues

---

**🌟 Enhanced Zodiac Backend v2.0 - Production-ready horoscope API with monitoring, analytics, and recovery systems!**