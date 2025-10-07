/**
 * VERIFIABLE PREDICTIONS SERVICE
 * 
 * Generates specific, testable astrological predictions with 48-hour verification system
 * Integrates with Swiss Ephemeris for accurate astrological calculations
 */

const db = require('../config/db');
const personalizationService = require('./personalizationService');
const redisService = require('./redisService');
const moment = require('moment-timezone');
const sweph = require('sweph');

class PredictionService {
    constructor() {
        this.config = {
            // Prediction generation settings
            maxPredictionsPerUser: 3, // Maximum active predictions per user
            defaultTimeframe: 48, // Default prediction timeframe in hours
            minConfidenceThreshold: 0.3, // Minimum confidence for predictions
            maxConfidenceThreshold: 0.95, // Maximum realistic confidence
            
            // Astrological orbs for prediction strength
            strongAspectOrbs: {
                conjunction: 3,
                opposition: 3,
                trine: 2,
                square: 2
            },
            
            // Cache settings
            cacheDuration: 3600, // 1 hour cache for transit data
            userPreferencesCacheDuration: 86400, // 24 hours for user preferences
        };

        // Prediction categories with specific generation logic
        this.predictionCategories = {
            love: {
                planets: ['venus', 'moon', 'mars'],
                houses: [5, 7, 11], // Romance, partnerships, social
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.7,
                specificity_templates: [
                    'romantic_encounter',
                    'relationship_deepening', 
                    'love_communication',
                    'attraction_energy',
                    'emotional_connection'
                ]
            },
            career: {
                planets: ['sun', 'mercury', 'jupiter', 'saturn'],
                houses: [10, 6, 2], // Career, work, resources
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.8,
                specificity_templates: [
                    'professional_opportunity',
                    'recognition_achievement',
                    'workplace_communication',
                    'skill_demonstration',
                    'authority_interaction'
                ]
            },
            finance: {
                planets: ['venus', 'jupiter', 'sun'],
                houses: [2, 8, 11], // Resources, investments, gains
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.75,
                specificity_templates: [
                    'financial_opportunity',
                    'unexpected_income',
                    'investment_insight',
                    'resource_discovery',
                    'value_recognition'
                ]
            },
            health: {
                planets: ['sun', 'moon', 'mars'],
                houses: [1, 6, 8], // Self, health, transformation
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.65,
                specificity_templates: [
                    'energy_improvement',
                    'wellness_insight',
                    'physical_vitality',
                    'healing_opportunity',
                    'body_awareness'
                ]
            },
            social: {
                planets: ['mercury', 'venus', 'moon'],
                houses: [3, 11, 7], // Communication, friends, others
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.7,
                specificity_templates: [
                    'new_connection',
                    'social_recognition',
                    'communication_breakthrough',
                    'group_harmony',
                    'friendship_deepening'
                ]
            },
            travel: {
                planets: ['mercury', 'jupiter', 'sun'],
                houses: [3, 9, 12], // Travel, expansion, distant places
                aspects: ['trine', 'sextile', 'conjunction'],
                confidence_base: 0.8,
                specificity_templates: [
                    'journey_opportunity',
                    'distant_communication',
                    'travel_encounter',
                    'exploration_insight',
                    'movement_liberation'
                ]
            }
        };

        console.log('🔮 Prediction Service initialized with verifiable prediction system');
    }

