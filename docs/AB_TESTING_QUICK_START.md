# A/B Testing - Quick Start Guide

## 🚀 Get Started in 10 Minutes

### Step 1: Run Migration (1 minute)

```bash
cd /Users/alejandrocaceres/Desktop/appstore.zodia/backend/flutter-horoscope-backend
node migrations/015_create_ab_testing_tables.js
```

Expected output:
```
✅ A/B Testing tables created successfully
```

---

### Step 2: Add Routes to App (2 minutes)

Edit `src/app.js` and add:

```javascript
// Add at top with other requires
const abTestingRoutes = require('./routes/abTesting');

// Add with other routes (around line 50-60)
app.use('/api/ab-testing', abTestingRoutes);
```

Restart your server:
```bash
npm start
```

---

### Step 3: Create Your First Test (2 minutes)

Create a file `test-ab-framework.js`:

```javascript
const ABTestTemplates = require('./src/services/abTestTemplates');
const abTestingService = require('./src/services/abTestingService');

async function createFirstTest() {
  // Use pre-built paywall template
  const testConfig = ABTestTemplates.paywallMessage();

  const test = await abTestingService.createTest(testConfig);

  console.log('✅ Test created!');
  console.log('Test ID:', test.id);
  console.log('Name:', test.name);
  console.log('Variants:', test.variants.length);

  return test;
}

createFirstTest()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
```

Run it:
```bash
node test-ab-framework.js
```

---

### Step 4: Integrate Into Your App (3 minutes)

#### Option A: Automatic (Recommended)

Add middleware to your app:

```javascript
// In src/app.js
const { autoAssignTests, applyVariantConfig } = require('./middleware/abTestingMiddleware');

// Add after authentication middleware
app.use(autoAssignTests);
app.use(applyVariantConfig());
```

Now ALL responses include A/B test assignments automatically!

#### Option B: Manual

In your paywall endpoint:

```javascript
app.get('/api/paywall', async (req, res) => {
  const userId = req.user.firebaseUid;
  const testId = 1; // From Step 3

  // Assign user to variant
  const assignment = await abTestingService.assignUserToVariant(userId, testId);

  res.json({
    message: assignment.config.paywallMessage,
    cta: assignment.config.cta
  });
});
```

---

### Step 5: Track Conversions (2 minutes)

When user subscribes:

```javascript
app.post('/api/subscribe', async (req, res) => {
  const userId = req.user.firebaseUid;

  // Your subscription logic...

  // Track conversion
  await abTestingService.trackEvent(userId, 1, 'conversion', {
    amount: req.body.amount
  });

  res.json({ success: true });
});
```

---

## 🎯 Check Results

### View Results in Code

```javascript
const results = await abTestingService.getTestResults(1);

console.log('Progress:', results.progress + '%');
console.log('Control:', results.results.control.conversionRate + '%');
console.log('Variant:', results.results.emotional.conversionRate + '%');

if (results.analysis.winner) {
  console.log('🎉 Winner:', results.analysis.winner);
  console.log('Impact:', results.analysis.projectedAnnualImpact);
}
```

### Via API

```bash
# Get results
curl http://localhost:3000/api/ab-testing/tests/1/results \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Dashboard (Optional)

Create a simple admin page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>A/B Testing Dashboard</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    .test { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
    .winner { background: #d4edda; }
  </style>
</head>
<body>
  <h1>A/B Tests</h1>
  <div id="tests"></div>

  <script>
    async function loadTests() {
      const response = await fetch('/api/ab-testing/tests');
      const data = await response.json();

      const html = data.data.map(test => `
        <div class="test">
          <h3>${test.name}</h3>
          <p>Status: ${test.status}</p>
          <button onclick="viewResults(${test.id})">View Results</button>
        </div>
      `).join('');

      document.getElementById('tests').innerHTML = html;
    }

    async function viewResults(testId) {
      const response = await fetch(`/api/ab-testing/tests/${testId}/results`);
      const data = await response.json();
      console.log(data);
      alert(JSON.stringify(data.data, null, 2));
    }

    loadTests();
  </script>
</body>
</html>
```

---

## 🎨 Available Templates

Use pre-built templates for common tests:

```javascript
const ABTestTemplates = require('./src/services/abTestTemplates');

// Paywall messaging
const paywallTest = ABTestTemplates.paywallMessage();

// Pricing
const pricingTest = ABTestTemplates.pricing('cosmic');

// Trial length
const trialTest = ABTestTemplates.trialLength();

// Feature limits
const limitsTest = ABTestTemplates.featureLimits();

// CTA buttons
const ctaTest = ABTestTemplates.ctaButton();

// Notification timing
const notifTest = ABTestTemplates.notificationTiming();

// Onboarding flow
const onboardingTest = ABTestTemplates.onboardingFlow();

// Social proof
const socialTest = ABTestTemplates.socialProof();

// Color scheme
const colorTest = ABTestTemplates.colorScheme();

// Discount timing
const discountTest = ABTestTemplates.discountTiming();

// Get all templates
const all = ABTestTemplates.getAllTemplates();

// Get by name
const template = ABTestTemplates.getTemplate('paywallMessage');
```

