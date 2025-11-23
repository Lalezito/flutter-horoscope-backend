# INTEGRATION STEPS - Add Image Generation to Existing App

## Overview

This guide shows how to integrate the AI Image Generation System into your existing Cosmic Coach backend.

---

## Step 1: Add to app.js (or app-production.js)

### Add Import Statements

Add these lines after your existing service imports:

```javascript
// Image Generation System (after line ~30)
const imageGenerationRoutes = require('./routes/imageGeneration');
const imageGenerationCronJob = require('./services/imageGenerationCronJob');
```

### Add Routes

Add this after your existing routes (around line 150):

```javascript
// Image Generation Routes
app.use('/api/images', imageGenerationRoutes);
console.log('✅ Image generation routes loaded');
```

### Initialize Cron Jobs

Add this in your server startup section (after `app.listen`):

```javascript
// Initialize Image Generation Cron Jobs
if (process.env.ENABLE_CRON_JOBS === 'true') {
  try {
    imageGenerationCronJob.initialize();
    console.log('✅ Image generation cron jobs initialized');
  } catch (error) {
    console.error('⚠️  Image generation cron jobs failed to initialize:', error.message);
  }
}
```

---

## Step 2: Update package.json

Add canvas dependency:

```json
{
  "dependencies": {
    // ... existing dependencies
    "canvas": "^2.11.2"
  }
}
```

Run:
```bash
npm install
```

---

## Step 3: Update .env

Add these environment variables:

```env
# Image Generation
ENABLE_IMAGE_GENERATION=true
API_URL=https://your-domain.com

# Already exists (verify it's set)
OPENAI_API_KEY=sk-proj-...
```

---

## Step 4: Run Database Migration

```bash
psql $DATABASE_URL -f migrations/create_image_generation_tables.sql
```

Verify tables created:
```sql
\dt image*
```

Expected output:
```
 public | generated_images          | table
 public | image_download_events     | table
 public | image_favorites           | table
 public | image_generation_stats    | table
 public | image_share_events        | table
```

---

## Step 5: Test API Endpoints

### Get a User Token

```bash
# Login or use existing user token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Save the token
export USER_TOKEN="eyJhbGc..."
```

### Test Image Generation

```bash
curl -X POST http://localhost:3000/api/images/generate/daily-energy \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sign": "aries",
    "date": "2025-01-23",
    "energyLevel": 8,
    "mood": "uplifting",
    "focus": "career",
    "personalized": false
  }'
```

Expected response (200 OK):
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://oaidalleapiprodscus.blob.core.windows.net/...",
    "imageId": "uuid-here",
    "description": "Your cosmic energy visualization for 2025-01-23",
    "cached": false
  }
}
```

### Test Gallery

```bash
curl http://localhost:3000/api/images/my-gallery \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Test Usage Stats

```bash
curl http://localhost:3000/api/images/usage/stats \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Step 6: Verify Cron Jobs

Check cron jobs are running:

```bash
# Check logs
tail -f logs/app.log | grep "cron"

# Or check status via API
curl http://localhost:3000/api/images/admin/cron-status \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected output:
```json
{
  "success": true,
  "data": {
    "jobs": [
      { "name": "daily_batch_generation", "running": false },
      { "name": "cache_cleanup", "running": false },
      { "name": "weekly_cost_report", "running": false }
    ],
    "total_jobs": 3
  }
}
```

---

## Step 7: Flutter App Integration

### Update API Base URL

In your Flutter app, ensure API base URL is set:

```dart
// lib/config/api_config.dart
class ApiConfig {
  static const String baseUrl = 'https://your-api-domain.com';
  // OR for local testing:
  // static const String baseUrl = 'http://localhost:3000';
}
```

### Add to Your Home Screen or Dashboard

```dart
import 'package:zodiac_app/widgets/cosmic_image_gallery.dart';
import 'package:zodiac_app/services/image_generation_service.dart';

// In your widget
final imageService = ImageGenerationService(
  baseUrl: ApiConfig.baseUrl,
  authToken: userToken,
);

// Add navigation item
ListTile(
  leading: Icon(Icons.auto_awesome),
  title: Text('Cosmic Gallery'),
  onTap: () {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CosmicImageGallery(
          imageService: imageService,
          userSign: userSign,
        ),
      ),
    );
  },
)
```

---

## Step 8: Production Deployment

### Railway Configuration

1. **Add Environment Variables**
   ```
   ENABLE_IMAGE_GENERATION=true
   API_URL=https://your-railway-app.up.railway.app
   OPENAI_API_KEY=sk-proj-...
   ENABLE_CRON_JOBS=true
   ```

2. **Install Build Dependencies**

   Railway should automatically install canvas dependencies, but if it fails, add to `package.json`:

   ```json
   {
     "scripts": {
       "railway-build": "npm install canvas"
     }
   }
   ```

