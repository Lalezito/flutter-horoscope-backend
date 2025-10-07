/**
 * PERSONALIZATION ROUTES
 * 
 * API endpoints for hiperpersonal horoscope system with exact birth time calculations
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const personalizationService = require('../services/personalizationService');
const authService = require('../services/authenticationService');
const { validateInput, endpointLimits } = require('../middleware/security');
const { Pool } = require('pg');

// Initialize database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Apply rate limiting to personalization endpoints
router.use(endpointLimits.premium);

/**
 * Middleware to validate premium subscription
 */
const requirePremium = async (req, res, next) => {
    try {
        const validation = await personalizationService.validatePremiumSubscription(req.user.id);
        if (!validation.valid) {
            return res.status(403).json({
                error: 'Premium subscription required',
                message: validation.reason,
                upgrade_required: true
            });
        }
        next();
    } catch (error) {
        console.error('Premium validation error:', error);
        res.status(500).json({
            error: 'Failed to validate subscription status',
            message: error.message
        });
    }
};

/**
 * @route POST /api/personalization/birth-data
 * @description Save or update user birth information for personalized horoscopes
 * @access Private (Premium)
 * @body {string} birth_date - Birth date in YYYY-MM-DD format
 * @body {string} [birth_time] - Birth time in HH:MM:SS format (optional)
 * @body {string} birth_timezone - IANA timezone identifier
 * @body {string} birth_city - Birth city name
 * @body {string} birth_country - Birth country name  
 * @body {number} birth_latitude - Birth latitude (-90 to 90)
 * @body {number} birth_longitude - Birth longitude (-180 to 180)
 * @body {number} [birth_elevation] - Elevation in meters (optional)
 * @body {boolean} [verified_birth_time] - User confirms exact birth time (optional)
 * @body {string} [house_system] - Preferred house system (optional)
 * @body {string} [ayanamsa] - Ayanamsa for sidereal calculations (optional)
 */
