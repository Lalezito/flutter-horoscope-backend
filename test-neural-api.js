#!/usr/bin/env node

/**
 * 🚀 NEURAL COMPATIBILITY API TEST RUNNER
 * Quick test runner for validating neural compatibility endpoints
 */

const NeuralCompatibilityTests = require('./src/tests/neuralCompatibilityTests');

async function main() {
  console.log('🧠 Neural Compatibility API Test Runner\n');
  
  // Check if server is running
  const serverURL = process.env.SERVER_URL || 'http://localhost:3000';
  console.log(`🔗 Testing server: ${serverURL}`);
  
  // Set admin key for testing
  process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'your-admin-key-here';
  
  try {
    const tests = new NeuralCompatibilityTests(serverURL);
    await tests.runAllTests();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}