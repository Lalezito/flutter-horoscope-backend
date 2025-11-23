/**
 * ========================================================
 * STREAK SYSTEM - TEST SCRIPT
 * ========================================================
 *
 * Run this script to test the streak system functionality
 *
 * Usage:
 *   node TEST_STREAK_SYSTEM.js
 *
 * ========================================================
 */

// Load environment variables
require('dotenv').config();

const streakService = require('./src/services/streakService');
const db = require('./src/config/db');

// Test user ID (create a test user first or use existing)
const TEST_USER_ID = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000001';

async function runTests() {
  console.log('\n🔥 STREAK SYSTEM TEST SUITE\n');
  console.log('=' .repeat(60));

  try {
    // Test 1: Service Status
    console.log('\n📊 TEST 1: Service Status');
    console.log('-'.repeat(60));
    const status = streakService.getStatus();
    console.log('✅ Service Status:', JSON.stringify(status, null, 2));

    // Test 2: First Check-in (Clean Slate)
    console.log('\n📊 TEST 2: First Check-in (Clean Slate)');
    console.log('-'.repeat(60));

    // Clean existing data for test user
    await db.query('DELETE FROM user_streaks WHERE user_id = $1', [TEST_USER_ID]);
    console.log('🧹 Cleaned existing test data');

    const firstCheckIn = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Result:', JSON.stringify(firstCheckIn, null, 2));

    if (firstCheckIn.success && firstCheckIn.current_streak === 1) {
      console.log('✅ PASS: First check-in successful');
    } else {
      console.log('❌ FAIL: First check-in failed');
    }

    // Test 3: Duplicate Check-in Same Day
    console.log('\n📊 TEST 3: Duplicate Check-in Same Day');
    console.log('-'.repeat(60));

    const duplicateCheckIn = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Result:', JSON.stringify(duplicateCheckIn, null, 2));

    if (duplicateCheckIn.success && duplicateCheckIn.already_checked_in === true) {
      console.log('✅ PASS: Duplicate check-in detected correctly');
    } else {
      console.log('❌ FAIL: Duplicate check-in not handled properly');
    }

    // Test 4: Get Streak Info
    console.log('\n📊 TEST 4: Get Streak Info');
    console.log('-'.repeat(60));

    const streakInfo = await streakService.getStreak(TEST_USER_ID);
    console.log('Result:', JSON.stringify(streakInfo, null, 2));

    if (streakInfo.success && streakInfo.has_checked_in_today === true) {
      console.log('✅ PASS: Streak info retrieved successfully');
    } else {
      console.log('❌ FAIL: Streak info not retrieved properly');
    }

    // Test 5: Consecutive Day Streak (Simulated)
    console.log('\n📊 TEST 5: Consecutive Day Streak (Simulated)');
    console.log('-'.repeat(60));

    // Set last_check_in to yesterday to simulate next day
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await db.query(
      'UPDATE user_streaks SET last_check_in = $1, current_streak = 1 WHERE user_id = $2',
      [yesterdayStr, TEST_USER_ID]
    );
    console.log(`🕒 Simulated last check-in: ${yesterdayStr}`);

    const nextDayCheckIn = await streakService.checkIn(TEST_USER_ID, 'en');
    console.log('Result:', JSON.stringify(nextDayCheckIn, null, 2));

    if (nextDayCheckIn.success && nextDayCheckIn.current_streak === 2) {
      console.log('✅ PASS: Consecutive day streak incremented');
    } else {
      console.log('❌ FAIL: Consecutive day streak not incremented');
    }

    // Test 6: Milestone Achievement (Day 3)
    console.log('\n📊 TEST 6: Milestone Achievement (Day 3)');
    console.log('-'.repeat(60));

    // Set up for day 3 milestone
    await db.query(
      `UPDATE user_streaks
       SET current_streak = 2,
           last_check_in = $1,
           milestones_achieved = '[]'::jsonb,
           badges = '[]'::jsonb
       WHERE user_id = $2`,
      [yesterdayStr, TEST_USER_ID]
    );

    const day3CheckIn = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Result:', JSON.stringify(day3CheckIn, null, 2));

    if (day3CheckIn.success &&
        day3CheckIn.current_streak === 3 &&
        day3CheckIn.milestone !== null &&
        day3CheckIn.milestone.badge === 'beginner') {
      console.log('✅ PASS: Day 3 milestone achieved');
    } else {
      console.log('❌ FAIL: Day 3 milestone not triggered');
    }

    // Test 7: Milestone Not Awarded Twice
    console.log('\n📊 TEST 7: Milestone Not Awarded Twice');
    console.log('-'.repeat(60));

    // Check in again on day 3 (should not give milestone again)
    const duplicateMilestoneCheck = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Result (already_checked_in):', duplicateMilestoneCheck.already_checked_in);

    // Now try day 3 again after resetting last_check_in
    await db.query(
      `UPDATE user_streaks
       SET current_streak = 3,
           last_check_in = $1,
           milestones_achieved = '[3]'::jsonb
       WHERE user_id = $2`,
      [yesterdayStr, TEST_USER_ID]
    );

    const day4CheckIn = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Day 4 Result:', JSON.stringify(day4CheckIn, null, 2));

    if (day4CheckIn.success && day4CheckIn.milestone === null) {
      console.log('✅ PASS: Milestone not awarded twice');
    } else {
      console.log('❌ FAIL: Milestone awarded again incorrectly');
    }

    // Test 8: Broken Streak
    console.log('\n📊 TEST 8: Broken Streak');
    console.log('-'.repeat(60));

    // Set last check-in to 3 days ago
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    await db.query(
      `UPDATE user_streaks
       SET current_streak = 10,
           longest_streak = 10,
           last_check_in = $1
       WHERE user_id = $2`,
      [threeDaysAgoStr, TEST_USER_ID]
    );
    console.log(`🕒 Set last check-in to 3 days ago: ${threeDaysAgoStr}`);

    const brokenStreakCheckIn = await streakService.checkIn(TEST_USER_ID, 'en');
    console.log('Result:', JSON.stringify(brokenStreakCheckIn, null, 2));

    if (brokenStreakCheckIn.success &&
        brokenStreakCheckIn.current_streak === 1 &&
        brokenStreakCheckIn.longest_streak === 10 &&
        brokenStreakCheckIn.streak_broken === true) {
      console.log('✅ PASS: Broken streak handled correctly (reset to 1, preserved longest)');
    } else {
      console.log('❌ FAIL: Broken streak not handled properly');
    }

    // Test 9: Leaderboard
    console.log('\n📊 TEST 9: Leaderboard');
    console.log('-'.repeat(60));

    const leaderboard = await streakService.getLeaderboard(5);
    console.log('Result:', JSON.stringify(leaderboard, null, 2));

    if (leaderboard.success) {
      console.log('✅ PASS: Leaderboard retrieved successfully');
    } else {
      console.log('❌ FAIL: Leaderboard retrieval failed');
    }

    // Test 10: Language Support
    console.log('\n📊 TEST 10: Language Support');
    console.log('-'.repeat(60));

    const spanishMessage = await streakService.checkIn(TEST_USER_ID, 'es');
    console.log('Spanish message:', spanishMessage.message);

    await db.query(
      'UPDATE user_streaks SET last_check_in = $1 WHERE user_id = $2',
      [yesterdayStr, TEST_USER_ID]
    );

    const englishMessage = await streakService.checkIn(TEST_USER_ID, 'en');
    console.log('English message:', englishMessage.message);

    if (spanishMessage.message.includes('días') && englishMessage.message.includes('days')) {
      console.log('✅ PASS: Bilingual support working');
    } else {
      console.log('❌ FAIL: Language support not working properly');
    }

    // Final Database Check
    console.log('\n📊 DATABASE VERIFICATION');
    console.log('-'.repeat(60));

    const dbCheck = await db.query(
      'SELECT * FROM user_streaks WHERE user_id = $1',
      [TEST_USER_ID]
    );

    if (dbCheck.rows.length > 0) {
      console.log('✅ Database record exists:');
      console.log(JSON.stringify(dbCheck.rows[0], null, 2));
    } else {
      console.log('❌ No database record found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST SUITE COMPLETED');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error);
    console.error('Stack:', error.stack);
  } finally {
    // Close database connection
    await db.end();
    process.exit(0);
  }
}

// Run tests
runTests();