    /**
     * Generate a verifiable prediction for a user
     */
    async generateVerifiablePrediction(userId, category, options = {}) {
        try {
            console.log(`🔮 Generating ${category} prediction for user ${userId}`);
            
            // Check if user has premium access
            const premiumRequired = await this.isPremiumRequired(category);
            const userPremiumStatus = await this.checkUserPremiumStatus(userId);
            
            if (premiumRequired && !userPremiumStatus) {
                throw new Error('Premium subscription required for this prediction category');
            }

            // Check user's active prediction count
            const activePredictions = await this.getActivePredictionCount(userId);
            if (activePredictions >= this.config.maxPredictionsPerUser) {
                throw new Error('Maximum active predictions limit reached');
            }

            // Get user's birth data for personalized calculations
            const birthData = await this.getUserBirthData(userId);
            if (!birthData) {
                throw new Error('User birth data required for personalized predictions');
            }

            // Get user preferences
            const preferences = await this.getUserPredictionPreferences(userId);
            
            // Calculate current astrological transits
            const transits = await this.calculateCurrentTransits(birthData);
            
            // Analyze prediction potential for the category
            const predictionPotential = await this.analyzePredictionPotential(
                category, 
                transits, 
                birthData,
                preferences
            );

            if (predictionPotential.confidence < this.config.minConfidenceThreshold) {
                throw new Error('Insufficient astrological conditions for reliable prediction');
            }

            // Generate specific prediction content
            const predictionContent = await this.generateSpecificPrediction(
                category,
                predictionPotential,
                transits,
                birthData,
                options
            );

            // Store prediction in database
            const predictionId = await this.storePrediction({
                userId,
                category,
                content: predictionContent.text,
                confidence: predictionPotential.confidence,
                astrologicalBasis: predictionPotential.astrologicalData,
                timeframe: options.timeframe || preferences.preferred_timeframe_hours || this.config.defaultTimeframe,
                specificity: predictionContent.specificity
            });

            // Schedule alerts for this prediction
            await this.scheduleAlerts(predictionId, predictionContent.timeframe);

            // Log generation for monitoring
            await this.logPredictionGeneration(userId, category, predictionId, true);

            return {
                predictionId,
                content: predictionContent.text,
                confidence: predictionPotential.confidence,
                category,
                timeframe: predictionContent.timeframe,
                astrologicalReasoning: predictionPotential.reasoning,
                alertSchedule: predictionContent.alertDates
            };

        } catch (error) {
            console.error(`❌ Prediction generation error for user ${userId}:`, error);
            
            // Log failed generation
            await this.logPredictionGeneration(userId, category, null, false, error.message);
            
            throw error;
        }
    }

    /**
     * Calculate current astrological transits
     */
    async calculateCurrentTransits(birthData) {
        try {
            const now = moment().utc();
            const julianDay = sweph.julday(now.year(), now.month() + 1, now.date(), now.hour() + now.minute()/60.0, 1);
            
            const transits = {};
            const aspects = [];

            // Calculate current planetary positions
            const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
            
            for (const planet of planets) {
                const planetId = this.getPlanetId(planet);
                const result = sweph.calc_ut(julianDay, planetId, sweph.SEFLG_SWIEPH);
                
                if (!result.error) {
                    transits[planet] = {
                        longitude: result.xx[0],
                        latitude: result.xx[1],
                        distance: result.xx[2],
                        speed: result.xx[3],
                        house: this.calculateHouse(result.xx[0], birthData)
                    };

                    // Calculate aspects to natal planets
                    if (birthData.birthChart && birthData.birthChart[planet]) {
                        const natalPosition = birthData.birthChart[planet].longitude;
                        const aspectInfo = this.calculateAspect(result.xx[0], natalPosition);
                        
                        if (aspectInfo.aspect) {
                            aspects.push({
                                transitPlanet: planet,
                                natalPlanet: planet,
                                aspect: aspectInfo.aspect,
                                orb: aspectInfo.orb,
                                strength: aspectInfo.strength,
                                applying: result.xx[3] > 0 ? 'applying' : 'separating'
                            });
                        }
                    }
                }
            }

            // Calculate lunar phase
            const moonLongitude = transits.moon?.longitude || 0;
            const sunLongitude = transits.sun?.longitude || 0;
            const lunarPhase = this.calculateLunarPhase(moonLongitude, sunLongitude);

            return {
                planets: transits,
                aspects,
                lunarPhase,
                calculatedAt: now.toISOString()
            };

        } catch (error) {
            console.error('❌ Transit calculation error:', error);
            
            // Fallback to simplified calculations
            return this.getFallbackTransits();
        }
    }

