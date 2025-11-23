/**
 * A/B Testing Service
 * Complete framework for revenue optimization through controlled experiments
 *
 * Features:
 * - Test management (create, update, archive)
 * - User assignment with consistent hashing
 * - Event tracking and analytics
 * - Statistical significance calculation
 * - Real-time results monitoring
 * - Automatic winner declaration
 * - Revenue impact analysis
 * - Multi-variate testing support
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { loggingService } = require('./loggingService');

class ABTestingService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Create a new A/B test
   */
  async createTest(config) {
    try {
      const {
        name,
        hypothesis,
        variants,
        metrics,
        minSampleSize = 1000,
        confidenceLevel = 95,
        duration = 14, // days
        targetSegments = null,
        autoRollout = false
      } = config;

      // Validate configuration
      this.validateTestConfig(config);

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration);

      const query = `
        INSERT INTO ab_tests (
          name, hypothesis, variants, metrics, min_sample_size,
          confidence_level, start_date, end_date, target_segments,
          auto_rollout, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `;

      const values = [
        name,
        hypothesis,
        JSON.stringify(variants),
        JSON.stringify(metrics),
        minSampleSize,
        confidenceLevel,
        startDate,
        endDate,
        targetSegments ? JSON.stringify(targetSegments) : null,
        autoRollout,
        'running'
      ];

      const result = await this.pool.query(query, values);
      const test = result.rows[0];

      // Initialize variant stats
      for (const variant of variants) {
        await this.initializeVariantStats(test.id, variant.id);
      }

      loggingService.log('info', `A/B Test created: ${test.id} - ${name}`);

      return {
        ...test,
        variants: JSON.parse(test.variants),
        metrics: JSON.parse(test.metrics)
      };
    } catch (error) {
      loggingService.log('error', `Error creating A/B test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate test configuration
   */
  validateTestConfig(config) {
    const { name, variants, metrics } = config;

    if (!name || name.trim().length === 0) {
      throw new Error('Test name is required');
    }

    if (!variants || variants.length < 2) {
      throw new Error('At least 2 variants are required');
    }

    // Validate variant weights sum to 100
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error('Variant weights must sum to 100');
    }

    // Ensure there's a control variant
    const hasControl = variants.some(v => v.id === 'control');
    if (!hasControl) {
      throw new Error('A control variant is required');
    }

    if (!metrics || !metrics.primary) {
      throw new Error('Primary metric is required');
    }

    return true;
  }

  /**
   * Initialize variant statistics
   */
  async initializeVariantStats(testId, variantId) {
    const query = `
      INSERT INTO ab_variant_stats (
        test_id, variant_id, users, conversions, revenue,
        events, created_at, updated_at
      ) VALUES ($1, $2, 0, 0, 0, '[]'::jsonb, NOW(), NOW())
    `;

    await this.pool.query(query, [testId, variantId]);
  }

  /**
   * Assign user to variant using consistent hashing
   */
  async assignUserToVariant(userId, testId) {
    try {
      // Check if user already assigned
      const existingQuery = `
        SELECT variant_id, variant_config
        FROM ab_user_assignments
        WHERE user_id = $1 AND test_id = $2
      `;

      const existing = await this.pool.query(existingQuery, [userId, testId]);

      if (existing.rows.length > 0) {
        return {
          variantId: existing.rows[0].variant_id,
          config: existing.rows[0].variant_config
        };
      }

      // Get test details
      const test = await this.getTest(testId);

      if (!test || test.status !== 'running') {
        return null; // Test not active
      }

      // Check if user matches target segments
      if (test.target_segments) {
        const matchesSegment = await this.userMatchesSegment(userId, test.target_segments);
        if (!matchesSegment) {
          return null;
        }
      }

      // Consistent hash assignment
      const hash = this.hashUserId(userId, testId);
      const assignment = hash % 100;

      // Distribute based on weights
      let cumulative = 0;
      let selectedVariant = null;

      for (const variant of test.variants) {
        cumulative += variant.weight;
        if (assignment < cumulative) {
          selectedVariant = variant;
          break;
        }
      }

      // Store assignment
      const insertQuery = `
        INSERT INTO ab_user_assignments (
          test_id, user_id, variant_id, variant_config, assigned_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      await this.pool.query(insertQuery, [
        testId,
        userId,
        selectedVariant.id,
        JSON.stringify(selectedVariant.config)
      ]);

      // Increment user count for variant
      await this.incrementVariantUsers(testId, selectedVariant.id);

      return {
        variantId: selectedVariant.id,
        config: selectedVariant.config
      };
    } catch (error) {
      loggingService.log('error', `Error assigning user to variant: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consistent hashing algorithm
   */
  hashUserId(userId, testId) {
    const hash = crypto
      .createHash('sha256')
      .update(`${userId}-${testId}`)
      .digest('hex');

    return parseInt(hash.substring(0, 8), 16) % 100;
  }

  /**
   * Check if user matches target segments
   */
  async userMatchesSegment(userId, segments) {
    // Get user profile
    const query = `
      SELECT premium_tier, created_at, country
      FROM users
      WHERE firebase_uid = $1
    `;

    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return false;
    }

    const user = result.rows[0];

    // Check segment criteria
    if (segments.tier && !segments.tier.includes(user.premium_tier)) {
      return false;
    }

    if (segments.country && !segments.country.includes(user.country)) {
      return false;
    }

    if (segments.newUsers) {
      const accountAge = Date.now() - new Date(user.created_at).getTime();
      const maxAge = segments.newUsers * 24 * 60 * 60 * 1000; // days to ms
      if (accountAge > maxAge) {
        return false;
      }
    }

    return true;
  }

  /**
   * Track event for A/B test
   */
  async trackEvent(userId, testId, eventType, eventData = {}) {
    try {
      // Get user's variant assignment
      const assignmentQuery = `
        SELECT variant_id
        FROM ab_user_assignments
        WHERE user_id = $1 AND test_id = $2
      `;

      const assignment = await this.pool.query(assignmentQuery, [userId, testId]);

      if (assignment.rows.length === 0) {
        return; // User not in test
      }

      const variantId = assignment.rows[0].variant_id;

      // Record event
      const eventQuery = `
        INSERT INTO ab_events (
          test_id, user_id, variant_id, event_type, event_data, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;

      await this.pool.query(eventQuery, [
        testId,
        userId,
        variantId,
        eventType,
        JSON.stringify(eventData)
      ]);

      // Update variant stats based on event type
      await this.updateVariantStats(testId, variantId, eventType, eventData);

      return true;
    } catch (error) {
      loggingService.log('error', `Error tracking A/B test event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update variant statistics
   */
  async updateVariantStats(testId, variantId, eventType, eventData) {
    if (eventType === 'conversion') {
      const query = `
        UPDATE ab_variant_stats
        SET conversions = conversions + 1,
            revenue = revenue + $1,
            updated_at = NOW()
        WHERE test_id = $2 AND variant_id = $3
      `;

      await this.pool.query(query, [eventData.amount || 0, testId, variantId]);
    } else if (eventType === 'revenue') {
      const query = `
        UPDATE ab_variant_stats
        SET revenue = revenue + $1,
            updated_at = NOW()
        WHERE test_id = $2 AND variant_id = $3
      `;

      await this.pool.query(query, [eventData.amount, testId, variantId]);
    }
  }

  /**
   * Increment user count for variant
   */
  async incrementVariantUsers(testId, variantId) {
    const query = `
      UPDATE ab_variant_stats
      SET users = users + 1,
          updated_at = NOW()
      WHERE test_id = $1 AND variant_id = $2
    `;

    await this.pool.query(query, [testId, variantId]);
  }

  /**
   * Get test results with statistical analysis
   */
  async getTestResults(testId) {
    try {
      const test = await this.getTest(testId);

      if (!test) {
        throw new Error('Test not found');
      }

      // Get variant statistics
      const statsQuery = `
        SELECT * FROM ab_variant_stats
        WHERE test_id = $1
        ORDER BY variant_id
      `;

      const statsResult = await this.pool.query(statsQuery, [testId]);
      const stats = statsResult.rows;

      // Calculate metrics for each variant
      const results = {};
      const control = stats.find(s => s.variant_id === 'control');

      for (const stat of stats) {
        const conversionRate = stat.users > 0 ? (stat.conversions / stat.users) * 100 : 0;
        const avgRevenuePerUser = stat.users > 0 ? stat.revenue / stat.users : 0;

        results[stat.variant_id] = {
          users: stat.users,
          conversions: stat.conversions,
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          revenue: parseFloat(stat.revenue.toFixed(2)),
          avgRevenuePerUser: parseFloat(avgRevenuePerUser.toFixed(2))
        };

        // Calculate statistical significance vs control
        if (stat.variant_id !== 'control' && control) {
          const significance = this.calculateSignificance(control, stat);
          results[stat.variant_id].confidence = significance.confidence;
          results[stat.variant_id].significant = significance.significant;
          results[stat.variant_id].pValue = significance.pValue;
        } else if (stat.variant_id === 'control') {
          results[stat.variant_id].confidence = 100;
          results[stat.variant_id].significant = true;
        }
      }

      // Calculate progress to minimum sample size
      const maxUsers = Math.max(...stats.map(s => s.users));
      const progress = Math.min(100, (maxUsers / test.min_sample_size) * 100);

      // Determine winner if conditions met
      const analysis = await this.analyzeResults(test, results, stats);

      // Calculate duration
      const durationMs = new Date() - new Date(test.start_date);
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((new Date(test.end_date) - new Date(test.start_date)) / (1000 * 60 * 60 * 24));

      return {
        testId,
        name: test.name,
        hypothesis: test.hypothesis,
        status: test.status,
        progress: parseFloat(progress.toFixed(1)),
        duration: `${durationDays} days / ${totalDays} days`,
        results,
        analysis
      };
    } catch (error) {
      loggingService.log('error', `Error getting test results: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate statistical significance using Z-test for proportions
   */
  calculateSignificance(control, variant) {
    const n1 = control.users;
    const n2 = variant.users;
    const x1 = control.conversions;
    const x2 = variant.conversions;

    if (n1 === 0 || n2 === 0) {
      return { z: 0, pValue: 1, significant: false, confidence: 0 };
    }

    const p1 = x1 / n1;
    const p2 = x2 / n2;
    const p = (x1 + x2) / (n1 + n2);

    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));

    if (se === 0) {
      return { z: 0, pValue: 1, significant: false, confidence: 0 };
    }

    const z = (p2 - p1) / se;
    const pValue = this.zToPValue(Math.abs(z));
    const significant = pValue < 0.05;
    const confidence = parseFloat(((1 - pValue) * 100).toFixed(2));

    return {
      z: parseFloat(z.toFixed(4)),
      pValue: parseFloat(pValue.toFixed(6)),
      significant,
      confidence
    };
  }

  /**
   * Convert Z-score to P-value (two-tailed)
   */
  zToPValue(z) {
    // Using approximation for normal distribution
    const t = 1 / (1 + 0.2316419 * z);
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return 2 * p; // two-tailed
  }

  /**
   * Analyze results and determine winner
   */
  async analyzeResults(test, results, stats) {
    const control = results.control;
    const variants = Object.entries(results).filter(([id]) => id !== 'control');

    if (!control || variants.length === 0) {
      return {
        winner: null,
        recommendation: 'Insufficient data',
        riskLevel: 'high'
      };
    }

    // Find best performing variant
    let bestVariant = null;
    let bestImprovement = 0;

    for (const [variantId, variantData] of variants) {
      const improvement = ((variantData.conversionRate - control.conversionRate) / control.conversionRate) * 100;

      if (improvement > bestImprovement && variantData.significant) {
        bestImprovement = improvement;
        bestVariant = { id: variantId, data: variantData };
      }
    }

    // Check if ready to declare winner
    const maxUsers = Math.max(...stats.map(s => s.users));
    const hasMinSample = maxUsers >= test.min_sample_size;

    const durationMs = new Date() - new Date(test.start_date);
    const durationDays = durationMs / (1000 * 60 * 60 * 24);
    const hasMinDuration = durationDays >= 7;

    const meetsThreshold = bestImprovement >= 10; // 10% minimum improvement

    if (bestVariant && hasMinSample && hasMinDuration && meetsThreshold) {
      // Calculate revenue impact
      const revenueIncrease = bestVariant.data.revenue - control.revenue;
      const projectedMonthlyImpact = (revenueIncrease / durationDays) * 30;
      const projectedAnnualImpact = projectedMonthlyImpact * 12;

      return {
        winner: bestVariant.id,
        improvement: `+${bestImprovement.toFixed(1)}% conversion rate`,
        revenueImpact: `+$${revenueIncrease.toFixed(2)}`,
        projectedMonthlyImpact: `+$${projectedMonthlyImpact.toFixed(2)}/month`,
        projectedAnnualImpact: `+$${projectedAnnualImpact.toFixed(2)}/year`,
        confidence: bestVariant.data.confidence,
        recommendation: 'ROLL OUT WINNER IMMEDIATELY',
        riskLevel: bestVariant.data.confidence >= 95 ? 'very low' : 'low'
      };
    }

    // Not ready yet
    return {
      winner: null,
      bestPerforming: bestVariant ? bestVariant.id : null,
      improvement: bestVariant ? `+${bestImprovement.toFixed(1)}%` : 'N/A',
      recommendation: this.getRecommendation(hasMinSample, hasMinDuration, meetsThreshold),
      riskLevel: 'high'
    };
  }

  /**
   * Get recommendation based on test status
   */
  getRecommendation(hasMinSample, hasMinDuration, meetsThreshold) {
    if (!hasMinSample) {
      return 'Continue test - need more users';
    }
    if (!hasMinDuration) {
      return 'Continue test - need more time';
    }
    if (!meetsThreshold) {
      return 'No significant improvement found - consider new variants';
    }
    return 'Continue monitoring';
  }

  /**
   * Automatically check for winners and rollout if configured
   */
  async checkForWinner(testId) {
    try {
      const results = await this.getTestResults(testId);
      const test = await this.getTest(testId);

      if (test.status !== 'running') {
        return null;
      }

      if (results.analysis.winner && test.auto_rollout) {
        // Declare winner
        await this.declareWinner(testId, results.analysis.winner);

        // Rollout winning variant
        await this.rolloutWinner(testId, results.analysis.winner);

        // Send notification
        await this.notifyTeam({
          test: test.name,
          winner: results.analysis.winner,
          improvement: results.analysis.improvement,
          impact: results.analysis.projectedAnnualImpact
        });

        return results.analysis;
      }

      return null;
    } catch (error) {
      loggingService.log('error', `Error checking for winner: ${error.message}`);
      throw error;
    }
  }

  /**
   * Declare a winner for the test
   */
  async declareWinner(testId, winnerId) {
    const query = `
      UPDATE ab_tests
      SET status = 'completed',
          winner = $1,
          completed_at = NOW()
      WHERE id = $2
    `;

    await this.pool.query(query, [winnerId, testId]);

    loggingService.log('info', `Winner declared for test ${testId}: ${winnerId}`);
  }

  /**
   * Rollout winning variant
   */
  async rolloutWinner(testId, winnerId) {
    const test = await this.getTest(testId);
    const winningVariant = test.variants.find(v => v.id === winnerId);

    // Store winning configuration for future use
    const query = `
      INSERT INTO ab_winning_variants (
        test_id, variant_id, config, rolled_out_at
      ) VALUES ($1, $2, $3, NOW())
    `;

    await this.pool.query(query, [
      testId,
      winnerId,
      JSON.stringify(winningVariant.config)
    ]);

    loggingService.log('info', `Rolled out winner ${winnerId} for test ${testId}`);
  }

  /**
   * Send notification to team
   */
  async notifyTeam(data) {
    // In production, this would integrate with Slack, email, etc.
    loggingService.log('info', `🎉 A/B Test "${data.test}" completed!
      Winner: ${data.winner}
      Impact: ${data.improvement}
      Projected Revenue: ${data.impact}
    `);
  }

  /**
   * Get test by ID
   */
  async getTest(testId) {
    const query = `SELECT * FROM ab_tests WHERE id = $1`;
    const result = await this.pool.query(query, [testId]);

    if (result.rows.length === 0) {
      return null;
    }

    const test = result.rows[0];
    return {
      ...test,
      variants: JSON.parse(test.variants),
      metrics: JSON.parse(test.metrics),
      target_segments: test.target_segments ? JSON.parse(test.target_segments) : null
    };
  }

  /**
   * Get all active tests
   */
  async getActiveTests() {
    const query = `
      SELECT * FROM ab_tests
      WHERE status = 'running'
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query);

    return result.rows.map(test => ({
      ...test,
      variants: JSON.parse(test.variants),
      metrics: JSON.parse(test.metrics),
      target_segments: test.target_segments ? JSON.parse(test.target_segments) : null
    }));
  }

  /**
   * Pause a test
   */
  async pauseTest(testId) {
    const query = `
      UPDATE ab_tests
      SET status = 'paused',
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [testId]);
    loggingService.log('info', `Test ${testId} paused`);
  }

  /**
   * Resume a test
   */
  async resumeTest(testId) {
    const query = `
      UPDATE ab_tests
      SET status = 'running',
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [testId]);
    loggingService.log('info', `Test ${testId} resumed`);
  }

  /**
   * Archive a test
   */
  async archiveTest(testId) {
    const query = `
      UPDATE ab_tests
      SET status = 'archived',
          updated_at = NOW()
      WHERE id = $1
    `;

    await this.pool.query(query, [testId]);
    loggingService.log('info', `Test ${testId} archived`);
  }

  /**
   * Get variant config for user
   */
  async getVariantConfig(userId, testId) {
    const assignment = await this.assignUserToVariant(userId, testId);
    return assignment ? assignment.config : null;
  }

  /**
   * Get all tests for a user
   */
  async getUserTests(userId) {
    const query = `
      SELECT ua.test_id, ua.variant_id, ua.variant_config, t.name, t.status
      FROM ab_user_assignments ua
      JOIN ab_tests t ON ua.test_id = t.id
      WHERE ua.user_id = $1
      ORDER BY ua.assigned_at DESC
    `;

    const result = await this.pool.query(query, [userId]);

    return result.rows.map(row => ({
      testId: row.test_id,
      testName: row.name,
      variantId: row.variant_id,
      config: row.variant_config,
      status: row.status
    }));
  }
}

module.exports = new ABTestingService();