router.post('/birth-data', 
    authService.requireRole('premium_user'),
    requirePremium,
    [
        body('birth_date').isISO8601().withMessage('Valid birth date required (YYYY-MM-DD)'),
        body('birth_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Valid birth time required (HH:MM:SS)'),
        body('birth_timezone').notEmpty().withMessage('Birth timezone required'),
        body('birth_city').trim().isLength({ min: 1, max: 255 }).withMessage('Birth city required'),
        body('birth_country').trim().isLength({ min: 1, max: 100 }).withMessage('Birth country required'),
        body('birth_latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required (-90 to 90)'),
        body('birth_longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required (-180 to 180)'),
        body('birth_elevation').optional().isInt({ min: -1000, max: 10000 }).withMessage('Valid elevation in meters'),
        body('verified_birth_time').optional().isBoolean().withMessage('Verified birth time must be boolean'),
        body('house_system').optional().isIn(['placidus', 'koch', 'campanus', 'regiomontanus', 'equal', 'whole_sign']).withMessage('Invalid house system'),
        body('ayanamsa').optional().isIn(['lahiri', 'raman', 'krishnamurti', 'fagan_bradley']).withMessage('Invalid ayanamsa'),
        validateInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userId = req.user.id;
            const birthData = {
                user_id: userId,
                birth_date: req.body.birth_date,
                birth_time: req.body.birth_time || null,
                birth_timezone: req.body.birth_timezone,
                birth_city: req.body.birth_city,
                birth_country: req.body.birth_country,
                birth_latitude: parseFloat(req.body.birth_latitude),
                birth_longitude: parseFloat(req.body.birth_longitude),
                birth_elevation: req.body.birth_elevation || 0,
                verified_birth_time: req.body.verified_birth_time || false,
                house_system: req.body.house_system || 'placidus',
                ayanamsa: req.body.ayanamsa || 'lahiri',
                tropical_or_sidereal: 'tropical', // Default to tropical
                data_source: 'user_input',
                accuracy_level: req.body.birth_time && req.body.verified_birth_time ? 'high' : 
                               req.body.birth_time ? 'medium' : 'low'
            };

            // Calculate UTC birth datetime and Julian Day Number
            const moment = require('moment-timezone');
            const birthMoment = moment.tz(
                `${birthData.birth_date} ${birthData.birth_time || '12:00:00'}`,
                'YYYY-MM-DD HH:mm:ss',
                birthData.birth_timezone
            ).utc();

            birthData.utc_birth_datetime = birthMoment.toISOString();
            
            // Calculate Julian Day Number using personalization service
            const sweph = require('sweph');
            birthData.julian_day_number = sweph.julday(
                birthMoment.year(),
                birthMoment.month() + 1,
                birthMoment.date(),
                birthMoment.hour() + (birthMoment.minute() / 60.0) + (birthMoment.second() / 3600.0),
                1 // 1 for SE_GREG_CAL
            );

            // Insert or update birth data
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check if birth data already exists
                const existingResult = await client.query(
                    'SELECT id FROM user_birth_data WHERE user_id = $1',
                    [userId]
                );

                let birthDataId;
                if (existingResult.rows.length > 0) {
                    // Update existing birth data
                    const updateResult = await client.query(`
                        UPDATE user_birth_data 
                        SET birth_date = $2, birth_time = $3, birth_timezone = $4, birth_city = $5, 
                            birth_country = $6, birth_latitude = $7, birth_longitude = $8, 
                            birth_elevation = $9, utc_birth_datetime = $10, julian_day_number = $11,
                            house_system = $12, ayanamsa = $13, verified_birth_time = $14,
                            accuracy_level = $15, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = $1
                        RETURNING id
                    `, [
                        userId, birthData.birth_date, birthData.birth_time, birthData.birth_timezone,
                        birthData.birth_city, birthData.birth_country, birthData.birth_latitude,
                        birthData.birth_longitude, birthData.birth_elevation, birthData.utc_birth_datetime,
                        birthData.julian_day_number, birthData.house_system, birthData.ayanamsa,
                        birthData.verified_birth_time, birthData.accuracy_level
                    ]);
                    birthDataId = updateResult.rows[0].id;

                    // Delete existing birth chart (will be recalculated)
                    await client.query('DELETE FROM user_birth_chart WHERE user_id = $1', [userId]);
                } else {
                    // Insert new birth data
                    const insertResult = await client.query(`
                        INSERT INTO user_birth_data (
                            user_id, birth_date, birth_time, birth_timezone, birth_city, birth_country,
                            birth_latitude, birth_longitude, birth_elevation, utc_birth_datetime,
                            julian_day_number, house_system, ayanamsa, tropical_or_sidereal,
                            data_source, accuracy_level, verified_birth_time
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                        RETURNING id
                    `, [
                        birthData.user_id, birthData.birth_date, birthData.birth_time, birthData.birth_timezone,
                        birthData.birth_city, birthData.birth_country, birthData.birth_latitude,
                        birthData.birth_longitude, birthData.birth_elevation, birthData.utc_birth_datetime,
                        birthData.julian_day_number, birthData.house_system, birthData.ayanamsa,
                        birthData.tropical_or_sidereal, birthData.data_source, birthData.accuracy_level,
                        birthData.verified_birth_time
                    ]);
                    birthDataId = insertResult.rows[0].id;
                }

                await client.query('COMMIT');

                // Clear cached birth chart
                const redisService = require('../services/redisService');
                await redisService.delete(`birth_chart:${userId}`);

                res.json({
                    success: true,
                    message: 'Birth data saved successfully',
                    birth_data_id: birthDataId,
                    accuracy_level: birthData.accuracy_level,
                    next_step: 'birth_chart_calculation'
                });

            } catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Birth data save error:', error);
            res.status(500).json({
                error: 'Failed to save birth data',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/personalization/birth-chart/:userId
 * @description Get calculated birth chart for user
 * @access Private (Premium)
 * @param {string} userId - User ID (UUID)
 */
router.get('/birth-chart/:userId',
    authService.requireRole('premium_user'),
    requirePremium,
    [
        param('userId').isUUID().withMessage('Valid user ID required'),
        validateInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userId = req.params.userId;

            // Verify user can access this birth chart (own chart or admin)
            if (req.user.id !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only access your own birth chart'
                });
            }

            // Get birth data first
            const birthDataResult = await pool.query(
                'SELECT * FROM user_birth_data WHERE user_id = $1',
                [userId]
            );

            if (birthDataResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Birth data not found',
                    message: 'Please complete your birth data first'
                });
            }

            const birthData = birthDataResult.rows[0];

            // Calculate birth chart using personalization service
            const birthChart = await personalizationService.calculateBirthChart(userId, birthData);

            // Store calculated birth chart in database
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check if birth chart already exists
                const existingChart = await client.query(
                    'SELECT id FROM user_birth_chart WHERE user_id = $1',
                    [userId]
                );

                if (existingChart.rows.length === 0) {
                    // Insert new birth chart
                    await client.query(`
                        INSERT INTO user_birth_chart (
                            user_id, birth_data_id, sun_position, moon_position, mercury_position,
                            venus_position, mars_position, jupiter_position, saturn_position,
                            uranus_position, neptune_position, pluto_position, north_node_position,
                            house_cusps, ascendant, midheaven, descendant, ic, full_chart_data
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    `, [
                        userId, birthData.id,
                        birthChart.planetary_positions.sun?.longitude || 0,
                        birthChart.planetary_positions.moon?.longitude || 0,
                        birthChart.planetary_positions.mercury?.longitude || 0,
                        birthChart.planetary_positions.venus?.longitude || 0,
                        birthChart.planetary_positions.mars?.longitude || 0,
                        birthChart.planetary_positions.jupiter?.longitude || 0,
                        birthChart.planetary_positions.saturn?.longitude || 0,
                        birthChart.planetary_positions.uranus?.longitude || 0,
                        birthChart.planetary_positions.neptune?.longitude || 0,
                        birthChart.planetary_positions.pluto?.longitude || 0,
                        birthChart.planetary_positions.north_node?.longitude || 0,
                        JSON.stringify(birthChart.house_cusps || []),
                        birthChart.ascendant,
                        birthChart.midheaven,
                        birthChart.descendant,
                        birthChart.ic,
                        JSON.stringify(birthChart)
                    ]);
                }

                await client.query('COMMIT');
            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error('Birth chart storage error:', dbError);
            } finally {
                client.release();
            }

            res.json({
                success: true,
                birth_chart: birthChart,
                accuracy_level: birthData.accuracy_level,
                calculated_at: birthChart.calculation_timestamp
            });

        } catch (error) {
            console.error('Birth chart calculation error:', error);
            res.status(500).json({
                error: 'Failed to calculate birth chart',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/personalization/horoscope/:userId/:date
 * @description Get personalized daily horoscope based on birth chart and transits
 * @access Private (Premium)
 * @param {string} userId - User ID (UUID)
 * @param {string} date - Date in YYYY-MM-DD format
 */
router.get('/horoscope/:userId/:date',
    authService.requireRole('premium_user'),
    requirePremium,
    [
        param('userId').isUUID().withMessage('Valid user ID required'),
        param('date').isISO8601().withMessage('Valid date required (YYYY-MM-DD)'),
        validateInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userId = req.params.userId;
            const date = req.params.date;

            // Verify user can access this horoscope
            if (req.user.id !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only access your own personalized horoscope'
                });
            }

            // Check if user has birth data
            const birthDataResult = await pool.query(
                'SELECT id FROM user_birth_data WHERE user_id = $1',
                [userId]
            );

            if (birthDataResult.rows.length === 0) {
                return res.status(404).json({
                    error: 'Birth data required',
                    message: 'Please complete your birth data to get personalized horoscopes'
                });
            }

            // Generate personalized horoscope
            const personalizedHoroscope = await personalizationService.generatePersonalizedHoroscope(userId, new Date(date));

            // Store in database
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Check if horoscope already exists
                const existingHoroscope = await pool.query(
                    'SELECT id FROM personalized_horoscopes WHERE user_id = $1 AND horoscope_date = $2 AND horoscope_type = $3',
                    [userId, date, 'daily']
                );

                if (existingHoroscope.rows.length === 0) {
                    // Insert new personalized horoscope
                    await client.query(`
                        INSERT INTO personalized_horoscopes (
                            user_id, birth_chart_id, horoscope_date, horoscope_type,
                            current_planetary_positions, transit_aspects, content,
                            personalization_factors, love_rating, work_rating, health_rating,
                            money_rating, overall_rating, lucky_numbers, lucky_colors,
                            mood, advice, keywords, personalization_level
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                    `, [
                        userId, birthDataResult.rows[0].id, date, 'daily',
                        JSON.stringify(personalizedHoroscope.current_transits),
                        JSON.stringify(personalizedHoroscope.transit_aspects),
                        JSON.stringify(personalizedHoroscope.content),
                        JSON.stringify(personalizedHoroscope.personalization_factors),
                        personalizedHoroscope.ratings.love_rating,
                        personalizedHoroscope.ratings.work_rating,
                        personalizedHoroscope.ratings.health_rating,
                        personalizedHoroscope.ratings.money_rating,
                        personalizedHoroscope.ratings.overall_rating,
                        JSON.stringify(personalizedHoroscope.lucky_numbers),
                        JSON.stringify(personalizedHoroscope.lucky_colors),
                        personalizedHoroscope.mood,
                        personalizedHoroscope.advice,
                        JSON.stringify(personalizedHoroscope.keywords),
                        personalizedHoroscope.personalization_level
                    ]);
                }

                await client.query('COMMIT');
            } catch (dbError) {
                await client.query('ROLLBACK');
                console.error('Personalized horoscope storage error:', dbError);
            } finally {
                client.release();
            }

            res.json({
                success: true,
                personalized_horoscope: personalizedHoroscope,
                personalization_level: personalizedHoroscope.personalization_level,
                generated_at: personalizedHoroscope.generated_at
            });

        } catch (error) {
            console.error('Personalized horoscope generation error:', error);
            res.status(500).json({
                error: 'Failed to generate personalized horoscope',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/personalization/horoscope/:userId
 * @description Get today's personalized horoscope (convenience endpoint)
 * @access Private (Premium)
 * @param {string} userId - User ID (UUID)
 */
router.get('/horoscope/:userId',
    authService.requireRole('premium_user'),
    requirePremium,
    [
        param('userId').isUUID().withMessage('Valid user ID required'),
        validateInput
    ],
    async (req, res) => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        req.params.date = today;
        
        // Forward to the main horoscope endpoint
        const horoscopeHandler = router.stack.find(layer => 
            layer.route && layer.route.path === '/horoscope/:userId/:date'
        );
        
        if (horoscopeHandler) {
            horoscopeHandler.route.stack[horoscopeHandler.route.stack.length - 1].handle(req, res);
        } else {
            res.status(500).json({ error: 'Horoscope handler not found' });
        }
    }
);

/**
 * @route PUT /api/personalization/preferences/:userId
 * @description Update user horoscope preferences
 * @access Private (Premium)
 * @param {string} userId - User ID (UUID)
 * @body {array} [focus_areas] - Areas to focus on in horoscopes
 * @body {string} [detail_level] - Level of detail (brief, medium, detailed)
 * @body {string} [tone] - Tone preference (optimistic, realistic, balanced, cautious)
 * @body {string} [language_code] - Language preference
 * @body {boolean} [include_transits] - Include transit information
 * @body {boolean} [daily_notification] - Enable daily notifications
 * @body {string} [preferred_notification_time] - Preferred notification time
 */
router.put('/preferences/:userId',
    authService.requireRole('premium_user'),
    requirePremium,
    [
        param('userId').isUUID().withMessage('Valid user ID required'),
        body('focus_areas').optional().isArray().withMessage('Focus areas must be an array'),
        body('detail_level').optional().isIn(['brief', 'medium', 'detailed']).withMessage('Invalid detail level'),
        body('tone').optional().isIn(['optimistic', 'realistic', 'balanced', 'cautious']).withMessage('Invalid tone'),
        body('language_code').optional().isLength({ min: 2, max: 10 }).withMessage('Invalid language code'),
        body('include_transits').optional().isBoolean().withMessage('Include transits must be boolean'),
        body('daily_notification').optional().isBoolean().withMessage('Daily notification must be boolean'),
        body('preferred_notification_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Invalid notification time format'),
        validateInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userId = req.params.userId;

            // Verify user can update these preferences
            if (req.user.id !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only update your own preferences'
                });
            }

            const preferences = {};
            
            // Only include provided fields
            if (req.body.focus_areas !== undefined) preferences.focus_areas = req.body.focus_areas;
            if (req.body.detail_level !== undefined) preferences.detail_level = req.body.detail_level;
            if (req.body.tone !== undefined) preferences.tone = req.body.tone;
            if (req.body.language_code !== undefined) preferences.language_code = req.body.language_code;
            if (req.body.include_transits !== undefined) preferences.include_transits = req.body.include_transits;
            if (req.body.daily_notification !== undefined) preferences.daily_notification = req.body.daily_notification;
            if (req.body.preferred_notification_time !== undefined) preferences.preferred_notification_time = req.body.preferred_notification_time;

            // Update or insert preferences
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const existingPrefs = await client.query(
                    'SELECT id FROM user_horoscope_preferences WHERE user_id = $1',
                    [userId]
                );

                if (existingPrefs.rows.length > 0) {
                    // Build dynamic UPDATE query
                    const updateFields = [];
                    const updateValues = [userId];
                    let paramIndex = 2;

                    for (const [key, value] of Object.entries(preferences)) {
                        updateFields.push(`${key} = $${paramIndex}`);
                        updateValues.push(Array.isArray(value) ? JSON.stringify(value) : value);
                        paramIndex++;
                    }

                    if (updateFields.length > 0) {
                        updateFields.push('updated_at = CURRENT_TIMESTAMP');
                        const updateQuery = `
                            UPDATE user_horoscope_preferences 
                            SET ${updateFields.join(', ')} 
                            WHERE user_id = $1
                        `;
                        await client.query(updateQuery, updateValues);
                    }
                } else {
                    // Insert new preferences with defaults
                    await client.query(`
                        INSERT INTO user_horoscope_preferences (
                            user_id, focus_areas, detail_level, tone, language_code,
                            include_transits, daily_notification, preferred_notification_time
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        userId,
                        JSON.stringify(preferences.focus_areas || ['love', 'career', 'health', 'money']),
                        preferences.detail_level || 'medium',
                        preferences.tone || 'balanced',
                        preferences.language_code || 'en',
                        preferences.include_transits !== undefined ? preferences.include_transits : true,
                        preferences.daily_notification !== undefined ? preferences.daily_notification : true,
                        preferences.preferred_notification_time || '09:00:00'
                    ]);
                }

                await client.query('COMMIT');

                res.json({
                    success: true,
                    message: 'Preferences updated successfully',
                    updated_preferences: preferences
                });

            } catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Preferences update error:', error);
            res.status(500).json({
                error: 'Failed to update preferences',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/personalization/preferences/:userId
 * @description Get user horoscope preferences
 * @access Private (Premium)
 * @param {string} userId - User ID (UUID)
 */
router.get('/preferences/:userId',
    authService.requireRole('premium_user'),
    requirePremium,
    [
        param('userId').isUUID().withMessage('Valid user ID required'),
        validateInput
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const userId = req.params.userId;

            // Verify user can access these preferences
            if (req.user.id !== userId && !['admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You can only access your own preferences'
                });
            }

            const result = await pool.query(
                'SELECT * FROM user_horoscope_preferences WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                // Return default preferences
                res.json({
                    success: true,
                    preferences: {
                        focus_areas: ['love', 'career', 'health', 'money'],
                        detail_level: 'medium',
                        tone: 'balanced',
                        language_code: 'en',
                        include_transits: true,
                        daily_notification: true,
                        preferred_notification_time: '09:00:00',
                        is_default: true
                    }
                });
            } else {
                const prefs = result.rows[0];
                res.json({
                    success: true,
                    preferences: {
                        focus_areas: prefs.focus_areas,
                        detail_level: prefs.detail_level,
                        tone: prefs.tone,
                        language_code: prefs.language_code,
                        include_transits: prefs.include_transits,
                        include_progressions: prefs.include_progressions,
                        include_solar_return: prefs.include_solar_return,
                        focus_on_major_aspects: prefs.focus_on_major_aspects,
                        daily_notification: prefs.daily_notification,
                        weekly_notification: prefs.weekly_notification,
                        monthly_notification: prefs.monthly_notification,
                        major_transit_alerts: prefs.major_transit_alerts,
                        preferred_notification_time: prefs.preferred_notification_time,
                        notification_timezone: prefs.notification_timezone,
                        created_at: prefs.created_at,
                        updated_at: prefs.updated_at
                    }
                });
            }

        } catch (error) {
            console.error('Get preferences error:', error);
            res.status(500).json({
                error: 'Failed to get preferences',
                message: error.message
            });
        }
    }
);

/**
 * @route GET /api/personalization/status
 * @description Get personalization service status
 * @access Private (Admin)
 */
router.get('/status',
    authService.requireRole('admin'),
    async (req, res) => {
        try {
            const status = personalizationService.getStatus();
            
            // Get database statistics
            const statsResult = await pool.query(`
                SELECT 
                    'birth_data' as table_name,
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN birth_time IS NOT NULL THEN 1 END) as with_birth_time,
                    COUNT(CASE WHEN verified_birth_time = true THEN 1 END) as verified_times
                FROM user_birth_data
                UNION ALL
                SELECT 
                    'birth_charts' as table_name,
                    COUNT(*) as total_records,
                    0 as with_birth_time,
                    0 as verified_times
                FROM user_birth_chart
                UNION ALL
                SELECT 
                    'personalized_horoscopes' as table_name,
                    COUNT(*) as total_records,
                    COUNT(CASE WHEN created_at > CURRENT_DATE THEN 1 END) as with_birth_time,
                    0 as verified_times
                FROM personalized_horoscopes
            `);

            const databaseStats = {};
            for (const row of statsResult.rows) {
                databaseStats[row.table_name] = {
                    total_records: parseInt(row.total_records),
                    with_birth_time: parseInt(row.with_birth_time),
                    verified_times: parseInt(row.verified_times)
                };
            }

            res.json({
                success: true,
                service_status: status,
                database_statistics: databaseStats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Status check error:', error);
            res.status(500).json({
                error: 'Failed to get status',
                message: error.message
            });
        }
    }
);

module.exports = router;