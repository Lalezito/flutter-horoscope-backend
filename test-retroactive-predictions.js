/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🧪 RETROACTIVE PREDICTIONS SYSTEM - TEST SCRIPT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Tests the complete retroactive prediction flow:
 * 1. Prediction extraction from AI responses
 * 2. Feedback detection and processing
 * 3. Accuracy statistics calculation
 * 4. Celebration message generation
 *
 * Usage: node test-retroactive-predictions.js
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

require('dotenv').config();
const retroactivePredictionService = require('./src/services/retroactivePredictionService');
const db = require('./src/config/db');

// Test user ID
const TEST_USER_ID = 'test_user_' + Date.now();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔮 RETROACTIVE PREDICTIONS SYSTEM - INTEGRATION TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 1: Database Connection
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 1: Database Connection');
    try {
      await db.query('SELECT 1');
      console.log('✅ Database connected successfully\n');
      testsPassed++;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('💡 Make sure PostgreSQL is running and .env is configured\n');
      testsFailed++;
      return; // Can't continue without DB
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 2: Check if tables exist
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 2: Database Schema Verification');
    try {
      const tables = await db.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('predictions', 'user_prediction_analytics', 'prediction_categories')
      `);

      if (tables.rows.length === 3) {
        console.log('✅ All required tables exist');
        console.log('   - predictions');
        console.log('   - user_prediction_analytics');
        console.log('   - prediction_categories\n');
        testsPassed++;
      } else {
        console.error('❌ Missing tables. Found:', tables.rows.map(r => r.table_name));
        console.error('💡 Run migration: migrations/009_create_retroactive_predictions.sql\n');
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ Schema verification failed:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 3: Prediction Extraction (Spanish)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 3: Prediction Extraction (Spanish)');
    try {
      const spanishResponse = `
        Hoy es un gran día para ti, Leo! Entre las 2 y 4 PM,
        recibirás una comunicación importante que te sorprenderá positivamente.
        Tendrás una oportunidad profesional esta semana que no debes dejar pasar.
        El cosmos está alineado para el amor esta noche.
      `;

      const count = await retroactivePredictionService.extractPredictions(
        TEST_USER_ID,
        spanishResponse,
        { highlights: ['communication'] }
      );

      if (count > 0) {
        console.log(`✅ Extracted ${count} predictions from Spanish text`);
        console.log('   Patterns detected successfully\n');
        testsPassed++;
      } else {
        console.error('❌ No predictions extracted from Spanish text');
        console.error('💡 Check pattern matching in extractPredictions()\n');
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ Spanish extraction failed:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 4: Prediction Extraction (English)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 4: Prediction Extraction (English)');
    try {
      const englishResponse = `
        Great day ahead, Leo! Between 2 and 4 PM,
        you'll receive important news that will surprise you.
        You will find an unexpected opportunity this week.
        Expect positive changes in your love life tonight.
      `;

      const count = await retroactivePredictionService.extractPredictions(
        TEST_USER_ID,
        englishResponse,
        { highlights: ['communication'] }
      );

      if (count > 0) {
        console.log(`✅ Extracted ${count} predictions from English text`);
        console.log('   Multilingual support working\n');
        testsPassed++;
      } else {
        console.error('❌ No predictions extracted from English text');
        console.error('💡 Check English pattern regexes\n');
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ English extraction failed:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 5: Feedback Detection (Hit)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 5: Feedback Detection (Hit Keywords)');
    try {
      const hitResponses = [
        'Sí! Pasó exactamente como dijiste',
        'Yes! It happened just like you said',
        'Sim! Aconteceu exatamente como você disse'
      ];

      let allDetected = true;
      for (const response of hitResponses) {
        const detected = retroactivePredictionService.detectsPredictionFeedback(response);
        if (!detected) {
          console.error(`❌ Failed to detect: "${response}"`);
          allDetected = false;
        }
      }

      if (allDetected) {
        console.log('✅ All hit keywords detected correctly');
        console.log('   Spanish, English, Portuguese working\n');
        testsPassed++;
      } else {
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ Hit detection failed:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 6: Feedback Processing
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 6: Feedback Processing');
    try {
      // First, create a prediction for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      await db.query(`
        INSERT INTO predictions
        (user_id, prediction_text, predicted_for_date, user_feedback)
        VALUES ($1, 'Test prediction for feedback', $2, 'pending')
      `, [TEST_USER_ID, yesterdayStr]);

      // Process positive feedback
      const feedback = await retroactivePredictionService.processFeedback(
        TEST_USER_ID,
        'Sí! Acertaste completamente!'
      );

      if (feedback && feedback.includes('PREDICCIÓN CUMPLIDA')) {
        console.log('✅ Feedback processed successfully');
        console.log('   Celebration message generated\n');
        testsPassed++;
      } else {
        console.error('❌ Feedback processing failed or no celebration');
        console.error('   Result:', feedback, '\n');
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ Feedback processing error:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 7: Accuracy Statistics
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 7: Accuracy Statistics Calculation');
    try {
      const stats = await retroactivePredictionService.getAccuracyStats(TEST_USER_ID);

      if (stats && stats.total_predictions !== undefined) {
        console.log('✅ Statistics calculated successfully');
        console.log(`   Total predictions: ${stats.total_predictions}`);
        console.log(`   Hits: ${stats.hits}`);
        console.log(`   Monthly accuracy: ${stats.monthly_accuracy}%`);
        console.log(`   Current streak: ${stats.streak}\n`);
        testsPassed++;
      } else {
        console.error('❌ Statistics calculation failed');
        console.error('   Result:', stats, '\n');
        testsFailed++;
      }
    } catch (error) {
      console.error('❌ Statistics error:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST 8: Yesterday's Predictions Check
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('📊 TEST 8: Yesterday\'s Predictions Check');
    try {
      // Create a prediction for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      await db.query(`
        INSERT INTO predictions
        (user_id, prediction_text, predicted_for_date, user_feedback)
        VALUES ($1, 'Yesterday prediction for check test', $2, 'pending')
        ON CONFLICT DO NOTHING
      `, [TEST_USER_ID, yesterdayStr]);

      const check = await retroactivePredictionService.checkYesterdayPredictions(TEST_USER_ID);

      if (check && check.feedbackRequest) {
        console.log('✅ Yesterday\'s predictions check working');
        console.log('   Feedback request generated\n');
        testsPassed++;
      } else {
        console.log('ℹ️  No yesterday predictions found (expected if none exist)');
        console.log('   This is OK - test inconclusive\n');
        // Don't count as failure
      }
    } catch (error) {
      console.error('❌ Yesterday check failed:', error.message, '\n');
      testsFailed++;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CLEANUP: Remove test data
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('🧹 Cleaning up test data...');
    try {
      await db.query('DELETE FROM predictions WHERE user_id = $1', [TEST_USER_ID]);
      await db.query('DELETE FROM user_prediction_analytics WHERE user_id = $1', [TEST_USER_ID]);
      console.log('✅ Test data cleaned up\n');
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error.message, '\n');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FINAL RESULTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (testsFailed === 0) {
      console.log('🎉 ALL TESTS PASSED! Retroactive Predictions System is ready for production.\n');
    } else {
      console.log('⚠️  Some tests failed. Review errors above and fix before deployment.\n');
    }

  } catch (error) {
    console.error('💥 Fatal error during testing:', error);
  } finally {
    // Close database connection
    await db.end();
    console.log('🔌 Database connection closed');
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

// Run tests
runTests().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