    /**
     * Analyze prediction potential based on transits
     */
    async analyzePredictionPotential(category, transits, birthData, preferences) {
        const categoryConfig = this.predictionCategories[category];
        if (!categoryConfig) {
            throw new Error(`Unknown prediction category: ${category}`);
        }

        let totalConfidence = 0;
        let astrologicalFactors = [];
        let reasoningPoints = [];

        // Analyze relevant planetary transits
        for (const planet of categoryConfig.planets) {
            const transitData = transits.planets[planet];
            if (!transitData) continue;

            // Check if planet is in a relevant house
            if (categoryConfig.houses.includes(transitData.house)) {
                totalConfidence += 0.2;
                astrologicalFactors.push({
                    type: 'house_activation',
                    planet,
                    house: transitData.house,
                    strength: 0.2
                });
                reasoningPoints.push(`${planet.charAt(0).toUpperCase() + planet.slice(1)} is currently activating your ${this.getHouseName(transitData.house)} sector`);
            }
        }

        // Analyze aspects for the category
        for (const aspect of transits.aspects) {
            if (categoryConfig.aspects.includes(aspect.aspect) && 
                categoryConfig.planets.includes(aspect.transitPlanet)) {
                
                const aspectStrength = this.getAspectStrength(aspect.aspect, aspect.orb);
                totalConfidence += aspectStrength * 0.3;
                
                astrologicalFactors.push({
                    type: 'planetary_aspect',
                    aspect: aspect.aspect,
                    planet: aspect.transitPlanet,
                    strength: aspectStrength,
                    orb: aspect.orb
                });
                reasoningPoints.push(`${aspect.transitPlanet} forms a ${aspect.aspect} aspect, creating favorable ${category} energy`);
            }
        }

        // Lunar phase considerations
        const lunarBoost = this.getLunarPhaseBoost(transits.lunarPhase, category);
        totalConfidence += lunarBoost;
        
        if (lunarBoost > 0) {
            astrologicalFactors.push({
                type: 'lunar_phase',
                phase: transits.lunarPhase.name,
                strength: lunarBoost
            });
            reasoningPoints.push(`The ${transits.lunarPhase.name} moon enhances ${category} manifestation`);
        }

        // Apply category base confidence
        totalConfidence = Math.min(
            totalConfidence + categoryConfig.confidence_base * 0.3,
            this.config.maxConfidenceThreshold
        );

        // Ensure minimum threshold
        if (totalConfidence < this.config.minConfidenceThreshold) {
            totalConfidence = this.config.minConfidenceThreshold;
            reasoningPoints.push('Using baseline astrological patterns for prediction');
        }

        return {
            confidence: Math.round(totalConfidence * 100) / 100,
            astrologicalData: astrologicalFactors,
            reasoning: reasoningPoints.join('. ') + '.',
            category,
            calculatedAt: moment().toISOString()
        };
    }

    /**
     * Generate specific, verifiable prediction content
     */
    async generateSpecificPrediction(category, predictionPotential, transits, birthData, options) {
        const categoryConfig = this.predictionCategories[category];
        const timeframe = options.timeframe || 48;
        
        // Select appropriate template based on astrological conditions
        const template = await this.selectOptimalTemplate(category, predictionPotential, transits);
        
        // Generate specific prediction text with astrological variables
        const predictionText = await this.generatePredictionText(template, {
            category,
            timeframe,
            transits,
            birthData,
            confidence: predictionPotential.confidence,
            astrologicalFactors: predictionPotential.astrologicalData
        });

        // Calculate specificity score based on prediction content
        const specificityScore = this.calculateSpecificityScore(predictionText, predictionPotential);

        // Calculate alert schedule
        const alertDates = this.calculateAlertSchedule(timeframe);

        return {
            text: predictionText,
            timeframe,
            specificity: specificityScore,
            alertDates,
            template: template.name,
            generatedAt: moment().toISOString()
        };
    }

    /**
     * Select optimal prediction template based on astrological conditions
     */
    async selectOptimalTemplate(category, predictionPotential, transits) {
        // Get templates for the category from database
        const templates = await db.query(`
            SELECT * FROM prediction_templates 
            WHERE category = $1 AND active = true
            ORDER BY success_rate DESC, usage_count ASC
            LIMIT 10
        `, [category]);

        if (templates.rows.length === 0) {
            // Fallback to default templates
            return this.getDefaultTemplate(category);
        }

        // Score templates based on current astrological conditions
        let bestTemplate = templates.rows[0];
        let bestScore = 0;

        for (const template of templates.rows) {
            const score = this.scoreTemplate(template, predictionPotential, transits);
            if (score > bestScore) {
                bestScore = score;
                bestTemplate = template;
            }
        }

        // Update template usage
        await db.query(`
            UPDATE prediction_templates 
            SET usage_count = usage_count + 1 
            WHERE id = $1
        `, [bestTemplate.id]);

        return {
            id: bestTemplate.id,
            name: bestTemplate.template_name,
            content: bestTemplate.template_content,
            confidence_multiplier: bestTemplate.confidence_multiplier,
            specificity_level: bestTemplate.specificity_level
        };
    }

