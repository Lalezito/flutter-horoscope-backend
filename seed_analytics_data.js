/**
 * ================================================================================
 * ANALYTICS DATA SEEDER
 * ================================================================================
 *
 * Generates realistic sample data for testing the analytics system
 * Run this to populate your analytics tables with sample data
 *
 * Usage: node seed_analytics_data.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Sample data generators
const zodiacSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const countries = ['US', 'UK', 'CA', 'ES', 'MX', 'BR', 'FR', 'DE', 'IT', 'PT'];
const languages = ['en', 'es', 'fr', 'de', 'it', 'pt'];
const eventTypes = [
  'app_open',
  'daily_horoscope_viewed',
  'compatibility_checked',
  'chat_message_sent',
  'goal_created',
  'biorhythm_viewed',
  'feature_shared',
  'premium_purchase'
];

function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedAnalytics() {
  console.log('🌱 Starting analytics data seeding...\n');

  try {
    // 1. Create user cohorts (1000 users over last 90 days)
    console.log('Creating user cohorts...');
    const userIds = [];
    const cohortStartDate = new Date();
    cohortStartDate.setDate(cohortStartDate.getDate() - 90);

    for (let i = 0; i < 1000; i++) {
      const userId = `user_${i.toString().padStart(5, '0')}`;
      userIds.push(userId);

      const cohortDate = randomDate(cohortStartDate, new Date());
      const signupSource = randomElement(['organic', 'paid_ad', 'referral', 'social']);
      const zodiacSign = randomElement(zodiacSigns);
      const country = randomElement(countries);
      const language = randomElement(languages);

      // Some users become premium
      const becomesPremium = Math.random() < 0.12; // 12% conversion rate
      const firstPremiumDate = becomesPremium ?
        randomDate(cohortDate, new Date()) : null;
      const tier = becomesPremium ?
        (Math.random() < 0.65 ? 'cosmic' : 'stellar') : null;

      const daysToPremium = becomesPremium ?
        Math.floor((firstPremiumDate - cohortDate) / (1000 * 60 * 60 * 24)) : null;

      const totalSessions = randomInt(5, 100);
      const isActive = Math.random() < 0.7; // 70% retention
      const ltv = becomesPremium ?
        (tier === 'cosmic' ? randomInt(20, 150) : randomInt(50, 300)) : 0;

      await db.query(`
        INSERT INTO user_cohorts (
          user_id, cohort_date, signup_source, signup_country, signup_language,
          zodiac_sign, first_premium_date, first_premium_tier, days_to_premium,
          total_sessions, lifetime_value, is_churned, last_active_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id) DO NOTHING
      `, [
        userId, cohortDate, signupSource, country, language, zodiacSign,
        firstPremiumDate, tier, daysToPremium, totalSessions, ltv,
        !isActive, isActive ? new Date() : cohortDate
      ]);
    }
    console.log(`✅ Created ${userIds.length} user cohorts\n`);

    // 2. Generate analytics events (10,000 events)
    console.log('Generating analytics events...');
    const eventStartDate = new Date();
    eventStartDate.setDate(eventStartDate.getDate() - 30);

    for (let i = 0; i < 10000; i++) {
      const userId = randomElement(userIds);
      const eventType = randomElement(eventTypes);
      const category = eventType === 'premium_purchase' ? 'revenue' :
                       eventType.includes('viewed') ? 'engagement' :
                       'retention';

      const createdAt = randomDate(eventStartDate, new Date());

      const properties = eventType === 'premium_purchase' ?
        { tier: randomElement(['cosmic', 'stellar']), amount: Math.random() < 0.65 ? 4.99 : 9.99 } :
        eventType === 'compatibility_checked' ?
        { sign1: randomElement(zodiacSigns), sign2: randomElement(zodiacSigns) } :
        {};

      await db.query(`
        INSERT INTO analytics_events (
          user_id, event_type, event_category, event_properties, created_at
        )
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, eventType, category, JSON.stringify(properties), createdAt]);

      if (i % 1000 === 0) {
        process.stdout.write(`  Progress: ${i}/10000\r`);
      }
    }
    console.log(`✅ Generated 10,000 analytics events\n`);

    // 3. Create subscription analytics (120 subscriptions)
    console.log('Creating subscription records...');
    const premiumUsers = userIds.filter(() => Math.random() < 0.12);

    for (const userId of premiumUsers) {
      const tier = Math.random() < 0.65 ? 'cosmic' : 'stellar';
      const price = tier === 'cosmic' ? 4.99 : 9.99;
      const startDate = randomDate(cohortStartDate, new Date());

      const isActive = Math.random() < 0.95; // 5% churn
      const endDate = isActive ? null : randomDate(startDate, new Date());

      await db.query(`
        INSERT INTO subscription_analytics (
          user_id, subscription_tier, subscription_status, start_date, end_date,
          price_paid, currency, auto_renew
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        userId, tier, isActive ? 'active' : 'cancelled',
        startDate, endDate, price, 'USD', isActive
      ]);
    }
    console.log(`✅ Created ${premiumUsers.length} subscription records\n`);

    // 4. Generate revenue metrics (last 30 days)
    console.log('Calculating revenue metrics...');
    for (let day = 0; day < 30; day++) {
      const metricDate = new Date();
      metricDate.setDate(metricDate.getDate() - day);
      const dateStr = metricDate.toISOString().split('T')[0];

      // Calculate realistic metrics
      const baseSubscriptions = 100 + day * 2;
      const cosmicCount = Math.floor(baseSubscriptions * 0.65);
      const stellarCount = baseSubscriptions - cosmicCount;

      const mrr = cosmicCount * 4.99 + stellarCount * 9.99;
      const arr = mrr * 12;
      const churnRate = 4 + Math.random() * 2;
      const dailyRevenue = mrr / 30;

      await db.query(`
        INSERT INTO revenue_metrics (
          metric_date, mrr, arr, daily_revenue, active_subscriptions,
          cosmic_tier_count, stellar_tier_count,
          cosmic_tier_revenue, stellar_tier_revenue,
          churn_rate, growth_rate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (metric_date) DO UPDATE SET
          mrr = EXCLUDED.mrr,
          arr = EXCLUDED.arr,
          active_subscriptions = EXCLUDED.active_subscriptions
      `, [
        dateStr, mrr, arr, dailyRevenue, baseSubscriptions,
        cosmicCount, stellarCount,
        cosmicCount * 4.99, stellarCount * 9.99,
        churnRate, 20 + Math.random() * 10
      ]);
    }
    console.log(`✅ Generated 30 days of revenue metrics\n`);

    // 5. Generate feature usage analytics
    console.log('Tracking feature usage...');
    const features = [
      { name: 'Daily Horoscope', category: 'core' },
      { name: 'Compatibility Check', category: 'core' },
      { name: 'Cosmic Coach', category: 'premium' },
      { name: 'Biorhythms', category: 'premium' },
      { name: 'Goal Planner', category: 'premium' },
      { name: 'Streak System', category: 'core' }
    ];

    for (let day = 0; day < 30; day++) {
      const usageDate = new Date();
      usageDate.setDate(usageDate.getDate() - day);
      const dateStr = usageDate.toISOString().split('T')[0];

      for (const feature of features) {
        const totalUsers = randomInt(500, 2000);
        const premiumUsers = Math.floor(totalUsers * 0.15);
        const freeUsers = totalUsers - premiumUsers;
        const conversions = feature.category === 'premium' ?
          randomInt(10, 50) : randomInt(5, 20);

        await db.query(`
          INSERT INTO feature_usage_analytics (
            feature_name, feature_category, usage_date,
            total_users, premium_users, free_users,
            total_usages, conversion_events,
            revenue_attributed, satisfaction_score
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (feature_name, usage_date) DO NOTHING
        `, [
          feature.name, feature.category, dateStr,
          totalUsers, premiumUsers, freeUsers,
          totalUsers * randomInt(2, 5), conversions,
          conversions * (Math.random() < 0.5 ? 4.99 : 9.99),
          4 + Math.random()
        ]);
      }
    }
    console.log(`✅ Generated feature usage for ${features.length} features\n`);

    // 6. Generate cohort retention metrics
    console.log('Calculating cohort retention...');
    const cohortMonths = 3;
    for (let month = 0; month < cohortMonths; month++) {
      const cohortDate = new Date();
      cohortDate.setMonth(cohortDate.getMonth() - month);
      const dateStr = cohortDate.toISOString().split('T')[0];

      const cohortSize = 300 + month * 50;
      const retentionRates = {
        1: 85,
        7: 45,
        30: 25,
        90: 15
      };

      for (const [day, rate] of Object.entries(retentionRates)) {
        const retainedUsers = Math.floor(cohortSize * (rate / 100));

        await db.query(`
          INSERT INTO cohort_retention_metrics (
            cohort_date, period_number, period_type, cohort_size,
            retained_users, retention_rate, revenue_generated, average_ltv
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (cohort_date, period_number, period_type) DO NOTHING
        `, [
          dateStr, parseInt(day), 'day', cohortSize,
          retainedUsers, rate, retainedUsers * 5, 45.20
        ]);
      }
    }
    console.log(`✅ Generated retention metrics for ${cohortMonths} cohorts\n`);

    // 7. Generate churn predictions
    console.log('Predicting churn risk...');
    const atRiskCount = Math.floor(userIds.length * 0.15); // 15% at risk
    for (let i = 0; i < atRiskCount; i++) {
      const userId = userIds[i];
      const churnProb = randomInt(60, 95);
      const riskLevel = churnProb > 80 ? 'critical' :
                        churnProb > 70 ? 'high' :
                        churnProb > 60 ? 'medium' : 'low';

      await db.query(`
        INSERT INTO churn_predictions (
          user_id, prediction_date, churn_probability, risk_level,
          churn_drivers, revenue_at_risk, engagement_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, prediction_date) DO NOTHING
      `, [
        userId,
        new Date().toISOString().split('T')[0],
        churnProb,
        riskLevel,
        JSON.stringify(['low_engagement', 'price_sensitivity']),
        7.5,
        3.2
      ]);
    }
    console.log(`✅ Generated churn predictions for ${atRiskCount} users\n`);

    // 8. Generate automated insights
    console.log('Generating insights...');
    const insights = [
      {
        type: 'opportunity',
        category: 'revenue',
        severity: 'high',
        title: 'Leo Users Show High Conversion',
        description: 'Leo users convert at 12.3% vs 8.5% average. Consider Leo-specific marketing campaigns.',
        recommendation: 'Create targeted content and push notifications for Leo users',
        expectedImpact: '+$2,340/month',
        effort: 'Low'
      },
      {
        type: 'warning',
        category: 'retention',
        severity: 'medium',
        title: 'Compatibility Feature Drives Retention',
        description: 'Users who check compatibility stay 3x longer than average.',
        recommendation: 'Promote compatibility feature more prominently in onboarding',
        expectedImpact: '+25% retention',
        effort: 'Medium'
      },
      {
        type: 'trend',
        category: 'engagement',
        severity: 'low',
        title: 'Evening Engagement Peak',
        description: '35% of daily traffic occurs between 6-9 PM. Optimize for this window.',
        recommendation: 'Schedule push notifications and new content for evening hours',
        expectedImpact: '+15% engagement',
        effort: 'Low'
      }
    ];

    for (const insight of insights) {
      await db.query(`
        INSERT INTO analytics_insights (
          insight_type, category, severity, title, description,
          recommendation, expected_impact, effort_level, is_actionable
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        insight.type, insight.category, insight.severity, insight.title,
        insight.description, insight.recommendation, insight.expectedImpact,
        insight.effort, true
      ]);
    }
    console.log(`✅ Generated ${insights.length} automated insights\n`);

    console.log('🎉 Analytics data seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`  - ${userIds.length} user cohorts`);
    console.log(`  - 10,000 analytics events`);
    console.log(`  - ${premiumUsers.length} subscriptions`);
    console.log(`  - 30 days of revenue metrics`);
    console.log(`  - ${features.length} features tracked`);
    console.log(`  - ${atRiskCount} churn predictions`);
    console.log(`  - ${insights.length} automated insights`);

    console.log('\n✅ You can now access the analytics dashboard!');
    console.log('\nTest it:');
    console.log('  curl -H "x-admin-token: YOUR_TOKEN" http://localhost:3000/api/analytics/realtime');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await db.end();
  }
}

// Run seeder
seedAnalytics()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
