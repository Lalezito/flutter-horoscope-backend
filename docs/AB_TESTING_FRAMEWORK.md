# A/B Testing Framework - Complete Guide

## Overview

A comprehensive A/B testing system for revenue optimization. Test EVERYTHING and automatically optimize for maximum conversions and revenue.

## Features

- ✅ **Test Management**: Create, update, pause, resume, and archive tests
- ✅ **Consistent User Assignment**: Users always get the same variant
- ✅ **Statistical Analysis**: Automatic significance calculation with Z-tests
- ✅ **Real-time Results**: Monitor performance in real-time
- ✅ **Automatic Winner Declaration**: System auto-declares winners when conditions are met
- ✅ **Revenue Impact Calculation**: Precise revenue projections and ROI
- ✅ **Multi-variate Testing**: Test multiple variables simultaneously
- ✅ **Test Templates**: Pre-built templates for common experiments
- ✅ **Middleware Integration**: Automatic variant assignment and tracking

---

## Quick Start

### 1. Run Database Migration

```bash
cd /Users/alejandrocaceres/Desktop/appstore.zodia/backend/flutter-horoscope-backend
node migrations/015_create_ab_testing_tables.js
```

### 2. Add Routes to App

In `src/app.js`, add:

```javascript
const abTestingRoutes = require('./routes/abTesting');
app.use('/api/ab-testing', abTestingRoutes);
```

### 3. Create Your First Test

```javascript
const ABTestTemplates = require('./services/abTestTemplates');
const abTestingService = require('./services/abTestingService');

// Use a pre-built template
const testConfig = ABTestTemplates.paywallMessage();

// Create the test
const test = await abTestingService.createTest(testConfig);
console.log('Test created:', test.id);
```

### 4. Assign Users to Variants

```javascript
// In your app, when user hits paywall
const userId = 'user_123';
const testId = 1;

const assignment = await abTestingService.assignUserToVariant(userId, testId);
console.log('User assigned to:', assignment.variantId);
console.log('Config:', assignment.config);

// Use the config to customize the experience
res.json({
  paywallMessage: assignment.config.paywallMessage,
  cta: assignment.config.cta
});
```

### 5. Track Events

```javascript
// Track conversion when user subscribes
await abTestingService.trackEvent(userId, testId, 'conversion', {
  amount: 5.99
});

// Track other events
await abTestingService.trackEvent(userId, testId, 'page_view', {
  page: 'paywall'
});
```

### 6. Check Results

```javascript
const results = await abTestingService.getTestResults(testId);

console.log('Test Status:', results.status);
console.log('Progress:', results.progress + '%');
console.log('Control Conversion:', results.results.control.conversionRate + '%');
console.log('Variant Conversion:', results.results.variant_a.conversionRate + '%');

if (results.analysis.winner) {
  console.log('🎉 Winner:', results.analysis.winner);
  console.log('Improvement:', results.analysis.improvement);
  console.log('Annual Impact:', results.analysis.projectedAnnualImpact);
}
```

---

## API Endpoints

### Create Test
```
POST /api/ab-testing/tests
Authorization: Bearer {token}

{
  "name": "Paywall Message Test",
  "hypothesis": "Emotional message converts better",
  "variants": [
    {
      "id": "control",
      "name": "Logical",
      "weight": 50,
      "config": { "paywallMessage": "Upgrade now" }
    },
    {
      "id": "variant_a",
      "name": "Emotional",
      "weight": 50,
      "config": { "paywallMessage": "Your journey awaits ✨" }
    }
  ],
  "metrics": {
    "primary": "conversion_rate",
    "secondary": ["revenue_per_user"]
  },
  "minSampleSize": 1000,
  "confidenceLevel": 95,
  "duration": 14
}
```

### Get Active Tests
```
GET /api/ab-testing/tests
Authorization: Bearer {token}
```

### Get Test Results
```
GET /api/ab-testing/tests/:testId/results
Authorization: Bearer {token}
```

### Assign User to Variant
```
POST /api/ab-testing/assign

{
  "userId": "user_123",
  "testId": 1
}
```

### Track Event
```
POST /api/ab-testing/track

{
  "userId": "user_123",
  "testId": 1,
  "eventType": "conversion",
  "eventData": {
    "amount": 5.99
  }
}
```