    /**
     * Generate specific prediction text with astrological variables
     */
    async generatePredictionText(template, variables) {
        let predictionText = template.content;
        
        // Replace timeframe variables
        predictionText = predictionText.replace(/\{timeframe\}/g, `${variables.timeframe} hours`);
        
        // Replace astrological variables
        const astroVars = this.extractAstrologicalVariables(variables);
        
        for (const [key, value] of Object.entries(astroVars)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            predictionText = predictionText.replace(regex, value);
        }

        // Add specific timing if strong aspects are present
        const strongAspects = variables.astrologicalFactors.filter(f => f.strength > 0.7);
        if (strongAspects.length > 0) {
            predictionText += ` This energy will be strongest around ${this.calculatePeakTiming(strongAspects, variables.timeframe)}.`;
        }

        // Add confidence qualifier
        if (variables.confidence > 0.8) {
            predictionText += ' The astrological indicators are particularly strong for this prediction.';
        } else if (variables.confidence < 0.5) {
            predictionText += ' Pay attention to subtle signs and trust your intuition.';
        }

        return predictionText;
    }

    /**
     * Store prediction in database
     */
    async storePrediction(predictionData) {
        const expiresAt = moment().add(predictionData.timeframe, 'hours').toISOString();
        const predictedDate = moment().add(predictionData.timeframe, 'hours').toISOString();

        const result = await db.query(`
            INSERT INTO predictions (
                user_id, prediction_type, prediction_content, predicted_date,
                confidence_score, prediction_category, astrological_basis,
                specificity_score, expires_at, premium_required
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `, [
            predictionData.userId,
            'verifiable',
            predictionData.content,
            predictedDate,
            predictionData.confidence,
            predictionData.category,
            JSON.stringify(predictionData.astrologicalBasis),
            predictionData.specificity,
            expiresAt,
            await this.isPremiumRequired(predictionData.category)
        ]);

        // Update analytics
        await this.updateUserAnalytics(predictionData.userId, predictionData.category, predictionData.confidence);

        return result.rows[0].id;
    }

    /**
     * Schedule alerts for prediction
     */
    async scheduleAlerts(predictionId, timeframe) {
        const alerts = [
            { type: '48hr_warning', hours: Math.min(timeframe - 48, 0) },
            { type: '24hr_warning', hours: Math.min(timeframe - 24, 0) },
            { type: '2hr_warning', hours: Math.min(timeframe - 2, 0) },
            { type: 'verification_reminder', hours: timeframe + 24 }
        ];

        for (const alert of alerts) {
            if (alert.hours >= 0) {
                const alertDate = moment().add(alert.hours, 'hours').toISOString();
                
                await db.query(`
                    INSERT INTO prediction_alerts (prediction_id, alert_type, alert_date)
                    VALUES ($1, $2, $3)
                `, [predictionId, alert.type, alertDate]);
            }
        }
    }

    /**
     * Verify prediction outcome
     */
    async verifyPrediction(predictionId, userId, outcome, userFeedback) {
        try {
            // Get prediction details
            const prediction = await db.query(`
                SELECT * FROM predictions 
                WHERE id = $1 AND user_id = $2
            `, [predictionId, userId]);

            if (prediction.rows.length === 0) {
                throw new Error('Prediction not found');
            }

            const predictionData = prediction.rows[0];
            const verificationStatus = this.determineVerificationStatus(outcome, userFeedback);

            // Update prediction with verification
            await db.query(`
                UPDATE predictions 
                SET verification_status = $1, actual_outcome = $2, user_feedback = $3,
                    verified_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `, [verificationStatus, outcome, userFeedback, predictionId]);

            // Store detailed feedback
            await this.storePredictionFeedback(predictionId, userId, outcome, userFeedback);

            // Update template success rate if applicable
            await this.updateTemplateSuccessRate(predictionData, verificationStatus === 'verified');

            return {
                predictionId,
                verificationStatus,
                feedback: 'Prediction verification recorded successfully'
            };

        } catch (error) {
            console.error('❌ Prediction verification error:', error);
            throw error;
        }
    }

