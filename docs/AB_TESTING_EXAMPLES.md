# A/B Testing Framework - Complete Examples

## Table of Contents
1. [Basic Paywall Test](#basic-paywall-test)
2. [Pricing Optimization](#pricing-optimization)
3. [Trial Length Experiment](#trial-length-experiment)
4. [Feature Flags](#feature-flags)
5. [Multi-variate Test](#multi-variate-test)
6. [Revenue Analysis](#revenue-analysis)
7. [Integration Examples](#integration-examples)

---

## Basic Paywall Test

### Create Test

```javascript
const abTestingService = require('./services/abTestingService');

async function createPaywallTest() {
  const test = await abTestingService.createTest({
    name: 'Paywall Message A/B Test',
    hypothesis: 'Emotional messaging increases conversions by 20%',
    duration: 14,
    minSampleSize: 1000,
    confidenceLevel: 95,
    variants: [
      {
        id: 'control',
        name: 'Logical Message',
        weight: 50,
        config: {
          paywallMessage: 'Upgrade to unlock all features',
          cta: 'Start Free Trial',
          subtext: 'Cancel anytime, no commitment'
        }
      },
      {
        id: 'emotional',
        name: 'Emotional Message',
        weight: 50,
        config: {
          paywallMessage: 'Your cosmic journey awaits ✨',
          cta: 'Unlock My Full Potential',
          subtext: 'Join 10,000+ seekers on their journey'
        }
      }
    ],
    metrics: {
      primary: 'conversion_rate',
      secondary: ['revenue_per_user', 'time_to_convert']
    }
  });

  console.log('✅ Test created with ID:', test.id);
  return test;
}
```

### Show Paywall Based on Variant

```javascript
// In your paywall endpoint
app.get('/api/paywall', async (req, res) => {
  const userId = req.user.firebaseUid;
  const testId = 1; // Your paywall test ID

  // Assign user to variant
  const assignment = await abTestingService.assignUserToVariant(userId, testId);

  if (!assignment) {
    // User not eligible or test not active
    return res.json({
      message: 'Upgrade to unlock all features',
      cta: 'Start Free Trial'
    });
  }

  // Return variant-specific config
  res.json({
    message: assignment.config.paywallMessage,
    cta: assignment.config.cta,
    subtext: assignment.config.subtext,
    variantId: assignment.variantId // For tracking
  });
});
```

### Track Conversion

```javascript
// When user subscribes
app.post('/api/subscribe', async (req, res) => {
  const userId = req.user.firebaseUid;
  const { plan, amount } = req.body;

  // Process subscription...

  // Track conversion for paywall test
  await abTestingService.trackEvent(userId, 1, 'conversion', {
    amount: amount,
    plan: plan
  });

  res.json({ success: true });
});
```

### Check Results Daily

```javascript
const cron = require('node-cron');

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  const testId = 1;
  const results = await abTestingService.getTestResults(testId);

  console.log('📊 Daily Test Report');
  console.log('Progress:', results.progress + '%');
  console.log('Control:', results.results.control.conversionRate + '% conversion');
  console.log('Emotional:', results.results.emotional.conversionRate + '% conversion');

  if (results.analysis.winner) {
    console.log('🎉 WINNER FOUND:', results.analysis.winner);
    console.log('Impact:', results.analysis.projectedAnnualImpact);

    // Send alert to team
    await sendSlackNotification({
      title: 'A/B Test Winner!',
      test: results.name,
      winner: results.analysis.winner,
      improvement: results.analysis.improvement,
      annualImpact: results.analysis.projectedAnnualImpact
    });
  }
});
```

---

## Pricing Optimization

### Create Pricing Test

```javascript
async function createPricingTest() {
  const test = await abTestingService.createTest({
    name: 'Cosmic Tier Pricing Optimization',
    hypothesis: 'Price elasticity analysis for optimal revenue',
    duration: 21, // Longer for pricing tests
    minSampleSize: 1500,
    confidenceLevel: 95,
    variants: [
      {
        id: 'control',
        name: '$4.99/month',
        weight: 34,
        config: {
          tier: 'cosmic',
          price: 4.99,
          display: '$4.99/month'
        }
      },
      {
        id: 'medium',
        name: '$5.99/month',
        weight: 33,
        config: {
          tier: 'cosmic',
          price: 5.99,
          display: '$5.99/month'
        }
      },
      {
        id: 'high',
        name: '$6.99/month',
        weight: 33,
        config: {
          tier: 'cosmic',
          price: 6.99,
          display: '$6.99/month'
        }
      }
    ],
    metrics: {
      primary: 'revenue_per_user',
      secondary: ['conversion_rate', 'total_revenue']
    }
  });

  return test;
}
```

### Dynamic Pricing Middleware

```javascript
const { dynamicPricing } = require('./middleware/abTestingMiddleware');

// Apply dynamic pricing
app.get('/api/pricing/cosmic',
  dynamicPricing(2), // testId = 2
  async (req, res) => {
    const price = req.dynamicPrice || 4.99; // Use test price or default

    res.json({
      tier: 'cosmic',
      price: price,
      display: `$${price}/month`,
      features: [...]
    });
  }
);
```

### Analyze Pricing Impact

```javascript
const revenueImpactCalculator = require('./services/revenueImpactCalculator');

async function analyzePricingTest(testId) {
  const results = await abTestingService.getTestResults(testId);

  const impact = await revenueImpactCalculator.calculateImpact(results, {
    monthlyUsers: 10000,
    avgOrderValue: results.results.control.avgRevenuePerUser
  });

  console.log('💰 Pricing Analysis');

  for (const variant of impact.variants) {
    console.log(`\n${variant.variantId}:`);
    console.log(`  Conversion: ${variant.variant.conversionRate}%`);
    console.log(`  Revenue/User: $${variant.variant.monthlyRevenue / 10000}`);
    console.log(`  Total Revenue: $${variant.variant.monthlyRevenue}/month`);
    console.log(`  Annual Impact: $${variant.impact.annual}`);
    console.log(`  Confidence: ${variant.confidence}%`);
  }

  console.log('\n🏆 Best Variant:', impact.bestVariant.variantId);
  console.log('Recommendation:', impact.bestVariant.recommendation);
}
```

---

## Trial Length Experiment

### Create Test

```javascript
const ABTestTemplates = require('./services/abTestTemplates');

async function createTrialTest() {
  // Use pre-built template
  const testConfig = ABTestTemplates.trialLength();

  const test = await abTestingService.createTest(testConfig);

  console.log('Trial test created:', test.id);
  return test;
}
```

### Apply Trial Config

```javascript
app.post('/api/start-trial', async (req, res) => {
  const userId = req.user.firebaseUid;
  const testId = 3; // Trial test ID

  // Get user's variant
  const assignment = await abTestingService.assignUserToVariant(userId, testId);

  const trialDays = assignment?.config.trialDays || 7;
  const creditCardRequired = assignment?.config.creditCardRequired ?? true;

  // Create trial with variant config
  const trial = await createTrial({
    userId,
    duration: trialDays,
    requiresCreditCard: creditCardRequired
  });

  res.json({
    trial,
    message: `${trialDays}-day trial started`,
    requiresCreditCard: creditCardRequired
  });
});
```

### Track Trial Conversion

```javascript
// When trial converts to paid
app.post('/api/trial-convert', async (req, res) => {
  const userId = req.user.firebaseUid;

  // Track conversion for trial test
  await abTestingService.trackEvent(userId, 3, 'trial_to_paid', {
    amount: req.body.amount
  });

  res.json({ success: true });
});
```

---

## Feature Flags

### Create Feature Flag Test

```javascript
async function createFeatureFlagTest() {
  const test = await abTestingService.createTest({
    name: 'New AI Coach Feature',
    hypothesis: 'New AI coach increases engagement',
    duration: 14,
    minSampleSize: 1000,
    variants: [
      {
        id: 'control',
        name: 'Old Coach',
        weight: 50,
        config: {
          useNewCoach: false
        }
      },
      {
        id: 'new_coach',
        name: 'New AI Coach',
        weight: 50,
        config: {
          useNewCoach: true
        }
      }
    ],
    metrics: {
      primary: 'engagement_rate',
      secondary: ['session_duration', 'messages_per_session']
    }
  });

  return test;
}
```

### Use Feature Flag Middleware

```javascript
const { featureFlag } = require('./middleware/abTestingMiddleware');

app.get('/api/cosmic-coach/message',
  featureFlag(4, 'useNewCoach'),
  async (req, res) => {
    let message;

    if (req.featureEnabled) {
      // Use new AI coach
      message = await newAICoach.generateMessage(req.user);
    } else {
      // Use old coach
      message = await oldCoach.generateMessage(req.user);
    }

    res.json({ message });
  }
);
```

---

## Multi-variate Test

### Create Complex Test

```javascript
async function createMultivariateTest() {
  // Test message, price, and CTA simultaneously
  const test = await abTestingService.createTest({
    name: 'Complete Paywall Optimization',
    hypothesis: 'Find optimal combination of message, price, and CTA',
    duration: 21,
    minSampleSize: 2000,
    variants: [
      // Control
      {
        id: 'control',
        weight: 25,
        config: {
          message: 'Upgrade for unlimited access',
          price: 4.99,
          cta: 'Start Trial'
        }
      },
      // Message variation
      {
        id: 'msg_var',
        weight: 25,
        config: {
          message: 'Your cosmic journey awaits ✨',
          price: 4.99,
          cta: 'Start Trial'
        }
      },
      // Price variation
      {
        id: 'price_var',
        weight: 25,
        config: {
          message: 'Upgrade for unlimited access',
          price: 5.99,
          cta: 'Start Trial'
        }
      },
      // Combined variation
      {
        id: 'combined',
        weight: 25,
        config: {
          message: 'Your cosmic journey awaits ✨',
          price: 5.99,
          cta: 'Unlock Now'
        }
      }
    ],
    metrics: {
      primary: 'revenue_per_user',
      secondary: ['conversion_rate', 'total_revenue']
    }
  });

  return test;
}
```

### Apply Multiple Configurations

```javascript
app.get('/api/paywall-config', async (req, res) => {
  const userId = req.user.firebaseUid;
  const testId = 5;

  const assignment = await abTestingService.assignUserToVariant(userId, testId);

  if (!assignment) {
    return res.json({ /* defaults */ });
  }

  res.json({
    message: assignment.config.message,
    price: assignment.config.price,
    cta: assignment.config.cta,
    variant: assignment.variantId
  });
});
```

---

## Revenue Analysis

### Generate Comprehensive Report

```javascript
const revenueImpactCalculator = require('./services/revenueImpactCalculator');

async function generateRevenueReport(testId) {
  const testResults = await abTestingService.getTestResults(testId);

  const report = await revenueImpactCalculator.generateReport(
    testId,
    testResults,
    {
      monthlyUsers: 10000,
      avgOrderValue: 10
    }
  );

  console.log('📈 Revenue Impact Report');
  console.log('========================\n');

  console.log('Executive Summary:');
  console.log('  Status:', report.executiveSummary.status);
  console.log('  Winner:', report.executiveSummary.winner);
  console.log('  Improvement:', report.executiveSummary.improvement);
  console.log('  Annual Impact:', report.executiveSummary.annualImpact);
  console.log('  Recommendation:', report.executiveSummary.recommendation);

  console.log('\nBaseline:');
  console.log('  Monthly Revenue:', `$${report.baseline.monthlyRevenue}`);
  console.log('  Annual Revenue:', `$${report.baseline.annualRevenue}`);

  console.log('\nVariant Performance:');
  report.variants.forEach(v => {
    console.log(`\n  ${v.variantId}:`);
    console.log('    Conversion:', `${v.variant.conversionRate}%`);
    console.log('    Monthly Revenue:', `$${v.variant.monthlyRevenue}`);
    console.log('    Annual Impact:', `$${v.impact.annual}`);
    console.log('    Confidence:', `${v.confidence}%`);
  });

  console.log('\nScenarios:');
  report.scenarios.forEach(scenario => {
    console.log(`\n  ${scenario.name}:`);
    console.log('    Users:', scenario.assumptions.monthlyUsers);
    console.log('    Impact:', `$${scenario.bestVariant.annualImpact}/year`);
  });

  return report;
}
```

### Compare Multiple Tests

```javascript
async function compareAllTests() {
  const test1Results = await abTestingService.getTestResults(1);
  const test2Results = await abTestingService.getTestResults(2);
  const test3Results = await abTestingService.getTestResults(3);

  const comparison = await revenueImpactCalculator.compareTests([
    test1Results,
    test2Results,
    test3Results
  ]);

  console.log('🏆 Test Comparison');
  console.log('==================\n');

  console.log('Top Opportunity:', comparison.topOpportunity.testName);
  console.log('Annual Impact:', `$${comparison.topOpportunity.annualImpact}`);

  console.log('\nAll Tests:');
  comparison.tests.forEach((test, index) => {
    console.log(`${index + 1}. ${test.testName}`);
    console.log(`   Impact: $${test.annualImpact}/year`);
    console.log(`   Winner: ${test.bestVariant?.variantId || 'TBD'}`);
  });

  console.log('\nTotal Potential:', `$${comparison.totalPotentialImpact}/year`);
}
```

---

## Integration Examples

### Express.js Full Integration

```javascript
const express = require('express');
const app = express();
const abTestingRoutes = require('./routes/abTesting');
const { autoAssignTests, applyVariantConfig } = require('./middleware/abTestingMiddleware');

// Add A/B testing middleware globally
app.use(autoAssignTests);
app.use(applyVariantConfig());

// Add A/B testing routes
app.use('/api/ab-testing', abTestingRoutes);

// All responses now include A/B test assignments
app.get('/api/user/profile', async (req, res) => {
  const profile = await getUserProfile(req.user.id);

  // Response automatically includes abTests
  res.json({
    profile,
    // abTests: { 1: { variantId: 'control', config: {...} } }
  });
});
```

### React/React Native Integration

```javascript
// In your app, fetch user's A/B test assignments
async function loadUserTests(userId) {
  const response = await fetch(`/api/ab-testing/user/${userId}`);
  const data = await response.json();

  return data.data; // Array of test assignments
}

// Use variant config
function PaywallScreen() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function loadConfig() {
      const response = await fetch(`/api/ab-testing/config/${userId}/1`);
      const data = await response.json();
      setConfig(data.data);
    }
    loadConfig();
  }, []);

  if (!config) return <Loading />;

  return (
    <View>
      <Text>{config.paywallMessage}</Text>
      <Button onPress={handleSubscribe}>
        {config.cta}
      </Button>
      <Text>{config.subtext}</Text>
    </View>
  );
}

// Track conversion
async function handleSubscribe() {
  await fetch('/api/ab-testing/track', {
    method: 'POST',
    body: JSON.stringify({
      userId: userId,
      testId: 1,
      eventType: 'conversion',
      eventData: { amount: 5.99 }
    })
  });

  // Process subscription...
}
```

### Automated Testing Pipeline

```javascript
const cron = require('node-cron');

// Daily health check at 9 AM
cron.schedule('0 9 * * *', async () => {
  const activeTests = await abTestingService.getActiveTests();

  for (const test of activeTests) {
    const results = await abTestingService.getTestResults(test.id);

    // Check for winner
    await abTestingService.checkForWinner(test.id);

    // Send daily report
    await sendDailyReport(test.id, results);
  }
});

// Weekly revenue analysis (Sundays at 10 AM)
cron.schedule('0 10 * * 0', async () => {
  const activeTests = await abTestingService.getActiveTests();

  for (const test of activeTests) {
    await generateRevenueReport(test.id);
  }
});

// Monthly cleanup (1st of month at midnight)
cron.schedule('0 0 1 * *', async () => {
  // Archive completed tests older than 30 days
  await pool.query(`
    UPDATE ab_tests
    SET status = 'archived'
    WHERE status = 'completed'
    AND completed_at < NOW() - INTERVAL '30 days'
  `);
});
```

---

## Testing Checklist

### Before Launch
- [ ] Database migration completed
- [ ] Routes added to app.js
- [ ] Test configuration validated
- [ ] Sample size calculated
- [ ] Duration determined
- [ ] Metrics defined

### During Test
- [ ] Monitor daily progress
- [ ] Check for statistical significance
- [ ] Watch for anomalies
- [ ] Ensure balanced traffic
- [ ] Track both primary and secondary metrics

### After Test
- [ ] Declare winner (manual or auto)
- [ ] Calculate revenue impact
- [ ] Document learnings
- [ ] Rollout winning variant
- [ ] Archive test
- [ ] Plan next test

---

## Common Patterns

### Gradual Rollout
```javascript
// Start with 10% traffic
const test = await abTestingService.createTest({
  variants: [
    { id: 'control', weight: 90 },
    { id: 'new_feature', weight: 10 }
  ]
});

// After 7 days, increase to 50/50
await pool.query(`
  UPDATE ab_tests
  SET variants = jsonb_set(
    jsonb_set(variants, '{0,weight}', '50'),
    '{1,weight}', '50'
  )
  WHERE id = $1
`, [testId]);
```

### Sequential Testing
```javascript
// Test 1: Find best message
const test1 = await abTestingService.createTest(/* message test */);
await waitForWinner(test1.id);

// Test 2: Find best price (using winning message)
const winningMessage = await getWinningConfig(test1.id);
const test2 = await abTestingService.createTest({
  variants: [
    { config: { ...winningMessage, price: 4.99 } },
    { config: { ...winningMessage, price: 5.99 } }
  ]
});
```

---

This completes the examples guide. Use these patterns to implement A/B testing throughout your application.