### Pause/Resume/Archive Test
```
POST /api/ab-testing/tests/:testId/pause
POST /api/ab-testing/tests/:testId/resume
POST /api/ab-testing/tests/:testId/archive
```

### Check for Winner
```
POST /api/ab-testing/tests/:testId/check-winner
```

### Declare Winner Manually
```
POST /api/ab-testing/tests/:testId/declare-winner

{
  "winnerId": "variant_a"
}
```

---

## Test Templates

### Available Templates

1. **Paywall Message**
   - Tests different messaging approaches
   - Logical vs Emotional vs Social Proof

2. **Pricing**
   - Tests different price points
   - Cosmic: $4.99, $5.99, $6.99
   - Universe: $9.99, $11.99, $12.99

3. **Trial Length**
   - 7-day vs 14-day trials
   - With/without credit card

4. **Feature Limits**
   - Different free tier restrictions
   - Generous vs Strict

5. **CTA Button**
   - Different button text
   - "Start Trial" vs "Unlock Now" vs "Begin Journey"

6. **Notification Timing**
   - 8 AM vs 12 PM vs 8 PM

7. **Onboarding Flow**
   - Long (5 steps) vs Short (2 steps)

8. **Social Proof**
   - User count vs Rating vs Testimonial

9. **Color Scheme**
   - Purple vs Blue vs Gradient

10. **Discount Timing**
    - Immediate vs Delayed vs Exit Intent

### Using Templates

```javascript
const ABTestTemplates = require('./services/abTestTemplates');

// Get specific template
const paywallTest = ABTestTemplates.paywallMessage();
const pricingTest = ABTestTemplates.pricing('cosmic');
const trialTest = ABTestTemplates.trialLength();

// Create test from template
const test = await abTestingService.createTest(paywallTest);

// Get all templates
const allTemplates = ABTestTemplates.getAllTemplates();

// Get template by name
const template = ABTestTemplates.getTemplate('paywallMessage');
```

---

## Middleware Usage

### Auto-assign Users to Tests

```javascript
const { autoAssignTests, applyVariantConfig } = require('./middleware/abTestingMiddleware');

// Apply to all routes
app.use(autoAssignTests);
app.use(applyVariantConfig());

// Now all responses include abTests
// { data: {...}, abTests: { 1: { variantId: 'control', config: {...} } } }
```

### Track Conversions Automatically

```javascript
const { trackConversion } = require('./middleware/abTestingMiddleware');

// Track when user subscribes
app.post('/api/subscribe',
  trackConversion(1, 'conversion'), // testId = 1
  async (req, res) => {
    // Your subscription logic
  }
);
```

### Dynamic Pricing

```javascript
const { dynamicPricing } = require('./middleware/abTestingMiddleware');

app.get('/api/pricing',
  dynamicPricing(2), // testId = 2
  async (req, res) => {
    const price = req.dynamicPrice || 5.99; // Use test price or default
    res.json({ price });
  }
);
```

### Feature Flags

```javascript
const { featureFlag } = require('./middleware/abTestingMiddleware');

app.get('/api/some-feature',
  featureFlag(3, 'newFeatureEnabled'),
  async (req, res) => {
    if (req.featureEnabled) {
      // Show new feature
    } else {
      // Show old feature
    }
  }
);
```

### Paywall Messaging

```javascript
const { paywallMessaging } = require('./middleware/abTestingMiddleware');

app.get('/api/paywall',
  paywallMessaging(1),
  async (req, res) => {
    res.json({
      message: req.paywallConfig?.message || 'Default message',
      cta: req.paywallConfig?.cta || 'Subscribe',
      subtext: req.paywallConfig?.subtext
    });
  }
);
```

---

## Statistical Analysis

### How it Works

The framework uses **Z-test for proportions** to determine statistical significance:

```javascript
// Automatically calculated for each variant
const significance = {
  z: 2.35,              // Z-score
  pValue: 0.0188,       // P-value (< 0.05 = significant)
  significant: true,    // Statistically significant?
  confidence: 98.12     // Confidence level (%)
};
```

### Winner Declaration Criteria

A winner is declared when ALL conditions are met:

1. ✅ **Minimum Sample Size**: Both variants have >= minSampleSize users
2. ✅ **Statistical Significance**: p-value < 0.05 (95% confidence)
3. ✅ **Minimum Effect Size**: >= 10% improvement over control
4. ✅ **Minimum Duration**: Test ran for >= 7 days

