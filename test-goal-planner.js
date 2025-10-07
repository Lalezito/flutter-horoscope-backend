/**
 * Test script for Goal Planner API
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test data
const testGoalRequest = {
  userId: 'test_user_123',
  zodiacSign: 'aries',
  objective: 'I want to advance in my career and become a team leader within 6 months',
  emotionalState: 'motivated',
  focusArea: 'career',
  timeframe: 'monthly',
  languageCode: 'en'
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  try {
    const result = await makeRequest('GET', '/api/ai/goals/health');
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    return result.status === 200;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testGenerateGoal() {
  console.log('\n🎯 Testing Goal Generation...');
  try {
    const result = await makeRequest('POST', '/api/ai/goals', testGoalRequest);
    console.log('Status:', result.status);

    if (result.status === 200 || result.status === 201) {
      console.log('✅ Goal generated successfully!');
      console.log('Goal ID:', result.data.goalId);
      console.log('\nMain Goal:', JSON.stringify(result.data.goal.mainGoal, null, 2));
      console.log('\nMicro Habits:', JSON.stringify(result.data.goal.microHabits, null, 2));
      return { success: true, goalId: result.data.goalId };
    } else if (result.status === 403) {
      console.log('⚠️ Premium access required (expected for non-premium users)');
      console.log('Response:', JSON.stringify(result.data, null, 2));
      return { success: false, reason: 'premium_required' };
    } else {
      console.log('❌ Unexpected response:', JSON.stringify(result.data, null, 2));
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Goal generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testGetUserGoals(userId) {
  console.log('\n📋 Testing Get User Goals...');
  try {
    const result = await makeRequest('GET', `/api/ai/goals/${userId}?status=active`);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    return result.status === 200;
  } catch (error) {
    console.error('❌ Get user goals failed:', error.message);
    return false;
  }
}

async function testCheckIn(goalId) {
  console.log('\n✅ Testing Goal Check-in...');
  const checkInData = {
    userId: 'test_user_123',
    progress: 50,
    feedback: 'Making good progress on my goals',
    mood: 'motivated'
  };

  try {
    const result = await makeRequest('POST', `/api/ai/goals/${goalId}/checkin`, checkInData);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    return result.status === 200;
  } catch (error) {
    console.error('❌ Check-in failed:', error.message);
    return false;
  }
}

async function testAnalytics(userId) {
  console.log('\n📊 Testing Goal Analytics...');
  try {
    const result = await makeRequest('GET', `/api/ai/goals/${userId}/analytics?timeframe=30d`);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    return result.status === 200;
  } catch (error) {
    console.error('❌ Analytics failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Goal Planner API Tests...');
  console.log('=====================================\n');

  const results = {
    healthCheck: false,
    generateGoal: false,
    getUserGoals: false,
    checkIn: false,
    analytics: false
  };

  // Test 1: Health Check
  results.healthCheck = await testHealthCheck();

  // Test 2: Generate Goal
  const goalResult = await testGenerateGoal();
  results.generateGoal = goalResult.success;
  const goalId = goalResult.goalId;

  // Test 3: Get User Goals
  results.getUserGoals = await testGetUserGoals('test_user_123');

  // Test 4: Check-in (if goal was created)
  if (goalId) {
    results.checkIn = await testCheckIn(goalId);
  }

  // Test 5: Analytics
  results.analytics = await testAnalytics('test_user_123');

  // Summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('=====================================');
  const passed = Object.values(results).filter(r => r === true).length;
  const total = Object.keys(results).length;

  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });

  console.log(`\n${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Check logs above for details.');
  }
}

// Check if server is running
async function checkServer() {
  try {
    await makeRequest('GET', '/health');
    return true;
  } catch (error) {
    console.error('❌ Server not running at', BASE_URL);
    console.log('Please start the server with: NODE_ENV=production node src/app.js');
    return false;
  }
}

// Run tests
checkServer().then(isRunning => {
  if (isRunning) {
    runTests().catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});