---

## 🤖 Automated Monitoring

Set up daily checks:

```javascript
const cron = require('node-cron');

// Check for winners every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  const activeTests = await abTestingService.getActiveTests();

  for (const test of activeTests) {
    const winner = await abTestingService.checkForWinner(test.id);

    if (winner) {
      console.log('🎉 Winner found for test', test.id);
      // Send notification to team
    }
  }
});
```

---

## 💰 Revenue Analysis

Calculate impact:

```javascript
const revenueImpactCalculator = require('./src/services/revenueImpactCalculator');

const results = await abTestingService.getTestResults(1);

const impact = await revenueImpactCalculator.calculateImpact(results, {
  monthlyUsers: 10000,
  avgOrderValue: 10
});

console.log('Monthly Impact:', impact.variants[0].impact.monthly);
console.log('Annual Impact:', impact.variants[0].impact.annual);
console.log('Recommendation:', impact.bestVariant.recommendation);
```

---

## 🔥 First Month Plan

### Week 1: Paywall Message
```javascript
const test1 = await abTestingService.createTest(
  ABTestTemplates.paywallMessage()
);
// Expected: +15-20% conversion
```

### Week 2: CTA Button
```javascript
const test2 = await abTestingService.createTest(
  ABTestTemplates.ctaButton()
);
// Expected: +5-10% conversion
```

### Week 3: Social Proof
```javascript
const test3 = await abTestingService.createTest(
  ABTestTemplates.socialProof()
);
// Expected: +10-15% conversion
```

### Week 4: Pricing
```javascript
const test4 = await abTestingService.createTest(
  ABTestTemplates.pricing('cosmic')
);
// Expected: +5-10% revenue
```

**Total Expected Impact**: +30-50% revenue increase

---

## 📈 Success Metrics

Track these KPIs:

1. **Test Velocity**: 2-3 tests per month
2. **Win Rate**: 60-70% of tests show improvement
3. **Average Lift**: 10-20% per winning test
4. **Cumulative Impact**: +40-60% annual revenue increase

---

## 🛠 Troubleshooting

### Test Not Getting Traffic

```javascript
// Check test status
const test = await abTestingService.getTest(testId);
console.log('Status:', test.status); // Should be 'running'
```

### No Results Showing

```javascript
// Check if users are assigned
const stats = await pool.query(`
  SELECT COUNT(*) as users FROM ab_user_assignments WHERE test_id = $1
`, [testId]);
console.log('Users assigned:', stats.rows[0].users);
```

### Variant Not Applying

```javascript
// Check user's assignment
const assignment = await abTestingService.assignUserToVariant(userId, testId);
console.log('Assigned variant:', assignment.variantId);
console.log('Config:', assignment.config);
```

---

## 🚀 Advanced Features

### Middleware Shortcuts

```javascript
const {
  autoAssignTests,
  trackConversion,
  dynamicPricing,
  featureFlag,
  paywallMessaging
} = require('./middleware/abTestingMiddleware');

// Auto-assign all users
app.use(autoAssignTests);

// Track conversions automatically
app.post('/subscribe', trackConversion(1), handler);

// Apply dynamic pricing
app.get('/pricing', dynamicPricing(2), handler);

// Feature flags
app.get('/feature', featureFlag(3, 'enabled'), handler);

// Customize paywall
app.get('/paywall', paywallMessaging(1), handler);
```

### Custom Tests

```javascript
const customTest = await abTestingService.createTest({
  name: 'My Custom Test',
  hypothesis: 'This will increase conversions',
  duration: 14,
  minSampleSize: 1000,
  variants: [
    {
      id: 'control',
      weight: 50,
      config: { /* your config */ }
    },
    {
      id: 'variant_a',
      weight: 50,
      config: { /* your config */ }
    }
  ],
  metrics: {
    primary: 'conversion_rate',
    secondary: ['revenue_per_user']
  }
});
```

---

## 📚 Next Steps

1. ✅ Read full documentation: `docs/AB_TESTING_FRAMEWORK.md`
2. ✅ Review examples: `docs/AB_TESTING_EXAMPLES.md`
3. ✅ Set up automated monitoring
4. ✅ Create first test
5. ✅ Track conversions
6. ✅ Analyze results
7. ✅ Roll out winner
8. ✅ Repeat!

---

## 🎯 Support

- Documentation: `/docs/AB_TESTING_FRAMEWORK.md`
- Examples: `/docs/AB_TESTING_EXAMPLES.md`
- Code: `/src/services/abTestingService.js`

---

**You're all set! Start optimizing for revenue today.**
