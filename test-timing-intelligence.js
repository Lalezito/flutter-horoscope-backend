#!/usr/bin/env node

/**
 * 🕰️ ASTROLOGICAL TIMING INTELLIGENCE TEST SCRIPT
 * 
 * Comprehensive testing of the astrological timing intelligence system
 * Tests core functionality, API endpoints, and edge cases.
 */

const axios = require('axios');
const moment = require('moment-timezone');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const API_BASE = `${BASE_URL}/api/timing`;

class TimingIntelligenceTest {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
        
        this.authToken = null; // Would be set with actual authentication
    }

    /**
     * Run all timing intelligence tests
     */
    async runTests() {
        console.log('🕰️ Starting Astrological Timing Intelligence Tests\n');
        console.log('=' .repeat(60));

        try {
            // Test service health
            await this.testServiceHealth();

            // Test basic functionality
            await this.testGetCurrentConditions();
            await this.testGetAvailableCategories();
            await this.testQuickRecommendations();
            
            // Test core timing recommendations
            await this.testBasicTimingRecommendations();
            await this.testUrgentTimingAnalysis();
            await this.testMercuryRetrogradeInfo();
            
            // Test edge cases
            await this.testInvalidParameters();
            await this.testRateLimiting();
            
            // Performance tests
            await this.testResponseTimes();
            
            // Summary
            this.printTestSummary();

        } catch (error) {
            console.error('❌ Test suite failed with error:', error.message);
            process.exit(1);
        }
    }

    /**
     * Test service health and availability
     */
    async testServiceHealth() {
        await this.runTest('Service Health Check', async () => {
            const response = await axios.get(`${API_BASE}/health`);
            
            this.assert(response.status === 200, 'Health endpoint should return 200');
            this.assert(response.data.success === true, 'Health check should indicate success');
            this.assert(response.data.service === 'Astrological Timing Intelligence', 'Correct service name');
            this.assert(Array.isArray(response.data.features), 'Features should be listed');
            
            console.log(`   ✓ Service: ${response.data.service}`);
            console.log(`   ✓ Status: ${response.data.status}`);
            console.log(`   ✓ Features: ${response.data.features.length} available`);
        });
    }

    /**
     * Test current astrological conditions endpoint
     */
    async testGetCurrentConditions() {
        await this.runTest('Current Astrological Conditions', async () => {
            const response = await axios.get(`${API_BASE}/conditions`);
            
            this.assert(response.status === 200, 'Conditions endpoint should return 200');
            this.assert(response.data.success === true, 'Should indicate success');
            this.assert(response.data.data.timestamp, 'Should include timestamp');
            this.assert(response.data.data.lunarInfo, 'Should include lunar information');
            this.assert(Array.isArray(response.data.data.planetaryPositions), 'Should include planetary positions');
            this.assert(typeof response.data.data.retrogradeCount === 'number', 'Should include retrograde count');
            
            console.log(`   ✓ Lunar Phase: ${response.data.data.lunarInfo.phase}`);
            console.log(`   ✓ Retrograde Planets: ${response.data.data.retrogradeCount}`);
            console.log(`   ✓ Planetary Positions: ${response.data.data.planetaryPositions.length}`);
        });
    }

    /**
     * Test available categories endpoint
     */
    async testGetAvailableCategories() {
        await this.runTest('Available Categories', async () => {
            const response = await axios.get(`${API_BASE}/categories`);
            
            this.assert(response.status === 200, 'Categories endpoint should return 200');
            this.assert(response.data.success === true, 'Should indicate success');
            this.assert(response.data.data.categories, 'Should include categories');
            this.assert(response.data.data.totalCategories > 0, 'Should have multiple categories');
            
            const categories = Object.keys(response.data.data.categories);
            const expectedCategories = ['business', 'relationships', 'financial', 'health', 'creative', 'legal', 'travel', 'home'];
            
            for (const category of expectedCategories) {
                this.assert(categories.includes(category), `Should include ${category} category`);
            }
            
            console.log(`   ✓ Categories Available: ${categories.length}`);
            console.log(`   ✓ Categories: ${categories.join(', ')}`);
        });
    }

    /**
     * Test quick recommendations for different categories
     */
    async testQuickRecommendations() {
        const categories = ['business', 'relationships', 'financial'];
        
        for (const category of categories) {
            await this.runTest(`Quick Recommendations - ${category}`, async () => {
                const response = await axios.get(`${API_BASE}/quick/${category}?timeframe=7`);
                
                this.assert(response.status === 200, 'Quick recommendations should return 200');
                this.assert(response.data.success === true, 'Should indicate success');
                this.assert(response.data.data.category === category, 'Should match requested category');
                this.assert(Array.isArray(response.data.data.topRecommendations), 'Should include recommendations array');
                this.assert(response.data.data.topRecommendations.length > 0, 'Should have at least one recommendation');
                
                const firstRec = response.data.data.topRecommendations[0];
                this.assert(firstRec.dateTime, 'Recommendation should have dateTime');
                this.assert(typeof firstRec.score === 'number', 'Recommendation should have numeric score');
                this.assert(firstRec.summary, 'Recommendation should have summary');
                
                console.log(`   ✓ ${category}: ${response.data.data.topRecommendations.length} recommendations`);
                console.log(`   ✓ Best Score: ${firstRec.score}%`);
            });
        }
    }

    /**
     * Test basic timing recommendations
     */
    async testBasicTimingRecommendations() {
        await this.runTest('Basic Timing Recommendations', async () => {
            const requestData = {
                activity: 'job_interview',
                category: 'business',
                timeframe: 14,
                urgency: 'normal',
                personalizedBirthChart: false,
                includeExplanations: true,
                timezone: 'America/New_York'
            };
            
            const response = await axios.post(`${API_BASE}/recommendations`, requestData);
            
            this.assert(response.status === 200, 'Recommendations endpoint should return 200');
            this.assert(response.data.success === true, 'Should indicate success');
            this.assert(response.data.data.activity === 'job_interview', 'Should match requested activity');
            this.assert(response.data.data.category === 'business', 'Should match requested category');
            this.assert(Array.isArray(response.data.data.recommendations), 'Should include recommendations array');
            
            if (response.data.data.recommendations.length > 0) {
                const firstRec = response.data.data.recommendations[0];
                this.assert(firstRec.rank === 1, 'First recommendation should have rank 1');
                this.assert(firstRec.dateTime, 'Should have dateTime');
                this.assert(firstRec.localTime, 'Should have localTime');
                this.assert(typeof firstRec.score === 'number', 'Should have numeric score');
                this.assert(firstRec.confidence >= 0 && firstRec.confidence <= 1, 'Confidence should be between 0 and 1');
                this.assert(firstRec.astrologicalFactors, 'Should include astrological factors');
                
                console.log(`   ✓ Recommendations: ${response.data.data.recommendations.length}`);
                console.log(`   ✓ Best Time: ${firstRec.localTime} (Score: ${firstRec.score}%)`);
                console.log(`   ✓ Confidence: ${Math.round(firstRec.confidence * 100)}%`);
            }
        });
    }

    /**
     * Test urgent timing analysis
     */
    async testUrgentTimingAnalysis() {
        await this.runTest('Urgent Timing Analysis', async () => {
            const deadline = moment().add(3, 'days').toISOString();
            const requestData = {
                activity: 'contract_signing',
                category: 'legal',
                mustCompleteBy: deadline,
                timezone: 'UTC'
            };
            
            const response = await axios.post(`${API_BASE}/urgent`, requestData);
            
            this.assert(response.status === 200, 'Urgent timing should return 200');
            this.assert(response.data.success === true, 'Should indicate success');
            this.assert(response.data.data.availableWindows >= 0, 'Should report available windows');
            this.assert(response.data.data.urgencyLevel, 'Should indicate urgency level');
            this.assert(response.data.data.timeRemaining, 'Should show time remaining');
            this.assert(response.data.deadline === deadline, 'Should echo deadline');
            
            console.log(`   ✓ Available Windows: ${response.data.data.availableWindows}`);
            console.log(`   ✓ Urgency Level: ${response.data.data.urgencyLevel}`);
            console.log(`   ✓ Time Remaining: ${response.data.data.timeRemaining}`);
        });
    }

    /**
     * Test Mercury retrograde information
     */
    async testMercuryRetrogradeInfo() {
        await this.runTest('Mercury Retrograde Information', async () => {
            const response = await axios.get(`${API_BASE}/mercury-retrograde`);
            
            this.assert(response.status === 200, 'Mercury retrograde endpoint should return 200');
            this.assert(response.data.success === true, 'Should indicate success');
            this.assert(response.data.data.currentStatus, 'Should include current status');
            this.assert(typeof response.data.data.currentStatus.isRetrograde === 'boolean', 'Should indicate if retrograde');
            this.assert(Array.isArray(response.data.data.avoidDuring), 'Should list activities to avoid');
            this.assert(Array.isArray(response.data.data.goodFor), 'Should list good activities');
            this.assert(Array.isArray(response.data.data.tips), 'Should provide tips');
            
            console.log(`   ✓ Mercury Retrograde: ${response.data.data.currentStatus.isRetrograde ? 'Yes' : 'No'}`);
            console.log(`   ✓ Avoid Activities: ${response.data.data.avoidDuring.length}`);
            console.log(`   ✓ Good Activities: ${response.data.data.goodFor.length}`);
        });
    }

    /**
     * Test invalid parameters handling
     */
    async testInvalidParameters() {
        await this.runTest('Invalid Parameters Handling', async () => {
            // Test invalid category
            try {
                await axios.get(`${API_BASE}/quick/invalid_category`);
                this.assert(false, 'Should reject invalid category');
            } catch (error) {
                this.assert(error.response.status === 400, 'Should return 400 for invalid category');
            }

            // Test invalid timing request
            try {
                const invalidRequest = {
                    activity: '', // Empty activity
                    category: 'invalid_category',
                    timeframe: 1000 // Too large timeframe
                };
                await axios.post(`${API_BASE}/recommendations`, invalidRequest);
                this.assert(false, 'Should reject invalid timing request');
            } catch (error) {
                this.assert(error.response.status === 400, 'Should return 400 for invalid request');
            }

            console.log('   ✓ Invalid category rejected');
            console.log('   ✓ Invalid request parameters rejected');
        });
    }

    /**
     * Test rate limiting behavior
     */
    async testRateLimiting() {
        await this.runTest('Rate Limiting', async () => {
            // Make multiple rapid requests to test rate limiting
            const requests = [];
            for (let i = 0; i < 5; i++) {
                requests.push(axios.get(`${API_BASE}/conditions`));
            }

            const responses = await Promise.allSettled(requests);
            const successful = responses.filter(r => r.status === 'fulfilled').length;
            
            this.assert(successful > 0, 'Some requests should succeed');
            
            // Check for rate limit headers
            const firstResponse = responses.find(r => r.status === 'fulfilled');
            if (firstResponse) {
                const headers = firstResponse.value.headers;
                console.log(`   ✓ Rate limit headers present: ${!!headers['x-ratelimit-limit']}`);
                console.log(`   ✓ Successful requests: ${successful}/5`);
            }
        });
    }

    /**
     * Test response times for performance
     */
    async testResponseTimes() {
        await this.runTest('Response Time Performance', async () => {
            const endpoints = [
                { name: 'Current Conditions', url: `${API_BASE}/conditions` },
                { name: 'Categories', url: `${API_BASE}/categories` },
                { name: 'Quick Business', url: `${API_BASE}/quick/business?timeframe=3` }
            ];

            for (const endpoint of endpoints) {
                const startTime = Date.now();
                const response = await axios.get(endpoint.url);
                const responseTime = Date.now() - startTime;

                this.assert(response.status === 200, `${endpoint.name} should return 200`);
                this.assert(responseTime < 5000, `${endpoint.name} should respond within 5 seconds`);
                
                console.log(`   ✓ ${endpoint.name}: ${responseTime}ms`);
            }
        });
    }

    /**
     * Helper method to run individual tests
     */
    async runTest(testName, testFunction) {
        this.testResults.total++;
        console.log(`\n🧪 Testing: ${testName}`);
        
        try {
            await testFunction();
            this.testResults.passed++;
            this.testResults.details.push({ name: testName, status: 'PASSED' });
            console.log(`✅ ${testName} - PASSED`);
        } catch (error) {
            this.testResults.failed++;
            this.testResults.details.push({ 
                name: testName, 
                status: 'FAILED', 
                error: error.message 
            });
            console.log(`❌ ${testName} - FAILED: ${error.message}`);
        }
    }

    /**
     * Assertion helper
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    /**
     * Print test summary
     */
    printTestSummary() {
        console.log('\n' + '=' .repeat(60));
        console.log('🕰️ ASTROLOGICAL TIMING INTELLIGENCE TEST SUMMARY');
        console.log('=' .repeat(60));
        
        console.log(`Total Tests: ${this.testResults.total}`);
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`Success Rate: ${Math.round((this.testResults.passed / this.testResults.total) * 100)}%`);
        
        if (this.testResults.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n🎯 Test Categories Covered:');
        console.log('   • Service Health & Availability');
        console.log('   • Current Astrological Conditions');
        console.log('   • Timing Recommendations (Basic & Urgent)');
        console.log('   • Quick Category Recommendations');
        console.log('   • Mercury Retrograde Intelligence');
        console.log('   • Error Handling & Validation');
        console.log('   • Rate Limiting & Performance');
        
        if (this.testResults.failed === 0) {
            console.log('\n🎉 All tests passed! Astrological Timing Intelligence is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please check the implementation.');
            process.exit(1);
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new TimingIntelligenceTest();
    tester.runTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = TimingIntelligenceTest;