### Interpreting Results

```javascript
const results = await abTestingService.getTestResults(testId);

// Progress
console.log(`Progress: ${results.progress}%`);
console.log(`Duration: ${results.duration}`);

// Performance
console.log(`Control: ${results.results.control.conversionRate}%`);
console.log(`Variant: ${results.results.variant_a.conversionRate}%`);

// Statistical Significance
console.log(`Confidence: ${results.results.variant_a.confidence}%`);
console.log(`Significant: ${results.results.variant_a.significant}`);

// Business Impact
if (results.analysis.winner) {
  console.log(`Winner: ${results.analysis.winner}`);
  console.log(`Improvement: ${results.analysis.improvement}`);
  console.log(`Annual Impact: ${results.analysis.projectedAnnualImpact}`);
  console.log(`Recommendation: ${results.analysis.recommendation}`);
}
```

---

## Revenue Impact Analysis

### Basic Calculation

```javascript
const revenueImpactCalculator = require('./services/revenueImpactCalculator');

const impact = await revenueImpactCalculator.calculateImpact(testResults, {
  monthlyUsers: 10000,
  avgOrderValue: 10
});

console.log('Baseline Revenue:', impact.baseline.monthlyRevenue);
console.log('Variant Revenue:', impact.variants[0].variant.monthlyRevenue);
console.log('Monthly Impact:', impact.variants[0].impact.monthly);
console.log('Annual Impact:', impact.variants[0].impact.annual);
```

### Generate Full Report

```javascript
const report = await revenueImpactCalculator.generateReport(
  testId,
  testResults,
  { monthlyUsers: 10000, avgOrderValue: 10 }
);

console.log('Executive Summary:', report.executiveSummary);
console.log('Scenarios:', report.scenarios);
console.log('Recommendation:', report.recommendation);
```

### Scenario Analysis

```javascript
const scenarios = await revenueImpactCalculator.simulateScenarios(testResults, [
  { name: 'Conservative', users: 5000, avgOrderValue: 8 },
  { name: 'Current', users: 10000, avgOrderValue: 10 },
  { name: 'Growth', users: 20000, avgOrderValue: 12 }
]);

scenarios.forEach(scenario => {
  console.log(`${scenario.name}:`);
  console.log(`  Annual Impact: $${scenario.bestVariant.annualImpact}`);
});
```

---

## Best Practices

### 1. Test One Thing at a Time
```javascript
// GOOD - Testing one variable
{
  name: "CTA Button Text",
  variants: [
    { config: { ctaText: "Start Trial" } },
    { config: { ctaText: "Unlock Now" } }
  ]
}

// BAD - Testing multiple variables
{
  name: "Multiple Changes",
  variants: [
    { config: { ctaText: "Start Trial", color: "purple" } },
    { config: { ctaText: "Unlock Now", color: "blue" } }
  ]
}
```

### 2. Set Proper Sample Sizes
```javascript
// For conversion rate tests
minSampleSize: 1000  // Detects 10% change with 95% confidence

// For smaller effects
minSampleSize: 5000  // Detects 5% change with 95% confidence

// For revenue tests
minSampleSize: 2000  // Higher variance requires more samples
```

### 3. Run Tests Long Enough
```javascript
// Minimum durations
{
  duration: 7,   // UI changes
  duration: 14,  // Paywall/pricing
  duration: 21,  // Pricing tests (needs weekly patterns)
  duration: 30   // Trial conversion (needs full trial period)
}
```

### 4. Segment Your Audience
```javascript
// Test only on relevant users
{
  targetSegments: {
    tier: ['free'],           // Only free users
    country: ['US', 'CA'],    // Only US/Canada
    newUsers: 7               // Only users < 7 days old
  }
}
```

### 5. Monitor Continuously
```javascript
// Set up automated checks
const cron = require('node-cron');

// Check for winners every day at midnight
cron.schedule('0 0 * * *', async () => {
  const activeTests = await abTestingService.getActiveTests();

  for (const test of activeTests) {
    await abTestingService.checkForWinner(test.id);
  }
});
```

---

## Testing Strategy

### Month 1: Quick Wins
- Week 1: Paywall messaging
- Week 2: CTA button
- Week 3: Social proof
- Week 4: Color scheme

**Expected Impact**: +10-15% conversion rate

### Month 2: Pricing Optimization
- Week 1-3: Cosmic tier pricing
- Week 4: Analyze and implement winner