    /**
     * Get user's active predictions
     */
    async getUserActivePredictions(userId) {
        const result = await db.query(`
            SELECT p.*, pc.description as category_description,
                   EXTRACT(HOURS FROM (p.expires_at - CURRENT_TIMESTAMP)) as hours_remaining
            FROM predictions p
            LEFT JOIN prediction_categories pc ON p.prediction_category = pc.category_name
            WHERE p.user_id = $1 AND p.verification_status = 'pending' 
                AND p.expires_at > CURRENT_TIMESTAMP
            ORDER BY p.predicted_date ASC
        `, [userId]);

        return result.rows.map(row => ({
            id: row.id,
            content: row.prediction_content,
            category: row.prediction_category,
            categoryDescription: row.category_description,
            confidence: parseFloat(row.confidence_score),
            predictedDate: row.predicted_date,
            hoursRemaining: Math.round(row.hours_remaining),
            createdAt: row.created_at
        }));
    }

    /**
     * Get user prediction analytics
     */
    async getUserPredictionAnalytics(userId) {
        const result = await db.query(`
            SELECT 
                COUNT(*) as total_predictions,
                COUNT(*) FILTER (WHERE verification_status IN ('verified', 'user_confirmed')) as verified_predictions,
                COUNT(*) FILTER (WHERE verification_status = 'verified') as accurate_predictions,
                AVG(confidence_score) as average_confidence,
                COUNT(DISTINCT prediction_category) as categories_used,
                MIN(created_at) as first_prediction_date,
                MAX(created_at) as last_prediction_date
            FROM predictions 
            WHERE user_id = $1
        `, [userId]);

        if (result.rows.length === 0) {
            return null;
        }

        const stats = result.rows[0];
        const successRate = stats.verified_predictions > 0 ? 
            (stats.accurate_predictions / stats.verified_predictions * 100) : 0;

        return {
            totalPredictions: parseInt(stats.total_predictions),
            verifiedPredictions: parseInt(stats.verified_predictions),
            accuratePredictions: parseInt(stats.accurate_predictions),
            successRate: Math.round(successRate * 100) / 100,
            averageConfidence: Math.round(parseFloat(stats.average_confidence || 0) * 100) / 100,
            categoriesUsed: parseInt(stats.categories_used),
            firstPrediction: stats.first_prediction_date,
            lastPrediction: stats.last_prediction_date
        };
    }

    // HELPER METHODS

    async getUserBirthData(userId) {
        // Get from personalization service or database
        const result = await db.query(`
            SELECT birth_date, birth_time, birth_location, timezone,
                   latitude, longitude, birth_chart_data
            FROM user_birth_data 
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0] || null;
    }

    async getUserPredictionPreferences(userId) {
        const result = await db.query(`
            SELECT * FROM user_prediction_preferences 
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0] || {
            preferred_timeframe_hours: 48,
            preferred_categories: ['love', 'career', 'finance'],
            min_confidence_threshold: 0.3
        };
    }

    async getActivePredictionCount(userId) {
        const result = await db.query(`
            SELECT COUNT(*) FROM predictions 
            WHERE user_id = $1 AND verification_status = 'pending' 
                AND expires_at > CURRENT_TIMESTAMP
        `, [userId]);

        return parseInt(result.rows[0].count);
    }

    async checkUserPremiumStatus(userId) {
        // Check premium status from receipt validation or user preferences
        const result = await db.query(`
            SELECT premium_subscriber FROM user_prediction_preferences
            WHERE user_id = $1
        `, [userId]);

        return result.rows[0]?.premium_subscriber || false;
    }

    async isPremiumRequired(category) {
        const result = await db.query(`
            SELECT premium_only FROM prediction_categories 
            WHERE category_name = $1
        `, [category]);

        return result.rows[0]?.premium_only || false;
    }

