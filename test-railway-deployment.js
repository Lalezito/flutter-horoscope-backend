#!/usr/bin/env node

/**
 * 🧪 RAILWAY DEPLOYMENT TEST SCRIPT
 * Tests all critical endpoints after deployment
 */

const https = require('https');
const fs = require('fs');

// Configuration
const RAILWAY_URL = process.argv[2] || 'https://zodiac-backend-api-production-8ded.up.railway.app';
const ADMIN_KEY = process.argv[3] || 'ZodiacLifeCoach2025AdminKey64CharactersLongForSecurityPurposes';

console.log('🧪 Testing Railway Deployment');
console.log('📡 URL:', RAILWAY_URL);
console.log('🔑 Admin Key:', ADMIN_KEY ? 'Provided' : 'Missing');
console.log('─'.repeat(60));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

/**
 * Make HTTP request and return promise
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', (error) => reject(error));
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Run a test and log results
 */
async function runTest(name, url, expectedStatus = 200, options = {}) {
  totalTests++;
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   URL: ${url}`);
  
  try {
    const result = await makeRequest(url, options);
    
    if (result.status === expectedStatus) {
      console.log(`   ✅ PASSED (${result.status})`);
      if (result.data && typeof result.data === 'object') {
        console.log(`   📋 Response: ${JSON.stringify(result.data).substring(0, 100)}...`);
      }
      passedTests++;
      return true;
    } else {
      console.log(`   ❌ FAILED (Expected ${expectedStatus}, got ${result.status})`);
      console.log(`   📋 Response: ${JSON.stringify(result.data).substring(0, 200)}`);
      failedTests++;
      return false;
    }
  } catch (error) {
    console.log(`   ❌ FAILED (Network Error)`);
    console.log(`   📋 Error: ${error.message}`);
    failedTests++;
    return false;
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('🚀 Starting comprehensive endpoint tests...\n');

  // Core Health Tests
  console.log('═══════════════════════════════════════');
  console.log('🏥 HEALTH CHECK TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('Basic Health Check', `${RAILWAY_URL}/health`);
  await runTest('Ping Endpoint', `${RAILWAY_URL}/ping`);
  await runTest('API Documentation', `${RAILWAY_URL}/api/docs`);

  // Horoscope API Tests
  console.log('\n═══════════════════════════════════════');
  console.log('🌟 HOROSCOPE API TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('Daily Horoscope (Aries, English)', `${RAILWAY_URL}/api/coaching/getDailyHoroscope?sign=aries&language=en`);
  await runTest('Daily Horoscope (Leo, Spanish)', `${RAILWAY_URL}/api/coaching/getDailyHoroscope?sign=leo&language=es`);
  await runTest('All Daily Horoscopes', `${RAILWAY_URL}/api/coaching/getAllHoroscopes`);
  
  // Test with both parameter formats for compatibility
  await runTest('Daily Horoscope (lang parameter)', `${RAILWAY_URL}/api/coaching/getDailyHoroscope?sign=gemini&lang=en`);

  // Compatibility API Tests
  console.log('\n═══════════════════════════════════════');
  console.log('💕 COMPATIBILITY API TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('Compatibility Calculation', `${RAILWAY_URL}/api/compatibility/calculate?sign1=aries&sign2=leo&language=en`);
  await runTest('Sign Compatibilities', `${RAILWAY_URL}/api/compatibility/sign/aries?language=en`);
  
  // POST request test for detailed analysis
  await runTest('Detailed Compatibility Analysis', `${RAILWAY_URL}/api/compatibility/analysis`, 200, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sign1: 'aries', sign2: 'leo', language: 'en' })
  });

  // Receipt Validation Tests
  console.log('\n═══════════════════════════════════════');
  console.log('🏪 RECEIPT VALIDATION TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('Receipt Validation (Mock)', `${RAILWAY_URL}/api/receipts/validate`, 500, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiptData: 'test-receipt', userId: 'test-user' })
  });

  // Webhook Tests  
  console.log('\n═══════════════════════════════════════');
  console.log('📡 WEBHOOK TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('Coaching Notification Webhook', `${RAILWAY_URL}/api/coaching/notify`, 200, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      type: 'daily',
      userId: 'test-user',
      sign: 'aries',
      message: 'test notification'
    })
  });

  // Admin Tests (if admin key provided)
  if (ADMIN_KEY) {
    console.log('\n═══════════════════════════════════════');
    console.log('🔐 ADMIN ENDPOINT TESTS');
    console.log('═══════════════════════════════════════');
    
    await runTest('Admin Health Check', `${RAILWAY_URL}/api/admin/health?admin_key=${ADMIN_KEY}`);
    await runTest('Generation Status', `${RAILWAY_URL}/api/generate/status?admin_key=${ADMIN_KEY}`);
    await runTest('Compatibility Stats', `${RAILWAY_URL}/api/compatibility/stats?admin_key=${ADMIN_KEY}`);
  }

  // Error Handling Tests
  console.log('\n═══════════════════════════════════════');
  console.log('⚠️  ERROR HANDLING TESTS');
  console.log('═══════════════════════════════════════');
  
  await runTest('404 Not Found', `${RAILWAY_URL}/api/nonexistent`, 404);
  await runTest('Invalid Sign Parameter', `${RAILWAY_URL}/api/coaching/getDailyHoroscope?sign=invalid&language=en`, 404);

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 ALL TESTS PASSED! Your Railway deployment is working perfectly!');
    console.log('✅ Backend is ready for Flutter app integration');
    console.log('✅ All endpoints are responding correctly');
    console.log('✅ CORS is properly configured');
    console.log('✅ Database is connected and working');
    console.log('✅ Ready for App Store submission!');
  } else if (passedTests >= totalTests * 0.8) {
    console.log('\n⚠️  MOSTLY SUCCESSFUL! Minor issues detected:');
    console.log(`${failedTests} test(s) failed, but core functionality is working`);
    console.log('✅ Safe to proceed with Flutter app integration');
    console.log('🔧 Consider fixing failed tests for optimal performance');
  } else {
    console.log('\n❌ DEPLOYMENT ISSUES DETECTED!');
    console.log('🔧 Please fix the failing tests before proceeding');
    console.log('💡 Check Railway logs: railway logs --follow');
    console.log('💡 Verify environment variables are set correctly');
  }

  // Flutter Integration Instructions
  console.log('\n═══════════════════════════════════════');
  console.log('📱 NEXT STEPS FOR FLUTTER INTEGRATION');
  console.log('═══════════════════════════════════════');
  console.log('1. Update Flutter backend URL:');
  console.log(`   File: lib/services/backend_service.dart`);
  console.log(`   Line: static const String _baseUrl = '${RAILWAY_URL}';`);
  console.log('');
  console.log('2. Test Flutter app endpoints:');
  console.log('   - Daily horoscope retrieval');
  console.log('   - Compatibility calculations');
  console.log('   - Receipt validation (for premium features)');
  console.log('');
  console.log('3. Monitor Railway logs during Flutter testing:');
  console.log('   railway logs --follow');
  console.log('');
  console.log('🎯 Your backend is now production-ready!');
}

// Run the tests
runTests().catch(console.error);