# Revenue Optimization Engine - Quick Start Guide

## 5-Minute Setup

### Step 1: Run Database Migration (1 minute)

```bash
cd /Users/alejandrocaceres/Desktop/appstore.zodia/backend/flutter-horoscope-backend

# Connect to your database and run migration
psql -U your_username -d your_database -f migrations/012_create_revenue_optimization_tables.sql

# You should see: "Revenue Optimization tables created successfully!"
```

### Step 2: Enable Routes (1 minute)

Add this to `/src/app.js` (after line 267, before the webhook routes):

```javascript
const revenueRoutes = require("./routes/revenueOptimization");
app.use("/api/revenue", endpointLimits.api, revenueRoutes);
```

Add this to the admin routes section:

```javascript
const revenueDashboard = require("./controllers/revenueDashboardController");
app.get("/api/admin/revenue/metrics", revenueDashboard.getMetrics);
app.get("/api/admin/revenue/ltv", revenueDashboard.getLTVAnalytics);
app.get("/api/admin/revenue/offers", revenueDashboard.getOfferPerformance);
app.get("/api/admin/revenue/cohorts", revenueDashboard.getCohortAnalysis);
app.get("/api/admin/revenue/realtime", revenueDashboard.getRealtimeStats);
app.post("/api/admin/revenue/churn-prevention/bulk", revenueDashboard.triggerBulkChurnPrevention);
app.get("/api/admin/revenue/export", revenueDashboard.exportData);
```

### Step 3: Test the API (1 minute)

```bash
# Health check
curl http://localhost:3000/api/revenue/health

# API documentation
curl http://localhost:3000/api/revenue/docs

# Test dynamic pricing (replace with real userId)
curl -X POST http://localhost:3000/api/revenue/pricing/calculate \
  -H "Content-Type: application/json" \
  -d '{"userId":"test_user_123","tier":"cosmic"}'
```

### Step 4: Verify Integration (1 minute)

Check your server startup logs. You should see:

```
✅ All services initialized successfully
📊 Revenue Optimization Engine: Ready
```

Test the admin dashboard:

```bash
curl -H "x-admin-key: YOUR_ADMIN_KEY" \
  http://localhost:3000/api/admin/revenue/metrics
```

### Step 5: Start Tracking Events (1 minute)

Add event tracking to your app code:

```javascript
// Track paywall hits
app.post('/api/track/paywall', async (req, res) => {
  const { userId } = req.body;

  await db.query(`
    INSERT INTO user_events (user_id, event_type, created_at)
    VALUES ($1, 'paywall_hit', NOW())
  `, [userId]);

  res.json({ success: true });
});

// Track feature usage
app.post('/api/track/feature', async (req, res) => {
  const { userId, featureName } = req.body;

  await db.query(`
    INSERT INTO feature_usage (user_id, feature_name, created_at)
    VALUES ($1, $2, NOW())
  `, [userId, featureName]);

  res.json({ success: true });
});

// Update last active
app.post('/api/track/session', async (req, res) => {
  const { userId, duration } = req.body;

  await db.query(`
    UPDATE users SET last_active = NOW() WHERE user_id = $1
  `, [userId]);

  await db.query(`
    INSERT INTO user_analytics (user_id, session_duration, created_at)
    VALUES ($1, $2, NOW())
  `, [userId, duration]);

  res.json({ success: true });
});
```

---

## Common Use Cases

### Use Case 1: Show Personalized Price in Subscribe Screen

**Flutter/Dart:**
```dart
Future<double> getOptimalPrice(String userId, String tier) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/revenue/pricing/calculate'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'userId': userId, 'tier': tier}),
  );

  final data = jsonDecode(response.body);
  return data['pricing']['price'];
}

// In your subscribe widget
final price = await getOptimalPrice(userId, 'cosmic');
Text('\$${price.toStringAsFixed(2)}'); // Shows optimized price
```

### Use Case 2: Display Limited-Time Offer Banner

**Flutter/Dart:**
```dart
Future<Map?> checkForOffer(String userId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/revenue/offers/generate'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'userId': userId}),
  );

  final data = jsonDecode(response.body);

  if (data['hasOffer']) {
    return data['offer'];
  }
  return null;
}

// On app startup
final offer = await checkForOffer(userId);
if (offer != null) {
  showOfferBanner(
    message: offer['message'],
    discount: offer['offer']['discount'],
    expiresIn: offer['expiresIn'],
  );
}
```

### Use Case 3: Win Back Inactive Users (Cron Job)

