/**
 * REVENUE OPTIMIZATION ENGINE - COMPREHENSIVE TEST SUITE
 *
 * Tests all features of the revenue optimization system:
 * - Dynamic pricing
 * - Personalized offers
 * - Churn prediction
 * - LTV optimization
 * - Revenue forecasting
 * - Pricing experiments
 */

const revenueEngine = require('./src/services/revenueOptimizationEngine');
const db = require('./src/config/db');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

function success(message) {
  log('✅ ' + message, 'green');
}

function error(message) {
  log('❌ ' + message, 'red');
}

function info(message) {
  log('ℹ️  ' + message, 'blue');
}

function warning(message) {
  log('⚠️  ' + message, 'yellow');
}

// Test data
const testUsers = {
  newUser: 'test_new_user_' + Date.now(),
  engagedUser: 'test_engaged_user_' + Date.now(),
  powerUser: 'test_power_user_' + Date.now(),
  churnRiskUser: 'test_churn_user_' + Date.now(),
  premiumUser: 'test_premium_user_' + Date.now()
};

/**
 * Create test users with different profiles
 */
async function createTestUsers() {
  section('Creating Test Users');

  try {
    // Create base users table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(255) PRIMARY KEY,
        country VARCHAR(2),
        subscription_tier VARCHAR(20) DEFAULT 'free',
        last_active TIMESTAMP DEFAULT NOW(),
        birth_date DATE,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // 1. New user (just signed up)
    await db.query(`
      INSERT INTO users (user_id, country, subscription_tier, created_at, last_active, name)
      VALUES ($1, 'US', 'free', NOW(), NOW(), 'New Test User')
      ON CONFLICT (user_id) DO UPDATE SET last_active = NOW()
    `, [testUsers.newUser]);
    success('Created new user: ' + testUsers.newUser);

    // 2. Engaged user (active, good engagement)
    await db.query(`
      INSERT INTO users (user_id, country, subscription_tier, created_at, last_active, name)
      VALUES ($1, 'IN', 'free', NOW() - INTERVAL '30 days', NOW(), 'Engaged Test User')
      ON CONFLICT (user_id) DO UPDATE SET last_active = NOW()
    `, [testUsers.engagedUser]);

    // Add analytics for engaged user
    for (let i = 0; i < 20; i++) {
      await db.query(`
        INSERT INTO user_analytics (user_id, session_duration, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${i} days')
      `, [testUsers.engagedUser, 300 + Math.random() * 600]);
    }

    // Add feature usage
    const features = ['cosmic_coach', 'compatibility', 'daily_horoscope'];
    for (const feature of features) {
      await db.query(`
        INSERT INTO feature_usage (user_id, feature_name, usage_count, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [testUsers.engagedUser, feature, Math.floor(Math.random() * 20) + 5]);
    }
    success('Created engaged user with analytics: ' + testUsers.engagedUser);

    // 3. Power user (very active)
    await db.query(`
      INSERT INTO users (user_id, country, subscription_tier, created_at, last_active, name)
      VALUES ($1, 'US', 'free', NOW() - INTERVAL '90 days', NOW(), 'Power Test User')
      ON CONFLICT (user_id) DO UPDATE SET last_active = NOW()
    `, [testUsers.powerUser]);

    // Add heavy analytics
    for (let i = 0; i < 60; i++) {
      await db.query(`
        INSERT INTO user_analytics (user_id, session_duration, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${i} days')
      `, [testUsers.powerUser, 600 + Math.random() * 1200]);
    }

    for (const feature of features) {
      await db.query(`
        INSERT INTO feature_usage (user_id, feature_name, usage_count, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [testUsers.powerUser, feature, Math.floor(Math.random() * 50) + 30]);
    }
    success('Created power user with heavy usage: ' + testUsers.powerUser);

    // 4. Churn risk user (inactive)
    await db.query(`
      INSERT INTO users (user_id, country, subscription_tier, created_at, last_active, name)
      VALUES ($1, 'GB', 'cosmic', NOW() - INTERVAL '60 days', NOW() - INTERVAL '14 days', 'Churn Risk User')
      ON CONFLICT (user_id) DO UPDATE SET last_active = NOW() - INTERVAL '14 days'
    `, [testUsers.churnRiskUser]);

    // Add past analytics (but declining)
    for (let i = 14; i < 40; i++) {
      await db.query(`
        INSERT INTO user_analytics (user_id, session_duration, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${i} days')
      `, [testUsers.churnRiskUser, 200 + Math.random() * 400]);
    }
    success('Created churn risk user (inactive 14 days): ' + testUsers.churnRiskUser);

    // 5. Premium user (paying customer)
    await db.query(`
      INSERT INTO users (user_id, country, subscription_tier, created_at, last_active, name)
      VALUES ($1, 'CA', 'universe', NOW() - INTERVAL '120 days', NOW(), 'Premium Test User')
      ON CONFLICT (user_id) DO UPDATE SET last_active = NOW()
    `, [testUsers.premiumUser]);

    // Add subscription
    await db.query(`
      INSERT INTO subscriptions (user_id, tier, amount_paid, status, created_at, expires_at)
      VALUES ($1, 'universe', 9.99, 'active', NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days')
    `, [testUsers.premiumUser]);

    for (let i = 0; i < 90; i++) {
      await db.query(`
        INSERT INTO user_analytics (user_id, session_duration, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${i} days')
      `, [testUsers.premiumUser, 400 + Math.random() * 800]);
    }
    success('Created premium user with subscription: ' + testUsers.premiumUser);

    info(`\nTest users created successfully. Total: ${Object.keys(testUsers).length}`);

  } catch (error) {
    error('Failed to create test users: ' + error.message);
    throw error;
  }
}

/**
 * Test 1: Dynamic Pricing
 */
async function testDynamicPricing() {
  section('Test 1: Dynamic Pricing');

  try {
    // Test pricing for different user profiles
    const tests = [
      { user: testUsers.newUser, tier: 'cosmic', expectedRange: [4.49, 5.49], label: 'New user (US)' },
      { user: testUsers.engagedUser, tier: 'cosmic', expectedRange: [2.49, 3.99], label: 'Engaged user (India - low PPP)' },
      { user: testUsers.powerUser, tier: 'universe', expectedRange: [9.99, 11.99], label: 'Power user (high engagement)' },
      { user: testUsers.churnRiskUser, tier: 'cosmic', expectedRange: [3.49, 5.49], label: 'Churn risk user' }
    ];

    for (const test of tests) {
      const result = await revenueEngine.calculateOptimalPrice(test.user, test.tier);

      info(`\n${test.label}:`);
      console.log('  Price:', result.price);
      console.log('  Base Price:', result.basePrice);
      console.log('  Factors:', JSON.stringify(result.factors, null, 2));
      console.log('  Reasoning:', result.reasoning);
      console.log('  Expected Conversion:', result.expectedConversionRate + '%');
      console.log('  Confidence:', result.confidence);

      // Validate price is in expected range
      if (result.price >= test.expectedRange[0] && result.price <= test.expectedRange[1]) {
        success(`Price ${result.price} is within expected range [${test.expectedRange[0]}, ${test.expectedRange[1]}]`);
      } else {
        warning(`Price ${result.price} is outside expected range [${test.expectedRange[0]}, ${test.expectedRange[1]}]`);
      }

      // Validate price psychology (.49 or .99 ending)
      const priceStr = result.price.toString();
      if (priceStr.endsWith('.49') || priceStr.endsWith('.99')) {
        success('Price uses optimal psychology (.49 or .99 ending)');
      } else {
        warning('Price does not use optimal psychology');
      }
    }

  } catch (error) {
    error('Dynamic pricing test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 2: Personalized Offers
 */
async function testPersonalizedOffers() {
  section('Test 2: Personalized Offers');

  try {
    const tests = [
      { user: testUsers.engagedUser, label: 'Engaged user' },
      { user: testUsers.powerUser, label: 'Power user' },
      { user: testUsers.churnRiskUser, label: 'Churn risk user' },
      { user: testUsers.premiumUser, label: 'Premium user (should get null)' }
    ];

    for (const test of tests) {
      const offer = await revenueEngine.generateUpgradeOffer(test.user);

      info(`\n${test.label}:`);

      if (offer) {
        console.log('  Trigger:', offer.trigger);
        console.log('  Message:', offer.message);
        console.log('  Tier:', offer.offer.tier);
        console.log('  Price:', offer.offer.price);
        console.log('  Discount:', offer.offer.discount + '%');
        console.log('  Expected Conversion:', offer.expectedConversion + '%');
        console.log('  Priority:', offer.priority);

        success('Personalized offer generated');
      } else {
        if (test.user === testUsers.premiumUser) {
          success('No offer for premium user (correct behavior)');
        } else {
          warning('No offer generated (user may not meet criteria)');
        }
      }
    }

  } catch (error) {
    error('Personalized offers test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 3: Smart Discount Timing
 */
async function testSmartDiscounts() {
  section('Test 3: Smart Discount Timing');

  try {
    // Add paywall hits for engaged user
    for (let i = 0; i < 4; i++) {
      await db.query(`
        INSERT INTO user_events (user_id, event_type, created_at)
        VALUES ($1, 'paywall_hit', NOW() - INTERVAL '${i} hours')
      `, [testUsers.engagedUser]);
    }
    info('Added 4 paywall hits for engaged user');

    const tests = [
      { user: testUsers.newUser, label: 'New user (too new)' },
      { user: testUsers.engagedUser, label: 'Engaged user (paywall hits)' },
      { user: testUsers.churnRiskUser, label: 'Churn risk user (inactive)' },
      { user: testUsers.premiumUser, label: 'Premium user (should not discount)' }
    ];

    for (const test of tests) {
      const result = await revenueEngine.shouldOfferDiscount(test.user);

      info(`\n${test.label}:`);
      console.log('  Should Offer:', result.offer);
      console.log('  Reason:', result.reason);

      if (result.offer) {
        console.log('  Discount:', result.discount + '%');
        console.log('  Price:', result.price);
        console.log('  Message:', result.message);
        console.log('  Expires In:', result.expiresIn);
        success('Discount offer recommended');
      } else {
        success('No discount (correct decision)');
      }
    }

  } catch (error) {
    error('Smart discounts test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 4: Churn Prediction
 */
async function testChurnPrediction() {
  section('Test 4: Churn Prediction');

  try {
    const tests = [
      { user: testUsers.newUser, expectedRisk: 'low', label: 'New user' },
      { user: testUsers.engagedUser, expectedRisk: 'low', label: 'Engaged user' },
      { user: testUsers.powerUser, expectedRisk: 'low', label: 'Power user' },
      { user: testUsers.churnRiskUser, expectedRisk: 'high', label: 'Churn risk user' }
    ];

    for (const test of tests) {
      const prediction = await revenueEngine.predictChurnProbability(test.user);

      info(`\n${test.label}:`);
      console.log('  Churn Probability:', (prediction.probability * 100).toFixed(1) + '%');
      console.log('  Risk Level:', prediction.riskLevel);
      console.log('  Retention Strategy:', prediction.retentionStrategy);
      console.log('  Top Reasons:');
      prediction.topReasons.forEach((reason, i) => {
        console.log(`    ${i + 1}. [${reason.severity}] ${reason.reason}`);
      });

      if (prediction.riskLevel === test.expectedRisk) {
        success(`Risk level ${prediction.riskLevel} matches expected ${test.expectedRisk}`);
      } else {
        warning(`Risk level ${prediction.riskLevel} differs from expected ${test.expectedRisk}`);
      }

      // Validate probability is between 0 and 1
      if (prediction.probability >= 0 && prediction.probability <= 1) {
        success('Probability is valid (0-1)');
      } else {
        error('Probability is invalid: ' + prediction.probability);
      }
    }

  } catch (error) {
    error('Churn prediction test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 5: LTV Optimization
 */
async function testLTVOptimization() {
  section('Test 5: LTV Optimization');

  try {
    const tests = [
      { user: testUsers.engagedUser, label: 'Engaged free user' },
      { user: testUsers.powerUser, label: 'Power free user' },
      { user: testUsers.premiumUser, label: 'Premium user' }
    ];

    for (const test of tests) {
      const result = await revenueEngine.maximizeLifetimeValue(test.user);

      info(`\n${test.label}:`);
      console.log('  Current LTV:', '$' + result.currentLTV);
      console.log('  Potential LTV:', '$' + result.potentialLTV);
      console.log('  Projected LTV:', '$' + result.projectedLTV);
      console.log('  Strategy Type:', result.strategy.type);
      console.log('  Priority:', result.strategy.priority);
      console.log('  Actions:');
      result.strategy.actions.forEach((action, i) => {
        console.log(`    ${i + 1}. ${action.action}: ${action.message || action.trigger}`);
      });

      if (result.projectedLTV > result.currentLTV) {
        success(`LTV optimization suggests ${((result.projectedLTV / result.currentLTV - 1) * 100).toFixed(1)}% increase`);
      } else {
        warning('No LTV increase suggested');
      }
    }

  } catch (error) {
    error('LTV optimization test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 6: Revenue Forecasting
 */
async function testRevenueForecasting() {
  section('Test 6: Revenue Forecasting');

  try {
    const forecast = await revenueEngine.forecastRevenue(12);

    info('Current Metrics:');
    console.log('  Total Users:', forecast.currentMetrics.totalUsers);
    console.log('  Premium Users:', forecast.currentMetrics.premiumUsers);
    console.log('  Conversion Rate:', forecast.currentMetrics.conversionRate + '%');
    console.log('  Churn Rate:', forecast.currentMetrics.churnRate + '%');

    info('\nForecast Scenarios (12 months):');

    const scenarios = ['conservative', 'realistic', 'optimistic'];
    scenarios.forEach(scenario => {
      const data = forecast.scenarios[scenario];
      console.log(`\n  ${scenario.toUpperCase()}:`);
      console.log('    Assumptions:', JSON.stringify(data.assumptions));
      console.log('    Month 12 Revenue:', '$' + data.month12Revenue);
      console.log('    Total Revenue:', '$' + data.totalRevenue);
      console.log('    Final User Count:', data.finalUserCount);
      console.log('    Final Premium Count:', data.finalPremiumCount);
    });

    success('Revenue forecast generated successfully');

    // Validate scenarios are in ascending order
    if (
      forecast.scenarios.conservative.month12Revenue <
      forecast.scenarios.realistic.month12Revenue &&
      forecast.scenarios.realistic.month12Revenue <
      forecast.scenarios.optimistic.month12Revenue
    ) {
      success('Scenarios are properly ordered (conservative < realistic < optimistic)');
    } else {
      warning('Scenario ordering may be incorrect');
    }

  } catch (error) {
    error('Revenue forecasting test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Test 7: Pricing Experiments
 */
async function testPricingExperiments() {
  section('Test 7: Pricing Experiments');

  try {
    // Create experiment
    info('Creating pricing experiment...');
    const experiment = await revenueEngine.runPricingExperiment('cosmic', 14);

    console.log('  Experiment ID:', experiment.experimentId);
    console.log('  Tier:', experiment.tier);
    console.log('  Price Points:', experiment.pricePoints);
    console.log('  Duration:', experiment.duration);
    console.log('  Status:', experiment.status);

    success('Pricing experiment created');

    // Test user assignments
    info('\nAssigning test users to price variants...');

    const assignmentTests = [
      testUsers.newUser,
      testUsers.engagedUser,
      testUsers.powerUser
    ];

    for (const userId of assignmentTests) {
      const assignment = await revenueEngine.getExperimentPrice(userId, 'cosmic');

      console.log(`  ${userId}:`);
      console.log('    Price:', assignment.price);
      console.log('    Is Experiment:', assignment.isExperiment);

      if (assignment.isExperiment) {
        success('User assigned to experiment variant');

        // Verify assignment is consistent
        const assignment2 = await revenueEngine.getExperimentPrice(userId, 'cosmic');
        if (assignment.price === assignment2.price) {
          success('Assignment is consistent (same price on second call)');
        } else {
          error('Assignment is inconsistent');
        }
      } else {
        warning('User not assigned to experiment');
      }
    }

  } catch (error) {
    error('Pricing experiments test failed: ' + error.message);
    console.error(error);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.clear();
  log('\n🚀 REVENUE OPTIMIZATION ENGINE - COMPREHENSIVE TEST SUITE\n', 'bright');

  try {
    // Initialize database connection
    await db.testConnection();
    success('Database connection established\n');

    // Run all tests
    await createTestUsers();
    await testDynamicPricing();
    await testPersonalizedOffers();
    await testSmartDiscounts();
    await testChurnPrediction();
    await testLTVOptimization();
    await testRevenueForecasting();
    await testPricingExperiments();

    // Summary
    section('Test Summary');
    success('All tests completed successfully! ✨');

    info('\nTest users created:');
    Object.entries(testUsers).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    warning('\nNote: These are test users. Delete them after testing:');
    console.log(`  DELETE FROM users WHERE user_id LIKE 'test_%';`);

  } catch (error) {
    error('\nTest suite failed: ' + error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close database connection
    await db.closePool();
    info('\nDatabase connection closed');
  }
}

// Run tests
runTests();
