const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const goalGenerationService = require('../services/goalGenerationService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Goal Planner Controller
 * Handles all Goal Planner API endpoints
 */
class GoalPlannerController {
  /**
   * Generate a new goal with AI
   * POST /api/ai/goals/generate
   */
  async generateGoal(req, res) {
    const { userId, zodiacSign, objective, focusArea, timeframe, emotionalState } = req.body;

    // Validation
    if (!userId || !zodiacSign || !objective || !focusArea) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, zodiacSign, objective, focusArea',
      });
    }

    try {
      console.log(`[Goal Planner] Generating goal for user ${userId}, focus: ${focusArea}`);

      // Generate with AI
      const goalData = await goalGenerationService.generateGoal({
        zodiacSign,
        objective,
        focusArea,
        timeframe: timeframe || 'monthly',
        emotionalState: emotionalState || 'motivated',
      });

      // Create goal ID
      const goalId = `goal_${uuidv4()}`;

      // Insert into database
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Insert main goal
        const goalResult = await client.query(
          `INSERT INTO goals (
            goal_id, user_id, focus_area, status,
            main_goal_title, main_goal_description,
            main_goal_specific, main_goal_measurable,
            main_goal_achievable, main_goal_relevant, main_goal_timebound,
            zodiac_sign, timeframe, emotional_state, objective,
            astrological_alignment_planet, astrological_alignment_house,
            astrological_alignment_strength, astrological_alignment_description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING *`,
          [
            goalId,
            userId,
            focusArea,
            'active',
            goalData.mainGoal.title,
            goalData.mainGoal.description,
            goalData.mainGoal.specific,
            goalData.mainGoal.measurable,
            goalData.mainGoal.achievable,
            goalData.mainGoal.relevant,
            goalData.mainGoal.timebound,
            zodiacSign,
            timeframe || 'monthly',
            emotionalState || 'motivated',
            objective,
            goalData.astrologicalAlignment?.planet,
            goalData.astrologicalAlignment?.house,
            goalData.astrologicalAlignment?.strength,
            goalData.astrologicalAlignment?.description,
          ]
        );

        // Insert micro habits
        for (let i = 0; i < goalData.microHabits.length; i++) {
          const habit = goalData.microHabits[i];
          await client.query(
            `INSERT INTO goal_micro_habits (goal_id, habit, frequency, duration, order_index)
             VALUES ($1, $2, $3, $4, $5)`,
            [goalId, habit.habit, habit.frequency, habit.duration, i]
          );
        }

        // Insert milestones
        for (let i = 0; i < goalData.milestones.length; i++) {
          const milestone = goalData.milestones[i];
          await client.query(
            `INSERT INTO goal_milestones (goal_id, milestone, target_date, order_index)
             VALUES ($1, $2, $3, $4)`,
            [goalId, milestone.milestone, milestone.targetDate, i]
          );
        }

        // Insert obstacles
        if (goalData.potentialObstacles && goalData.potentialObstacles.length > 0) {
          for (let i = 0; i < goalData.potentialObstacles.length; i++) {
            const obstacle = goalData.potentialObstacles[i];
            await client.query(
              `INSERT INTO goal_obstacles (goal_id, obstacle, solution, order_index)
               VALUES ($1, $2, $3, $4)`,
              [goalId, obstacle.obstacle, obstacle.solution, i]
            );
          }
        }

        await client.query('COMMIT');

        console.log(`[Goal Planner] Goal created successfully: ${goalId}`);

        // Fetch complete goal
        const completeGoal = await this._fetchGoalById(goalId, client);

        res.status(201).json({
          success: true,
          goal: completeGoal,
          message: 'Goal created successfully',
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[Goal Planner] Error generating goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate goal',
        message: error.message,
      });
    }
  }

  /**
   * Get user's goals
   * GET /api/ai/goals?userId=xxx&status=active
   */
  async getUserGoals(req, res) {
    const { userId, status } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: userId',
      });
    }

    try {
      let query = `
        SELECT * FROM goals
        WHERE user_id = $1
      `;
      const params = [userId];

      if (status) {
        query += ` AND status = $2`;
        params.push(status);
      }

      query += ` ORDER BY created_at DESC`;

      const result = await pool.query(query, params);

      // Fetch related data for each goal
      const goalsWithDetails = await Promise.all(
        result.rows.map((goal) => this._fetchGoalById(goal.goal_id))
      );

      res.json({
        success: true,
        count: goalsWithDetails.length,
        goals: goalsWithDetails,
      });
    } catch (error) {
      console.error('[Goal Planner] Error fetching goals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch goals',
      });
    }
  }

  /**
   * Update goal status
   * PUT /api/ai/goals/:goalId/status
   */
  async updateGoalStatus(req, res) {
    const { goalId } = req.params;
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, status',
      });
    }

    try {
      // Verify ownership
      const ownerCheck = await pool.query('SELECT user_id FROM goals WHERE goal_id = $1', [goalId]);

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      if (ownerCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Update status
      const updateQuery = status === 'completed'
        ? 'UPDATE goals SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE goal_id = $2 RETURNING *'
        : 'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE goal_id = $2 RETURNING *';

      const result = await pool.query(updateQuery, [status, goalId]);

      res.json({
        success: true,
        goal: result.rows[0],
        message: `Goal status updated to ${status}`,
      });
    } catch (error) {
      console.error('[Goal Planner] Error updating goal status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update goal status',
      });
    }
  }

  /**
   * Delete goal
   * DELETE /api/ai/goals/:goalId
   */
  async deleteGoal(req, res) {
    const { goalId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId',
      });
    }

    try {
      // Verify ownership
      const ownerCheck = await pool.query('SELECT user_id FROM goals WHERE goal_id = $1', [goalId]);

      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Goal not found',
        });
      }

      if (ownerCheck.rows[0].user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Soft delete
      await pool.query(
        'UPDATE goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE goal_id = $2',
        ['deleted', goalId]
      );

      res.json({
        success: true,
        message: 'Goal deleted successfully',
      });
    } catch (error) {
      console.error('[Goal Planner] Error deleting goal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete goal',
      });
    }
  }

  /**
   * Record check-in
   * POST /api/ai/goals/:goalId/checkin
   */
  async recordCheckIn(req, res) {
    const { goalId } = req.params;
    const { progress, mood, feedback } = req.body;

    if (progress === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: progress',
      });
    }

    try {
      const checkinId = `checkin_${uuidv4()}`;

      const result = await pool.query(
        `INSERT INTO goal_checkins (checkin_id, goal_id, progress, mood, feedback)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [checkinId, goalId, progress, mood, feedback]
      );

      res.status(201).json({
        success: true,
        checkin: result.rows[0],
        message: 'Check-in recorded successfully',
      });
    } catch (error) {
      console.error('[Goal Planner] Error recording check-in:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record check-in',
      });
    }
  }

  /**
   * Helper: Fetch complete goal with all related data
   */
  async _fetchGoalById(goalId, clientParam = null) {
    const client = clientParam || pool;

    const goalResult = await client.query('SELECT * FROM goals WHERE goal_id = $1', [goalId]);

    if (goalResult.rows.length === 0) {
      throw new Error('Goal not found');
    }

    const goal = goalResult.rows[0];

    // Fetch micro habits
    const habitsResult = await client.query(
      'SELECT * FROM goal_micro_habits WHERE goal_id = $1 ORDER BY order_index',
      [goalId]
    );

    // Fetch milestones
    const milestonesResult = await client.query(
      'SELECT * FROM goal_milestones WHERE goal_id = $1 ORDER BY order_index',
      [goalId]
    );

    // Fetch obstacles
    const obstaclesResult = await client.query(
      'SELECT * FROM goal_obstacles WHERE goal_id = $1 ORDER BY order_index',
      [goalId]
    );

    // Fetch recent check-ins
    const checkinsResult = await client.query(
      'SELECT * FROM goal_checkins WHERE goal_id = $1 ORDER BY created_at DESC LIMIT 10',
      [goalId]
    );

    return {
      ...goal,
      microHabits: habitsResult.rows,
      milestones: milestonesResult.rows,
      potentialObstacles: obstaclesResult.rows,
      recentCheckins: checkinsResult.rows,
    };
  }
}

module.exports = new GoalPlannerController();
