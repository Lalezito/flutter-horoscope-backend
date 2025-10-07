/**
 * Additional methods for VerifiablePredictionService
 * These should be merged into the main service file
 */

// Add these methods to the VerifiablePredictionService class:

/**
 * 📋 GET USER PREDICTIONS
 * Retrieves filtered predictions for a user with pagination
 */
async getUserPredictions(userId, options = {}) {
  try {
    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;
    const status = options.status === 'all' ? null : (options.status || 'active');
    
    let query = `
      SELECT 
        id, category, category_name, prediction_statement, specific_details,
        timeframe, measurable_outcome, confidence_score, astrology_strength,
        timing_precision, verification_criteria, astrology_basis,
        status, outcome, accuracy_score, user_feedback, verified_at,
        created_at, expires_at, updated_at,
        validation_scores, astrology_context,
        EXTRACT(EPOCH FROM (expires_at - NOW())) / 86400.0 AS days_remaining
      FROM verifiable_predictions
      WHERE user_id = $1
    `;
    
    const params = [userId];
    let paramCount = 1;
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    if (options.category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(options.category);
    }
    
    if (options.dateFrom) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      params.push(options.dateFrom);
    }
    
    if (options.dateTo) {
      paramCount++;
      query += ` AND created_at <= $${paramCount}`;
      params.push(options.dateTo);
    }
    
    // Add sorting
    const sortBy = options.sortBy === 'confidence' ? 'confidence_score' :
                   options.sortBy === 'expires_at' ? 'expires_at' : 'created_at';
    const sortOrder = options.sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM verifiable_predictions WHERE user_id = $1`;
    const countParams = [userId];
    
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return {
      success: true,
      predictions: result.rows,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + result.rows.length < totalCount
      },
      summary: {
        totalPredictions: totalCount,
        activePredictions: result.rows.filter(p => p.status === 'active').length,
        completedPredictions: result.rows.filter(p => p.outcome !== null).length
      }
    };
    
  } catch (error) {
    logger.logError(error, { context: 'get_user_predictions', userId });
    
    return {
      success: false,
      error: 'fetch_failed',
      message: 'Failed to retrieve user predictions'
    };
  }
}

/**
 * 🔍 GET SINGLE PREDICTION
 * Retrieves detailed information about a specific prediction
 */
async getSinglePrediction(predictionId, userId) {
  try {
    const query = `
      SELECT * FROM verifiable_predictions
      WHERE id = $1 AND user_id = $2
    `;
    
    const result = await db.query(query, [predictionId, userId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'prediction_not_found',
        message: 'Prediction not found or access denied'
      };
    }
    
    const prediction = result.rows[0];
    
    // Parse JSON fields
    prediction.astrology_basis = JSON.parse(prediction.astrology_basis || '{}');
    prediction.astrology_context = JSON.parse(prediction.astrology_context || '{}');
    prediction.validation_scores = JSON.parse(prediction.validation_scores || '{}');
    
    // Calculate days remaining
    const now = new Date();
    prediction.days_remaining = prediction.expires_at > now ? 
      Math.ceil((prediction.expires_at - now) / (1000 * 60 * 60 * 24)) : 0;
    
    return {
      success: true,
      prediction
    };
    
  } catch (error) {
    logger.logError(error, { context: 'get_single_prediction', predictionId, userId });
    
    return {
      success: false,
      error: 'fetch_failed',
      message: 'Failed to retrieve prediction'
    };
  }
}

// Continue with other methods...

module.exports = {
  // Export methods that should be added to the main service
};