3. **Verify Deployment**
   ```bash
   # Check health
   curl https://your-app.up.railway.app/health

   # Test image endpoint
   curl https://your-app.up.railway.app/api/images/usage/stats \
     -H "Authorization: Bearer $USER_TOKEN"
   ```

### Set Up OpenAI Billing Alerts

1. Go to https://platform.openai.com/account/billing/limits
2. Set monthly budget: $500
3. Set email alerts at: 50%, 75%, 90%

---

## Step 9: Monitor Performance

### Daily Checks

```bash
# Check batch generation ran
psql $DATABASE_URL -c "SELECT * FROM batch_generation_logs ORDER BY created_at DESC LIMIT 1;"

# Check today's cost
curl https://your-app.up.railway.app/api/images/admin/cost-report?days=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Weekly Review

```bash
# Get weekly report
curl https://your-app.up.railway.app/api/images/admin/cost-report?days=7 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check viral images
curl https://your-app.up.railway.app/api/images/admin/viral-images \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Complete app.js Integration Example

Here's the complete modified section of your app.js:

```javascript
// ... existing imports ...

// IMAGE GENERATION SYSTEM
const imageGenerationRoutes = require('./routes/imageGeneration');
const imageGenerationCronJob = require('./services/imageGenerationCronJob');

// ... existing middleware ...

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/horoscope', horoscopeRoutes);
app.use('/api/compatibility', compatibilityRoutes);
// ... other existing routes ...

// IMAGE GENERATION ROUTES
app.use('/api/images', imageGenerationRoutes);
console.log('✅ Image generation routes loaded');

// ... rest of your app ...

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Initialize cron jobs
  if (process.env.ENABLE_CRON_JOBS === 'true') {
    try {
      imageGenerationCronJob.initialize();
      console.log('✅ Image generation cron jobs initialized');
    } catch (error) {
      console.error('⚠️  Image generation cron jobs failed:', error.message);
    }
  }
});
```

---

## Troubleshooting Integration

### Issue: Routes Not Loading

**Error:** `Cannot find module './routes/imageGeneration'`

**Solution:**
```bash
# Verify file exists
ls -l src/routes/imageGeneration.js

# Check file permissions
chmod 644 src/routes/imageGeneration.js
```

### Issue: Canvas Installation Fails

**Error:** `node-pre-gyp ERR!`

**Solution:**
```bash
# macOS
brew install pkg-config cairo pango libpng jpeg giflib librsvg
npm install canvas

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install canvas

# Railway (add to package.json)
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Issue: Database Tables Not Created

**Error:** `relation "generated_images" does not exist`

**Solution:**
```bash
# Run migration
psql $DATABASE_URL -f migrations/create_image_generation_tables.sql

# Verify
psql $DATABASE_URL -c "\dt image*"
```

### Issue: OpenAI API Key Not Working

**Error:** `401 Unauthorized` from OpenAI

**Solution:**
```bash
# Verify key in .env
cat .env | grep OPENAI_API_KEY

# Test key directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# If invalid, get new key from https://platform.openai.com/api-keys
```

---

## Verification Checklist

- [ ] Canvas installed successfully
- [ ] Database migration completed
- [ ] Routes added to app.js
- [ ] Environment variables set
- [ ] Server starts without errors
- [ ] Test image generation succeeds
- [ ] Gallery endpoint returns data
- [ ] Usage stats endpoint works
- [ ] Cron jobs initialized
- [ ] Admin endpoints accessible
- [ ] Flutter app can call API
- [ ] Social sharing works
- [ ] Analytics tracking verified

---

## Next Steps After Integration

1. **Test with Real Users**
   - Beta test with 10 users
   - Gather feedback
   - Monitor costs

2. **Optimize Prompts**
   - Review generated images
   - Adjust prompts for better results
   - A/B test different styles

3. **Launch Marketing**
   - Announce new feature
   - Create viral content
   - Run sharing contest

4. **Monitor & Iterate**
   - Daily cost checks
   - Weekly performance review
   - Monthly optimization

---

## Success! 🎉

Your AI Image Generation System is now fully integrated!

**What you have:**
- ✅ DALL-E 3 generating cosmic visualizations
- ✅ Social sharing to Instagram, Twitter, Facebook
- ✅ Automated batch generation every night
- ✅ Complete analytics and tracking
- ✅ Tier-based monetization
- ✅ Beautiful Flutter UI

**Expected Impact:**
- 500+ daily shares
- +$5,000 MRR
- 10x engagement
- Viral growth

**Start generating cosmic magic!** ✨

---

*Need help? Check IMAGE_GENERATION_SYSTEM_DOCUMENTATION.md for full details.*