**Expected Impact**: +5-10% revenue per user

### Month 3: User Journey
- Week 1-2: Onboarding flow
- Week 3-4: Trial length

**Expected Impact**: +15-20% trial completion

### Month 4: Advanced
- Week 1-4: Multi-variate test (pricing + messaging + CTA)

**Expected Impact**: +20-30% overall conversion

---

## Revenue Projections

### Conservative Estimate (First Year)

```
Baseline:
- 10,000 monthly users
- 5% conversion rate = 500 conversions/month
- $10 average order value
- Monthly revenue: $5,000
- Annual revenue: $60,000

After Optimization:
- 10,000 monthly users
- 7% conversion rate (+40% improvement)
- $10 average order value
- Monthly revenue: $7,000
- Annual revenue: $84,000

Annual Impact: +$24,000 (40% increase)
```

### Aggressive Estimate (With Growth)

```
Baseline:
- 20,000 monthly users (2x growth)
- 5% conversion rate
- $12 average order value (pricing optimization)
- Annual revenue: $144,000

After Optimization:
- 20,000 monthly users
- 7.5% conversion rate (+50% improvement)
- $12 average order value
- Annual revenue: $216,000

Annual Impact: +$72,000 (50% increase)
```

---

## Troubleshooting

### Test Not Getting Traffic
```javascript
// Check test status
const test = await abTestingService.getTest(testId);
console.log('Status:', test.status); // Should be 'running'

// Check variant weights
console.log('Weights:', test.variants.map(v => v.weight)); // Should sum to 100

// Check target segments
console.log('Segments:', test.target_segments);
```

### No Significant Results
```javascript
// Increase sample size
await pool.query(`
  UPDATE ab_tests
  SET min_sample_size = 2000
  WHERE id = $1
`, [testId]);

// Extend duration
await pool.query(`
  UPDATE ab_tests
  SET end_date = end_date + INTERVAL '7 days'
  WHERE id = $1
`, [testId]);
```

### Variant Not Applying
```javascript
// Check user assignment
const assignment = await pool.query(`
  SELECT * FROM ab_user_assignments
  WHERE user_id = $1 AND test_id = $2
`, [userId, testId]);

console.log('Assignment:', assignment.rows[0]);

// Check variant config
const config = await abTestingService.getVariantConfig(userId, testId);
console.log('Config:', config);
```

---

## Advanced Features

### Multi-variate Testing

```javascript
// Test multiple variables
const mvTest = {
  name: "Complete Paywall Optimization",
  variants: [
    { id: 'control', weight: 25, config: {
      message: 'A', price: 4.99, cta: 'Subscribe'
    }},
    { id: 'var_1', weight: 25, config: {
      message: 'A', price: 5.99, cta: 'Subscribe'
    }},
    { id: 'var_2', weight: 25, config: {
      message: 'B', price: 4.99, cta: 'Unlock'
    }},
    { id: 'var_3', weight: 25, config: {
      message: 'B', price: 5.99, cta: 'Unlock'
    }}
  ]
};
```

### Custom Metrics

```javascript
// Track custom events
await abTestingService.trackEvent(userId, testId, 'trial_started', {
  trialLength: 7
});

await abTestingService.trackEvent(userId, testId, 'feature_used', {
  feature: 'cosmic_coach',
  times: 5
});

// Analyze custom metrics
const events = await pool.query(`
  SELECT event_type, COUNT(*), AVG((event_data->>'times')::int)
  FROM ab_events
  WHERE test_id = $1 AND variant_id = $2
  GROUP BY event_type
`, [testId, variantId]);
```

### Automated Rollouts

```javascript
// Enable auto-rollout
{
  name: "Paywall Test",
  autoRollout: true,  // Automatically rollout winner
  // ... other config
}

// System will:
// 1. Monitor test progress
// 2. Declare winner when criteria met
// 3. Automatically rollout winning variant
// 4. Notify team
```

---

## Support

For questions or issues:
1. Check this documentation
2. Review code comments in services
3. Check logs: `SELECT * FROM ab_events WHERE test_id = X`
4. Contact development team

---

## Changelog

### v1.0.0 (2025-01-23)
- Initial release
- Core A/B testing framework
- Statistical analysis engine
- Revenue impact calculator
- Test templates
- Middleware integration
- Comprehensive documentation
