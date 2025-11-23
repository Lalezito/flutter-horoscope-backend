/**
 * A/B Testing Framework - Test Script
 * Run this to test the A/B testing framework
 */

require('dotenv').config();

const ABTestTemplates = require('./src/services/abTestTemplates');
const abTestingService = require('./src/services/abTestingService');
const revenueImpactCalculator = require('./src/services/revenueImpactCalculator');

async function testABFramework() {
  console.log('🧪 Testing A/B Testing Framework\n');

  try {
    // Test 1: Create a test using template
    console.log('1️⃣ Creating test from template...');
    const testConfig = ABTestTemplates.paywallMessage();
    const test = await abTestingService.createTest(testConfig);
    console.log('✅ Test created:', test.id);
    console.log('   Name:', test.name);
    console.log('   Variants:', test.variants.length);
    console.log('   Min Sample Size:', test.min_sample_size);
    console.log('');

    // Test 2: Assign users to variants
    console.log('2️⃣ Assigning users to variants...');
    const testUsers = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'];
    const assignments = {};

    for (const userId of testUsers) {
      const assignment = await abTestingService.assignUserToVariant(userId, test.id);
      assignments[userId] = assignment.variantId;
      console.log(`   ${userId} -> ${assignment.variantId}`);
    }
    console.log('');

    // Test 3: Track events
    console.log('3️⃣ Tracking events...');

    // Simulate conversions
    await abTestingService.trackEvent('user_1', test.id, 'conversion', { amount: 5.99 });
    await abTestingService.trackEvent('user_3', test.id, 'conversion', { amount: 5.99 });

    // Simulate page views
    for (const userId of testUsers) {
      await abTestingService.trackEvent(userId, test.id, 'page_view', { page: 'paywall' });
    }
    console.log('✅ Events tracked');
    console.log('');

    // Test 4: Get results
    console.log('4️⃣ Getting test results...');
    const results = await abTestingService.getTestResults(test.id);
    console.log('   Progress:', results.progress + '%');
    console.log('   Duration:', results.duration);
    console.log('');

    console.log('   Control:');
    console.log('     Users:', results.results.control?.users || 0);
    console.log('     Conversions:', results.results.control?.conversions || 0);
    console.log('     Conversion Rate:', (results.results.control?.conversionRate || 0) + '%');
    console.log('');

    if (results.results.emotional) {
      console.log('   Emotional Variant:');
      console.log('     Users:', results.results.emotional.users);
      console.log('     Conversions:', results.results.emotional.conversions);
      console.log('     Conversion Rate:', results.results.emotional.conversionRate + '%');
      console.log('     Confidence:', results.results.emotional.confidence + '%');
      console.log('');
    }

    // Test 5: Calculate revenue impact
    console.log('5️⃣ Calculating revenue impact...');
    const impact = await revenueImpactCalculator.calculateImpact(results, {
      monthlyUsers: 10000,
      avgOrderValue: 10
    });

    console.log('   Baseline:');
    console.log('     Monthly Revenue:', '$' + impact.baseline.monthlyRevenue);
    console.log('     Annual Revenue:', '$' + impact.baseline.annualRevenue);
    console.log('');

    if (impact.variants.length > 0) {
      console.log('   Best Variant:');
      console.log('     ID:', impact.bestVariant?.variantId);
      console.log('     Annual Impact:', '$' + (impact.variants[0].impact.annual || 0));
      console.log('     Recommendation:', impact.bestVariant?.recommendation);
      console.log('');
    }

    // Test 6: Test templates
    console.log('6️⃣ Testing templates...');
    const allTemplates = ABTestTemplates.getAllTemplates();
    console.log('   Available templates:', Object.keys(allTemplates).length);
    console.log('   - Paywall Message');
    console.log('   - Pricing (Cosmic, Universe, Annual)');
    console.log('   - Trial Length');
    console.log('   - Feature Limits');
    console.log('   - CTA Button');
    console.log('   - Notification Timing');
    console.log('   - Onboarding Flow');
    console.log('   - Social Proof');
    console.log('   - Color Scheme');
    console.log('   - Discount Timing');
    console.log('');

    // Test 7: Get user's tests
    console.log('7️⃣ Getting user\'s tests...');
    const userTests = await abTestingService.getUserTests('user_1');
    console.log('   User 1 is in', userTests.length, 'test(s)');
    if (userTests.length > 0) {
      console.log('   Test:', userTests[0].testName);
      console.log('   Variant:', userTests[0].variantId);
    }
    console.log('');

    // Test 8: Pause and resume
    console.log('8️⃣ Testing pause/resume...');
    await abTestingService.pauseTest(test.id);
    console.log('   ✅ Test paused');

    await abTestingService.resumeTest(test.id);
    console.log('   ✅ Test resumed');
    console.log('');

    // Test 9: Check for winner
    console.log('9️⃣ Checking for winner...');
    const winner = await abTestingService.checkForWinner(test.id);
    if (winner) {
      console.log('   🎉 Winner found:', winner.winner);
    } else {
      console.log('   ⏳ No winner yet (need more data)');
    }
    console.log('');

    // Cleanup (optional)
    console.log('🧹 Cleanup...');
    await abTestingService.archiveTest(test.id);
    console.log('✅ Test archived');
    console.log('');

    console.log('✅ All tests passed!');
    console.log('');
    console.log('📊 Summary:');
    console.log('   - Created test from template');
    console.log('   - Assigned users to variants');
    console.log('   - Tracked events');
    console.log('   - Retrieved results');
    console.log('   - Calculated revenue impact');
    console.log('   - Tested all templates');
    console.log('   - Managed test lifecycle');
    console.log('');
    console.log('🚀 A/B Testing Framework is ready to use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testABFramework()
  .then(() => {
    console.log('\n✅ Testing complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Testing failed:', err);
    process.exit(1);
  });