    getPlanetId(planetName) {
        const planetIds = {
            sun: sweph.SE_SUN,
            moon: sweph.SE_MOON,
            mercury: sweph.SE_MERCURY,
            venus: sweph.SE_VENUS,
            mars: sweph.SE_MARS,
            jupiter: sweph.SE_JUPITER,
            saturn: sweph.SE_SATURN,
            uranus: sweph.SE_URANUS,
            neptune: sweph.SE_NEPTUNE,
            pluto: sweph.SE_PLUTO
        };
        return planetIds[planetName];
    }

    calculateAspect(position1, position2) {
        const diff = Math.abs(position1 - position2);
        const normalizedDiff = diff > 180 ? 360 - diff : diff;
        
        const aspects = {
            conjunction: { angle: 0, orb: 8 },
            opposition: { angle: 180, orb: 8 },
            trine: { angle: 120, orb: 6 },
            square: { angle: 90, orb: 6 },
            sextile: { angle: 60, orb: 4 }
        };

        for (const [aspectName, aspectData] of Object.entries(aspects)) {
            const orb = Math.abs(normalizedDiff - aspectData.angle);
            if (orb <= aspectData.orb) {
                return {
                    aspect: aspectName,
                    orb: orb,
                    strength: (aspectData.orb - orb) / aspectData.orb
                };
            }
        }

        return { aspect: null, orb: 0, strength: 0 };
    }

    calculateLunarPhase(moonLongitude, sunLongitude) {
        const phase = (moonLongitude - sunLongitude + 360) % 360;
        
        if (phase < 45) return { name: 'New Moon', phase: phase, strength: 0.8 };
        if (phase < 90) return { name: 'Waxing Crescent', phase: phase, strength: 0.6 };
        if (phase < 135) return { name: 'First Quarter', phase: phase, strength: 0.7 };
        if (phase < 180) return { name: 'Waxing Gibbous', phase: phase, strength: 0.6 };
        if (phase < 225) return { name: 'Full Moon', phase: phase, strength: 0.9 };
        if (phase < 270) return { name: 'Waning Gibbous', phase: phase, strength: 0.5 };
        if (phase < 315) return { name: 'Last Quarter', phase: phase, strength: 0.7 };
        return { name: 'Waning Crescent', phase: phase, strength: 0.4 };
    }

    calculateHouse(longitude, birthData) {
        // Simplified house calculation - would use more complex algorithm in production
        return Math.floor(longitude / 30) + 1;
    }

    getHouseName(houseNumber) {
        const houses = {
            1: 'Self/Identity',
            2: 'Resources/Values',
            3: 'Communication',
            4: 'Home/Family',
            5: 'Romance/Creativity',
            6: 'Health/Work',
            7: 'Partnerships',
            8: 'Transformation',
            9: 'Expansion/Travel',
            10: 'Career/Reputation',
            11: 'Friendships/Goals',
            12: 'Spirituality/Subconscious'
        };
        return houses[houseNumber] || 'Unknown';
    }

    async logPredictionGeneration(userId, category, predictionId, success, errorMessage = null) {
        await db.query(`
            INSERT INTO prediction_generation_log 
            (user_id, category, generation_trigger, prediction_id, success, error_message)
            VALUES ($1, $2, 'api_request', $3, $4, $5)
        `, [userId, category, predictionId, success, errorMessage]);
    }

    async updateUserAnalytics(userId, category, confidence) {
        await db.query(`
            INSERT INTO prediction_analytics (user_id, category, total_predictions, average_confidence)
            VALUES ($1, $2, 1, $3)
            ON CONFLICT (user_id, category, date) DO UPDATE SET
                total_predictions = prediction_analytics.total_predictions + 1,
                average_confidence = (prediction_analytics.average_confidence + $3) / 2,
                last_updated = CURRENT_TIMESTAMP
        `, [userId, category, confidence]);
    }

    getFallbackTransits() {
        // Simplified fallback when Swiss Ephemeris fails
        return {
            planets: {},
            aspects: [],
            lunarPhase: { name: 'Unknown', phase: 0, strength: 0.5 },
            calculatedAt: moment().toISOString(),
            fallback: true
        };
    }
}

module.exports = new PredictionService();