**Node.js (Cron):**
```javascript
const cron = require('node-cron');

// Run daily at 10 AM
cron.schedule('0 10 * * *', async () => {
  console.log('Running churn prevention...');

  // Get high-risk users
  const query = `
    SELECT DISTINCT user_id, churn_probability
    FROM churn_interventions
    WHERE created_at > NOW() - INTERVAL '1 day'
      AND churn_probability > 0.7
    ORDER BY churn_probability DESC
    LIMIT 50
  `;

  const result = await db.query(query);

  for (const user of result.rows) {
    const churnPrediction = await revenueEngine.predictChurnProbability(user.user_id);

    if (churnPrediction.riskLevel === 'high') {
      await revenueEngine.preventChurn(user.user_id, churnPrediction);
      console.log(`Intervention sent to ${user.user_id}`);
    }
  }
});
```

### Use Case 4: A/B Test Pricing

**Admin Panel:**
```javascript
// Start experiment
async function startExperiment() {
  const response = await fetch('http://localhost:3000/api/revenue/experiment/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': 'YOUR_ADMIN_KEY'
    },
    body: JSON.stringify({
      tier: 'cosmic',
      duration: 14 // days
    })
  });

  const data = await response.json();
  console.log('Experiment ID:', data.experiment.experimentId);
}

// Check results after 14 days
async function checkResults(experimentId) {
  const response = await fetch(
    `http://localhost:3000/api/revenue/experiment/${experimentId}/results`,
    {
      headers: { 'x-admin-key': 'YOUR_ADMIN_KEY' }
    }
  );

  const data = await response.json();
  console.log('Winner:', data.results.winner);
  console.log('Recommendation:', data.results.recommendation);
}
```

---

## Testing Checklist

- [ ] Database migration completed successfully
- [ ] Routes enabled in app.js
- [ ] Health endpoint responds: `/api/revenue/health`
- [ ] Documentation accessible: `/api/revenue/docs`
- [ ] Dynamic pricing works for test user
- [ ] Offer generation returns personalized offer
- [ ] Churn prediction calculates probability
- [ ] Admin dashboard accessible with admin key
- [ ] Event tracking (paywall, features, sessions) working
- [ ] Database tables created and accessible

---

## Expected Impact Timeline

### Week 1-2: Setup & Data Collection
- ✅ Tables created
- ✅ Events tracking
- 📊 Collecting baseline metrics

### Week 3-4: Initial Optimization
- 🎯 Dynamic pricing active
- 📧 First offers sent
- 📈 +5-10% revenue increase

### Month 2: Full Deployment
- 🔥 Churn prevention active
- 💎 LTV strategies deployed
- 📈 +15-25% revenue increase

### Month 3+: Optimization & Scale
- 🧪 A/B experiments running
- 🤖 ML models refined
- 📈 +25-40% revenue increase
- 📉 30-50% churn reduction

---

## Quick Troubleshooting

**Problem:** "Table does not exist" error

**Solution:**
```bash
# Check if migration ran
psql -U your_username -d your_database -c "\dt *revenue*"

# If no tables, re-run migration
psql -U your_username -d your_database -f migrations/012_create_revenue_optimization_tables.sql
```

---

**Problem:** Prices are all the same

**Solution:**
```javascript
// Check user data exists
SELECT * FROM users WHERE user_id = 'test_user';

// Add test data
UPDATE users SET country = 'IN', last_active = NOW() WHERE user_id = 'test_user';

// Add engagement data
INSERT INTO user_analytics (user_id, session_duration, created_at)
VALUES ('test_user', 600, NOW());
```

---

**Problem:** No offers generated

**Solution:**
```javascript
// Check user is not premium
SELECT subscription_tier FROM users WHERE user_id = 'test_user';

// Check engagement score
SELECT COUNT(*) FROM user_analytics WHERE user_id = 'test_user';

// Add engagement if needed
INSERT INTO user_analytics (user_id, session_duration)
VALUES ('test_user', 300);
```

---

**Problem:** Admin endpoints return 403

**Solution:**
```bash
# Check admin key is set
echo $ADMIN_KEY

# Or in .env file
grep ADMIN_KEY .env

# Set if missing
echo "ADMIN_KEY=your_secret_key_here" >> .env
```

---

## Next Steps

1. **Monitor metrics**: Check `/api/admin/revenue/metrics` daily
2. **Analyze cohorts**: Review `/api/admin/revenue/cohorts` weekly
3. **Run experiments**: Test pricing monthly
4. **Optimize offers**: Review `/api/admin/revenue/offers` performance
5. **Prevent churn**: Monitor `/api/admin/revenue/realtime` for high-risk users

---

## Support

- **Full Documentation**: `REVENUE_OPTIMIZATION_ENGINE_DOCUMENTATION.md`
- **API Reference**: `http://localhost:3000/api/revenue/docs`
- **Health Check**: `http://localhost:3000/api/revenue/health`

**Ready to maximize revenue!** 🚀💰

Let the optimization begin!
