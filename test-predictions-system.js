#!/usr/bin/env node

/**
 * COMPREHENSIVE PREDICTION SYSTEM TEST
 * 
 * Tests all components of the verifiable predictions system
 * Validates database migrations, services, and API endpoints
 */

const dotenv = require('dotenv');
const axios = require('axios');
const moment = require('moment');

// Load environment
dotenv.config();

const TEST_CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    testUserId: 'test_user_predictions_' + Date.now(),
    adminKey: process.env.ADMIN_KEY,
    categories: ['love', 'career', 'finance', 'health', 'social'],
    timeout: 30000
};

let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

// Test utilities
function logTest(testName, status, details = '') {
    testResults.total++;
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ ${testName}: PASSED ${details}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${testName}: FAILED ${details}`);
        testResults.errors.push({ test: testName, details });
    }
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${TEST_CONFIG.baseUrl}${endpoint}`,
            timeout: TEST_CONFIG.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
}

async function testDatabaseMigration() {
    console.log('\n🗄️ Testing Database Migration...');
    
    try {
        const db = require('./src/config/db');
        
        // Test predictions table
        const predictionsResult = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'predictions'
            ORDER BY ordinal_position
        `);
        
        const expectedColumns = [
            'id', 'user_id', 'prediction_type', 'prediction_content', 
            'predicted_date', 'confidence_score', 'verification_status',
            'prediction_category', 'created_at'
        ];
        
        const actualColumns = predictionsResult.rows.map(row => row.column_name);
        const hasAllColumns = expectedColumns.every(col => actualColumns.includes(col));
        
        logTest('Predictions Table Schema', hasAllColumns ? 'PASS' : 'FAIL', 
               hasAllColumns ? '(All columns present)' : `(Missing: ${expectedColumns.filter(c => !actualColumns.includes(c)).join(', ')})`);
        
        // Test prediction_categories table
        const categoriesResult = await db.query(`
            SELECT COUNT(*) as count FROM prediction_categories
        `);
        
        const categoryCount = parseInt(categoriesResult.rows[0].count);
        logTest('Prediction Categories Data', categoryCount >= 6 ? 'PASS' : 'FAIL', 
               `(${categoryCount} categories found)`);
        
        // Test indexes
        const indexResult = await db.query(`
            SELECT indexname FROM pg_indexes 
            WHERE tablename = 'predictions' 
            AND indexname LIKE 'idx_%'
        `);
        
        logTest('Database Indexes', indexResult.rows.length >= 3 ? 'PASS' : 'FAIL',
               `(${indexResult.rows.length} indexes found)`);
        
    } catch (error) {
        logTest('Database Migration', 'FAIL', error.message);
    }
}

async function testPredictionGeneration() {
    console.log('\n🔮 Testing Prediction Generation...');
    
    for (const category of TEST_CONFIG.categories) {
        const requestData = {
            userId: TEST_CONFIG.testUserId,
            category: category,
            timeframe: 48
        };
        
        const result = await makeRequest('POST', '/api/predictions/generate', requestData);
        
        if (result.success && result.data.success) {
            const prediction = result.data.prediction;
            logTest(`Generate ${category} Prediction`, 'PASS', 
                   `(ID: ${prediction.id}, Confidence: ${prediction.confidence})`);
                   
            // Store prediction ID for later tests
            if (!global.testPredictionIds) global.testPredictionIds = [];
            global.testPredictionIds.push({
                id: prediction.id,
                category: category,
                userId: TEST_CONFIG.testUserId
            });
        } else {
            logTest(`Generate ${category} Prediction`, 'FAIL', 
                   result.error?.message || 'Unknown error');
        }
        
        // Add small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

async function testPredictionRetrieval() {
    console.log('\n📋 Testing Prediction Retrieval...');
    
    // Test get user predictions
    const result = await makeRequest('GET', `/api/predictions/user/${TEST_CONFIG.testUserId}`);
    
    if (result.success && result.data.success) {
        const predictions = result.data.predictions;
        logTest('Get User Predictions', 'PASS', 
               `(${predictions.length} predictions retrieved)`);
               
        // Test individual prediction details
        if (predictions.length > 0) {
            const prediction = predictions[0];
            const hasRequiredFields = prediction.id && prediction.content && 
                                    prediction.category && prediction.confidence !== undefined;
            logTest('Prediction Data Structure', hasRequiredFields ? 'PASS' : 'FAIL',
                   hasRequiredFields ? '(All fields present)' : '(Missing required fields)');
        }
    } else {
        logTest('Get User Predictions', 'FAIL', 
               result.error?.message || 'Unknown error');
    }
}

async function testPredictionVerification() {
    console.log('\n✅ Testing Prediction Verification...');
    
    if (!global.testPredictionIds || global.testPredictionIds.length === 0) {
        logTest('Prediction Verification Setup', 'FAIL', 'No predictions available for testing');
        return;
    }
    
    const testPrediction = global.testPredictionIds[0];
    const verificationData = {
        userId: testPrediction.userId,
        outcome: 'Test prediction verification - this is a test outcome',
        feedbackType: 'accurate',
        accuracyRating: 4,
        details: 'Test verification details',
        helpfulRating: 5
    };
    
    const result = await makeRequest('PUT', `/api/predictions/${testPrediction.id}/verify`, verificationData);
    
    if (result.success && result.data.success) {
        const verification = result.data.verification;
        logTest('Prediction Verification', 'PASS', 
               `(Status: ${verification.status}, Success Rate: ${verification.user_success_rate}%)`);
    } else {
        logTest('Prediction Verification', 'FAIL', 
               result.error?.message || 'Unknown error');
    }
}

async function testUserAnalytics() {
    console.log('\n📊 Testing User Analytics...');
    
    const result = await makeRequest('GET', `/api/predictions/analytics/${TEST_CONFIG.testUserId}`);
    
    if (result.success && result.data.success) {
        const analytics = result.data.analytics;
        const hasValidStructure = analytics.overview && 
                                 analytics.overview.totalPredictions !== undefined &&
                                 analytics.overview.successRate !== undefined;
        logTest('User Analytics', hasValidStructure ? 'PASS' : 'FAIL',
               hasValidStructure ? `(${analytics.overview.totalPredictions} total predictions, ${analytics.overview.successRate}% success rate)` : '(Invalid structure)');
    } else {
        logTest('User Analytics', 'FAIL', 
               result.error?.message || 'Unknown error');
    }
}

async function testFirebaseTokenUpdate() {
    console.log('\n🔔 Testing Firebase Token Management...');
    
    const tokenData = {
        userId: TEST_CONFIG.testUserId,
        firebaseToken: 'test_firebase_token_' + Date.now()
    };
    
    const result = await makeRequest('POST', '/api/predictions/alerts/token', tokenData);
    
    if (result.success && result.data.success) {
        logTest('Firebase Token Update', 'PASS', '(Token updated successfully)');
    } else {
        logTest('Firebase Token Update', 'FAIL', 
               result.error?.message || 'Unknown error');
    }
}

async function testAlertPreferences() {
    console.log('\n⚙️ Testing Alert Preferences...');
    
    // Test get preferences
    const getResult = await makeRequest('GET', `/api/predictions/alerts/preferences/${TEST_CONFIG.testUserId}`);
    
    if (getResult.success && getResult.data.success) {
        logTest('Get Alert Preferences', 'PASS', '(Preferences retrieved)');
        
        // Test update preferences
        const updateData = {
            alert_48hr: true,
            alert_24hr: true,
            alert_2hr: false,
            verification_reminders: true,
            notification_frequency: 'normal'
        };
        
        const updateResult = await makeRequest('PUT', `/api/predictions/alerts/preferences/${TEST_CONFIG.testUserId}`, updateData);
        
        if (updateResult.success && updateResult.data.success) {
            logTest('Update Alert Preferences', 'PASS', '(Preferences updated successfully)');
        } else {
            logTest('Update Alert Preferences', 'FAIL', 
                   updateResult.error?.message || 'Unknown error');
        }
    } else {
        logTest('Get Alert Preferences', 'FAIL', 
               getResult.error?.message || 'Unknown error');
    }
}

async function testSystemStats() {
    console.log('\n🌐 Testing System Statistics (Admin)...');
    
    if (!TEST_CONFIG.adminKey) {
        logTest('System Stats', 'SKIP', '(Admin key not configured)');
        return;
    }
    
    const result = await makeRequest('GET', `/api/predictions/system/stats?admin_key=${TEST_CONFIG.adminKey}&timeframe=30 days`);
    
    if (result.success && result.data.success) {
        const stats = result.data.system_stats;
        const hasValidStructure = stats.predictions && stats.predictions.overall &&
                                 stats.predictions.overall.totalPredictions !== undefined;
        logTest('System Statistics', hasValidStructure ? 'PASS' : 'FAIL',
               hasValidStructure ? `(${stats.predictions.overall.totalPredictions} total predictions)` : '(Invalid structure)');
    } else {
        logTest('System Statistics', 'FAIL', 
               result.error?.message || 'Unknown error');
    }
}

async function testErrorHandling() {
    console.log('\n🚨 Testing Error Handling...');
    
    // Test invalid category
    const invalidCategoryResult = await makeRequest('POST', '/api/predictions/generate', {
        userId: TEST_CONFIG.testUserId,
        category: 'invalid_category'
    });
    
    logTest('Invalid Category Error', 
           !invalidCategoryResult.success && invalidCategoryResult.status === 400 ? 'PASS' : 'FAIL',
           invalidCategoryResult.success ? '(Should have failed)' : '(Properly rejected)');
    
    // Test missing user ID
    const missingUserResult = await makeRequest('POST', '/api/predictions/generate', {
        category: 'love'
    });
    
    logTest('Missing User ID Error', 
           !missingUserResult.success && missingUserResult.status === 400 ? 'PASS' : 'FAIL',
           missingUserResult.success ? '(Should have failed)' : '(Properly rejected)');
    
    // Test invalid prediction verification
    const invalidVerifyResult = await makeRequest('PUT', '/api/predictions/99999/verify', {
        userId: TEST_CONFIG.testUserId,
        outcome: 'test',
        feedbackType: 'accurate'
    });
    
    logTest('Invalid Prediction Verification', 
           !invalidVerifyResult.success && invalidVerifyResult.status === 404 ? 'PASS' : 'FAIL',
           invalidVerifyResult.success ? '(Should have failed)' : '(Properly rejected)');
}

async function testHealthCheck() {
    console.log('\n💚 Testing Health Check...');
    
    const result = await makeRequest('GET', '/api/predictions/health');
    
    if (result.success && result.data.status === 'healthy') {
        logTest('Prediction System Health', 'PASS', '(All services operational)');
    } else {
        logTest('Prediction System Health', 'FAIL', 
               result.error?.message || 'System unhealthy');
    }
}

async function testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    const startTime = Date.now();
    
    // Test concurrent prediction generation
    const concurrentRequests = Array.from({length: 5}, (_, i) => 
        makeRequest('POST', '/api/predictions/generate', {
            userId: `perf_test_user_${i}_${Date.now()}`,
            category: 'love'
        })
    );
    
    const results = await Promise.allSettled(concurrentRequests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    logTest('Concurrent Predictions Performance', 
           successCount >= 3 && totalTime < 15000 ? 'PASS' : 'FAIL',
           `(${successCount}/5 successful in ${totalTime}ms)`);
}

async function cleanup() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
        const db = require('./src/config/db');
        
        // Clean up test predictions
        await db.query(`
            DELETE FROM predictions 
            WHERE user_id LIKE 'test_%' OR user_id LIKE 'perf_test_%'
        `);
        
        // Clean up test feedback
        await db.query(`
            DELETE FROM prediction_feedback 
            WHERE prediction_id NOT IN (SELECT id FROM predictions)
        `);
        
        // Clean up test analytics
        await db.query(`
            DELETE FROM prediction_analytics 
            WHERE user_id LIKE 'test_%' OR user_id LIKE 'perf_test_%'
        `);
        
        console.log('✅ Test data cleanup completed');
        
    } catch (error) {
        console.log('❌ Cleanup error:', error.message);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Comprehensive Prediction System Tests...\n');
    console.log(`Base URL: ${TEST_CONFIG.baseUrl}`);
    console.log(`Test User ID: ${TEST_CONFIG.testUserId}\n`);
    
    try {
        await testDatabaseMigration();
        await testPredictionGeneration();
        await testPredictionRetrieval();
        await testPredictionVerification();
        await testUserAnalytics();
        await testFirebaseTokenUpdate();
        await testAlertPreferences();
        await testSystemStats();
        await testErrorHandling();
        await testHealthCheck();
        await testPerformance();
    } catch (error) {
        console.error('❌ Test execution error:', error);
    } finally {
        await cleanup();
    }
    
    // Print final results
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ FAILED TESTS:');
        testResults.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error.test}: ${error.details}`);
        });
    }
    
    console.log('\n🔮 Prediction System Test Suite Complete!');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n⚠️ Test interrupted, cleaning up...');
    await cleanup();
    process.exit(1);
});

// Run tests
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('❌ Fatal test error:', error);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testResults,
    TEST_CONFIG
};