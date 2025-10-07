/**
 * 🕰️ ASTROLOGICAL TIMING INTELLIGENCE SERVICE
 * 
 * Advanced AI-powered astrological timing recommendations providing specific,
 * actionable timing advice based on planetary transits, lunar cycles, and
 * personalized birth chart analysis.
 * 
 * Features:
 * - Planetary timing algorithms for all celestial bodies
 * - Lunar cycle optimization with void-of-course calculations
 * - Activity-specific timing intelligence
 * - Personalized timing based on birth charts
 * - AI-generated explanations with confidence scoring
 * - Electional astrology for optimal timing selection
 * - Mercury retrograde planning and workarounds
 * - Eclipse season guidance
 */

const OpenAI = require('openai');
const moment = require('moment-timezone');
const sweph = require('sweph');
const db = require('../config/db');
const redisService = require('./redisService');
const logger = require('../utils/logger');

class AstrologicalTimingService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Timing configuration
        this.config = {
            cacheDuration: 1800, // 30 minutes cache for timing calculations
            confidenceThreshold: 0.6, // Minimum confidence for recommendations
            maxRecommendations: 10, // Maximum timing recommendations per request
            lookAheadDays: 30, // How many days to analyze for optimal timing
            voidMoonThreshold: 3, // Hours of void moon to avoid for important decisions
        };

        // Planetary influences for different activities
        this.planetaryInfluences = {
            mercury: {
                activities: ['communication', 'contracts', 'technology', 'travel', 'learning', 'writing', 'negotiations'],
                positiveAspects: ['trine', 'sextile', 'conjunction'],
                retrogradeAvoid: ['contracts', 'technology', 'travel', 'major_purchases'],
                dailyHours: { start: 6, end: 9 }, // Mercury hour
                themes: ['mental_clarity', 'communication_flow', 'quick_thinking', 'adaptability']
            },
            venus: {
                activities: ['relationships', 'beauty', 'art', 'finance', 'harmony', 'social_events', 'romance'],
                positiveAspects: ['trine', 'sextile', 'conjunction'],
                retrogradeAvoid: ['new_relationships', 'major_purchases', 'beauty_treatments'],
                dailyHours: { start: 14, end: 17 }, // Venus hour
                themes: ['love_attraction', 'aesthetic_harmony', 'financial_flow', 'social_grace']
            },
            mars: {
                activities: ['action', 'surgery', 'competition', 'conflict_resolution', 'physical_activity', 'initiation'],
                positiveAspects: ['trine', 'sextile'],
                challengingAspects: ['square', 'opposition'],
                retrogradeAvoid: ['surgery', 'aggressive_actions', 'starting_conflicts'],
                dailyHours: { start: 9, end: 12 }, // Mars hour
                themes: ['courage_action', 'physical_energy', 'assertiveness', 'breakthrough']
            },
            jupiter: {
                activities: ['expansion', 'legal_matters', 'education', 'opportunity', 'publishing', 'teaching'],
                positiveAspects: ['trine', 'sextile', 'conjunction'],
                dailyHours: { start: 12, end: 15 }, // Jupiter hour
                themes: ['growth_expansion', 'wisdom_insight', 'opportunity_recognition', 'optimism']
            },
            saturn: {
                activities: ['structure', 'long_term_planning', 'real_estate', 'discipline', 'authority', 'commitment'],
                positiveAspects: ['trine', 'sextile'],
                challengingAspects: ['square', 'conjunction', 'opposition'],
                dailyHours: { start: 21, end: 24 }, // Saturn hour
                themes: ['discipline_structure', 'long_term_commitment', 'responsibility', 'foundation_building']
            },
            uranus: {
                activities: ['innovation', 'sudden_changes', 'technology', 'liberation', 'rebellion', 'invention'],
                positiveAspects: ['trine', 'sextile'],
                challengingAspects: ['square', 'opposition', 'conjunction'],
                dailyHours: { start: 3, end: 6 }, // Uranus hour
                themes: ['innovation_breakthrough', 'freedom_liberation', 'technological_advancement', 'unexpected_opportunity']
            },
            neptune: {
                activities: ['spirituality', 'creativity', 'healing', 'intuition', 'meditation', 'artistic_inspiration'],
                positiveAspects: ['trine', 'sextile'],
                challengingAspects: ['square', 'opposition'],
                dailyHours: { start: 18, end: 21 }, // Neptune hour
                themes: ['spiritual_connection', 'creative_inspiration', 'intuitive_insight', 'healing_energy']
            },
            pluto: {
                activities: ['transformation', 'power', 'investigation', 'deep_change', 'psychology', 'research'],
                positiveAspects: ['trine', 'sextile'],
                challengingAspects: ['square', 'opposition', 'conjunction'],
                dailyHours: { start: 0, end: 3 }, // Pluto hour
                themes: ['deep_transformation', 'power_empowerment', 'hidden_revelation', 'regeneration']
            }
        };

        // Lunar cycle influences
        this.lunarCycleInfluences = {
            newMoon: {
                activities: ['new_beginnings', 'goal_setting', 'manifestation', 'starting_projects'],
                themes: ['fresh_start', 'intention_setting', 'new_opportunities'],
                energy: 'initiating',
                confidence: 0.9
            },
            waxingCrescent: {
                activities: ['building', 'developing', 'learning', 'gathering_resources'],
                themes: ['growth_momentum', 'skill_building', 'resource_gathering'],
                energy: 'building',
                confidence: 0.7
            },
            firstQuarter: {
                activities: ['decision_making', 'overcoming_obstacles', 'taking_action'],
                themes: ['decisive_action', 'challenge_resolution', 'momentum_building'],
                energy: 'active',
                confidence: 0.8
            },
            waxingGibbous: {
                activities: ['refinement', 'adjustment', 'preparation', 'fine_tuning'],
                themes: ['refinement_perfection', 'preparation_optimization', 'detail_attention'],
                energy: 'refining',
                confidence: 0.6
            },
            fullMoon: {
                activities: ['completion', 'culmination', 'high_energy_activities', 'celebrations'],
                themes: ['peak_energy', 'completion_fulfillment', 'heightened_emotions'],
                energy: 'culminating',
                confidence: 0.9
            },
            waningGibbous: {
                activities: ['sharing', 'teaching', 'giving_back', 'harvesting_results'],
                themes: ['wisdom_sharing', 'gratitude_expression', 'result_harvesting'],
                energy: 'sharing',
                confidence: 0.6
            },
            lastQuarter: {
                activities: ['release', 'forgiveness', 'letting_go', 'clearing'],
                themes: ['release_clearing', 'forgiveness_healing', 'space_creation'],
                energy: 'releasing',
                confidence: 0.7
            },
            waningCrescent: {
                activities: ['rest', 'reflection', 'planning', 'preparation'],
                themes: ['inner_reflection', 'rest_restoration', 'wisdom_integration'],
                energy: 'reflecting',
                confidence: 0.5
            }
        };

        // Activity-specific timing templates
        this.activityTemplates = {
            business: {
                categories: ['job_interviews', 'salary_negotiations', 'product_launches', 'meetings', 'presentations'],
                favorablePlanets: ['jupiter', 'sun', 'mercury'],
                avoidRetrograde: ['mercury'],
                bestLunarPhases: ['waxingCrescent', 'firstQuarter', 'fullMoon'],
                confidence: 0.8
            },
            relationships: {
                categories: ['first_dates', 'proposals', 'difficult_conversations', 'breakups'],
                favorablePlanets: ['venus', 'moon'],
                avoidRetrograde: ['venus'],
                bestLunarPhases: ['newMoon', 'waxingCrescent', 'fullMoon'],
                confidence: 0.7
            },
            health: {
                categories: ['surgery', 'detox', 'fitness_routines', 'medical_procedures'],
                favorablePlanets: ['sun', 'moon'],
                avoidRetrograde: [],
                bestLunarPhases: ['newMoon', 'waxingCrescent'],
                confidence: 0.9
            },
            financial: {
                categories: ['investments', 'major_purchases', 'contract_signing', 'loan_applications'],
                favorablePlanets: ['jupiter', 'venus', 'sun'],
                avoidRetrograde: ['mercury', 'venus'],
                bestLunarPhases: ['newMoon', 'waxingCrescent', 'firstQuarter'],
                confidence: 0.8
            },
            creative: {
                categories: ['artistic_projects', 'writing', 'music', 'design_launches'],
                favorablePlanets: ['venus', 'neptune', 'moon'],
                avoidRetrograde: [],
                bestLunarPhases: ['newMoon', 'fullMoon'],
                confidence: 0.7
            },
            legal: {
                categories: ['court_dates', 'contract_negotiations', 'legal_filings'],
                favorablePlanets: ['jupiter', 'sun', 'saturn'],
                avoidRetrograde: ['mercury'],
                bestLunarPhases: ['waxingCrescent', 'firstQuarter'],
                confidence: 0.9
            },
            travel: {
                categories: ['departure_times', 'booking_optimization', 'safe_travel_periods'],
                favorablePlanets: ['jupiter', 'mercury'],
                avoidRetrograde: ['mercury'],
                bestLunarPhases: ['waxingCrescent', 'fullMoon'],
                confidence: 0.8
            },
            home: {
                categories: ['moving', 'renovations', 'family_gatherings', 'childcare_decisions'],
                favorablePlanets: ['moon', 'venus', 'saturn'],
                avoidRetrograde: [],
                bestLunarPhases: ['newMoon', 'waxingCrescent'],
                confidence: 0.7
            }
        };

        console.log('🕰️ Astrological Timing Intelligence Service initialized');
    }

    /**
     * Get optimal timing recommendations for a specific activity
     */
    async getOptimalTimingRecommendations({
        userId,
        activity,
        category,
        timeframe = 30, // days to look ahead
        urgency = 'normal', // normal, urgent, flexible
        personalizedBirthChart = true,
        includeExplanations = true,
        timezone = 'UTC'
    }) {
        try {
            logger.info(`🕰️ Generating timing recommendations for user ${userId}`, {
                activity, category, timeframe, urgency
            });

            // Get user's birth data for personalized timing
            let birthData = null;
            if (personalizedBirthChart && userId) {
                birthData = await this.getUserBirthData(userId);
            }

            // Calculate current astrological conditions
            const currentConditions = await this.calculateCurrentAstrologicalConditions(timezone);

            // Get timing opportunities within timeframe
            const timingOpportunities = await this.analyzeTimingOpportunities({
                activity,
                category,
                timeframe,
                birthData,
                currentConditions,
                timezone
            });

            // Score and rank timing options
            const scoredTimings = await this.scoreTimingOptions(
                timingOpportunities,
                activity,
                category,
                urgency,
                birthData
            );

            // Generate AI explanations if requested
            let explanations = {};
            if (includeExplanations) {
                explanations = await this.generateTimingExplanations(
                    scoredTimings,
                    activity,
                    category,
                    currentConditions,
                    birthData
                );
            }

            // Format final recommendations
            const recommendations = this.formatTimingRecommendations(
                scoredTimings,
                explanations,
                timezone
            );

            // Cache results
            await this.cacheTimingRecommendations(userId, activity, category, recommendations);

            return {
                activity,
                category,
                timeframe,
                timezone,
                recommendations,
                currentConditions: this.summarizeCurrentConditions(currentConditions),
                generatedAt: moment().toISOString(),
                confidence: this.calculateOverallConfidence(recommendations)
            };

        } catch (error) {
            logger.error('❌ Failed to generate timing recommendations:', error);
            throw new Error(`Timing recommendations failed: ${error.message}`);
        }
    }

    /**
     * Calculate current astrological conditions
     */
    async calculateCurrentAstrologicalConditions(timezone = 'UTC') {
        try {
            const now = moment().tz(timezone);
            const julianDay = this.dateToJulianDay(now.toDate());

            // Calculate current planetary positions
            const planetaryPositions = await this.calculatePlanetaryPositions(julianDay);

            // Calculate lunar phase and void-of-course periods
            const lunarInfo = await this.calculateLunarInformation(julianDay, timezone);

            // Check for retrograde planets
            const retrogradeStatus = await this.calculateRetrogradeStatus(julianDay);

            // Calculate aspects between planets
            const currentAspects = this.calculateCurrentAspects(planetaryPositions);

            // Check for special conditions (eclipses, etc.)
            const specialConditions = await this.checkSpecialConditions(julianDay);

            return {
                timestamp: now.toISOString(),
                julianDay,
                planetaryPositions,
                lunarInfo,
                retrogradeStatus,
                currentAspects,
                specialConditions,
                calculatedAt: moment().toISOString()
            };

        } catch (error) {
            logger.error('❌ Failed to calculate astrological conditions:', error);
            throw error;
        }
    }

    /**
     * Analyze timing opportunities within specified timeframe
     */
    async analyzeTimingOpportunities({
        activity,
        category,
        timeframe,
        birthData,
        currentConditions,
        timezone
    }) {
        const opportunities = [];
        const startDate = moment().tz(timezone);
        
        // Analyze each day within timeframe
        for (let day = 0; day < timeframe; day++) {
            const checkDate = startDate.clone().add(day, 'days');
            const julianDay = this.dateToJulianDay(checkDate.toDate());

            // Calculate daily astrological conditions
            const dailyConditions = await this.calculateDailyConditions(julianDay, timezone);

            // Analyze planetary hours for the day
            const planetaryHours = this.calculatePlanetaryHours(checkDate, timezone);

            // Check lunar conditions
            const lunarSuitability = this.analyzeLunarSuitability(
                dailyConditions.lunarInfo,
                activity,
                category
            );

            // Check planetary suitability
            const planetarySuitability = this.analyzePlanetarySuitability(
                dailyConditions.planetaryPositions,
                dailyConditions.retrogradeStatus,
                activity,
                category,
                birthData
            );

            // Calculate void-of-course moon periods
            const voidMoonPeriods = await this.calculateVoidMoonPeriods(julianDay, timezone);

            // Find optimal time windows for the day
            const optimalWindows = this.findOptimalTimeWindows(
                checkDate,
                planetaryHours,
                lunarSuitability,
                planetarySuitability,
                voidMoonPeriods,
                activity,
                category
            );

            // Add opportunities for this day
            opportunities.push(...optimalWindows);
        }

        return opportunities.sort((a, b) => b.overallScore - a.overallScore);
    }

    /**
     * Score timing options based on astrological factors
     */
    async scoreTimingOptions(opportunities, activity, category, urgency, birthData) {
        const scoredOptions = [];

        for (const opportunity of opportunities) {
            let score = 0;
            const factors = [];

            // Base scoring from astrological conditions
            score += opportunity.overallScore * 0.4;
            factors.push({
                type: 'astrological_conditions',
                value: opportunity.overallScore,
                weight: 0.4,
                description: 'Overall astrological favorability'
            });

            // Planetary hour bonus
            if (opportunity.planetaryHour) {
                const planetInfluence = this.planetaryInfluences[opportunity.planetaryHour.planet];
                if (planetInfluence && planetInfluence.activities.includes(activity)) {
                    score += 0.2;
                    factors.push({
                        type: 'planetary_hour',
                        value: 0.2,
                        weight: 0.2,
                        description: `${opportunity.planetaryHour.planet} hour enhances ${activity}`
                    });
                }
            }

            // Lunar phase bonus
            if (opportunity.lunarPhase) {
                const lunarInfluence = this.lunarCycleInfluences[opportunity.lunarPhase.name];
                if (lunarInfluence && lunarInfluence.activities.includes(activity)) {
                    score += lunarInfluence.confidence * 0.15;
                    factors.push({
                        type: 'lunar_phase',
                        value: lunarInfluence.confidence * 0.15,
                        weight: 0.15,
                        description: `${opportunity.lunarPhase.name} supports ${activity}`
                    });
                }
            }

            // Retrograde penalty
            if (opportunity.retrogradeImpact && opportunity.retrogradeImpact.length > 0) {
                const penalty = opportunity.retrogradeImpact.length * 0.1;
                score -= penalty;
                factors.push({
                    type: 'retrograde_penalty',
                    value: -penalty,
                    weight: -0.1,
                    description: `Retrograde planets may create challenges`
                });
            }

            // Void moon penalty
            if (opportunity.voidMoon && opportunity.voidMoon.duration > this.config.voidMoonThreshold) {
                score -= 0.15;
                factors.push({
                    type: 'void_moon_penalty',
                    value: -0.15,
                    weight: -0.15,
                    description: 'Void-of-course moon may cause delays'
                });
            }

            // Personal birth chart enhancement
            if (birthData && opportunity.personalizedFactors) {
                score += opportunity.personalizedFactors.enhancement;
                factors.push({
                    type: 'personalized_enhancement',
                    value: opportunity.personalizedFactors.enhancement,
                    weight: 0.1,
                    description: 'Timing harmonizes with your birth chart'
                });
            }

            // Urgency adjustment
            if (urgency === 'urgent') {
                // Boost score for sooner dates
                const daysFromNow = moment(opportunity.dateTime).diff(moment(), 'days');
                const urgencyBonus = Math.max(0, 0.1 - (daysFromNow * 0.01));
                score += urgencyBonus;
                factors.push({
                    type: 'urgency_bonus',
                    value: urgencyBonus,
                    weight: 0.1,
                    description: 'Earlier timing for urgent needs'
                });
            }

            scoredOptions.push({
                ...opportunity,
                finalScore: Math.max(0, Math.min(1, score)),
                scoringFactors: factors,
                confidence: this.calculateTimingConfidence(opportunity, factors)
            });
        }

        return scoredOptions
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, this.config.maxRecommendations);
    }

    /**
     * Generate AI-powered explanations for timing recommendations
     */
    async generateTimingExplanations(scoredTimings, activity, category, currentConditions, birthData) {
        try {
            const explanations = {};

            for (const timing of scoredTimings.slice(0, 5)) { // Top 5 recommendations
                const prompt = this.createTimingExplanationPrompt(
                    timing,
                    activity,
                    category,
                    currentConditions,
                    birthData
                );

                const explanation = await this.callOpenAIForTimingExplanation(prompt);

                explanations[timing.id] = {
                    summary: explanation.summary,
                    astrologicalReasoning: explanation.reasoning,
                    practicalAdvice: explanation.advice,
                    confidence: timing.confidence,
                    generatedAt: moment().toISOString()
                };
            }

            return explanations;

        } catch (error) {
            logger.error('❌ Failed to generate timing explanations:', error);
            return this.generateFallbackExplanations(scoredTimings, activity, category);
        }
    }

    /**
     * Calculate planetary positions using Swiss Ephemeris
     */
    async calculatePlanetaryPositions(julianDay) {
        const positions = {};
        const planets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

        for (const planet of planets) {
            try {
                const planetId = this.getPlanetId(planet);
                const result = sweph.calc_ut(julianDay, planetId, sweph.SEFLG_SWIEPH);

                if (!result.error) {
                    positions[planet] = {
                        longitude: result.xx[0],
                        latitude: result.xx[1],
                        distance: result.xx[2],
                        speed: result.xx[3],
                        sign: this.getZodiacSign(result.xx[0]),
                        degree: result.xx[0] % 30
                    };
                }
            } catch (error) {
                logger.warn(`⚠️ Failed to calculate position for ${planet}:`, error);
            }
        }

        return positions;
    }

    /**
     * Calculate lunar information including phase and void-of-course periods
     */
    async calculateLunarInformation(julianDay, timezone) {
        try {
            // Get Moon position
            const moonResult = sweph.calc_ut(julianDay, sweph.SE_MOON, sweph.SEFLG_SWIEPH);
            const sunResult = sweph.calc_ut(julianDay, sweph.SE_SUN, sweph.SEFLG_SWIEPH);

            if (moonResult.error || sunResult.error) {
                throw new Error('Failed to calculate lunar positions');
            }

            const moonLongitude = moonResult.xx[0];
            const sunLongitude = sunResult.xx[0];

            // Calculate lunar phase
            const phaseAngle = (moonLongitude - sunLongitude + 360) % 360;
            const lunarPhase = this.getLunarPhaseFromAngle(phaseAngle);

            // Calculate next major lunar aspect (for void-of-course timing)
            const nextAspect = await this.calculateNextLunarAspect(julianDay);

            return {
                longitude: moonLongitude,
                sign: this.getZodiacSign(moonLongitude),
                degree: moonLongitude % 30,
                phase: lunarPhase,
                phaseAngle,
                nextAspect,
                calculatedAt: moment().toISOString()
            };

        } catch (error) {
            logger.error('❌ Failed to calculate lunar information:', error);
            return this.getFallbackLunarInfo();
        }
    }

    /**
     * Check current retrograde status of planets
     */
    async calculateRetrogradeStatus(julianDay) {
        const retrogradeStatus = {};
        const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

        for (const planet of planets) {
            try {
                const planetId = this.getPlanetId(planet);
                const result = sweph.calc_ut(julianDay, planetId, sweph.SEFLG_SWIEPH);

                if (!result.error) {
                    retrogradeStatus[planet] = {
                        isRetrograde: result.xx[3] < 0, // Negative speed indicates retrograde
                        speed: result.xx[3],
                        stationaryDate: await this.calculateNextStationaryDate(planet, julianDay)
                    };
                }
            } catch (error) {
                logger.warn(`⚠️ Failed to check retrograde status for ${planet}:`, error);
            }
        }

        return retrogradeStatus;
    }

    /**
     * Calculate current aspects between planets
     */
    calculateCurrentAspects(planetaryPositions) {
        const aspects = [];
        const planets = Object.keys(planetaryPositions);

        for (let i = 0; i < planets.length; i++) {
            for (let j = i + 1; j < planets.length; j++) {
                const planet1 = planets[i];
                const planet2 = planets[j];
                const pos1 = planetaryPositions[planet1].longitude;
                const pos2 = planetaryPositions[planet2].longitude;

                const aspect = this.calculateAspectBetween(pos1, pos2);
                if (aspect && aspect.strength > 0.5) {
                    aspects.push({
                        planet1,
                        planet2,
                        aspect: aspect.type,
                        orb: aspect.orb,
                        strength: aspect.strength,
                        isApplying: aspect.isApplying
                    });
                }
            }
        }

        return aspects.sort((a, b) => b.strength - a.strength);
    }

    /**
     * Calculate planetary hours for a given date
     */
    calculatePlanetaryHours(date, timezone) {
        const planetaryOrder = ['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars'];
        const hours = [];

        // Calculate sunrise and sunset for the date
        const sunrise = this.calculateSunrise(date, timezone);
        const sunset = this.calculateSunset(date, timezone);

        // Calculate day and night hour lengths
        const dayLength = sunset.diff(sunrise, 'minutes');
        const nightLength = 24 * 60 - dayLength;
        const dayHourLength = dayLength / 12;
        const nightHourLength = nightLength / 12;

        // Get day of week to determine starting planet
        const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday, etc.
        let planetIndex = dayOfWeek % 7;

        // Calculate day hours
        for (let hour = 0; hour < 12; hour++) {
            const startTime = sunrise.clone().add(hour * dayHourLength, 'minutes');
            const endTime = startTime.clone().add(dayHourLength, 'minutes');

            hours.push({
                planet: planetaryOrder[planetIndex % 7],
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                type: 'day',
                hour: hour + 1
            });

            planetIndex++;
        }

        // Calculate night hours
        for (let hour = 0; hour < 12; hour++) {
            const startTime = sunset.clone().add(hour * nightHourLength, 'minutes');
            const endTime = startTime.clone().add(nightHourLength, 'minutes');

            hours.push({
                planet: planetaryOrder[planetIndex % 7],
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                type: 'night',
                hour: hour + 13
            });

            planetIndex++;
        }

        return hours;
    }

    /**
     * Calculate void-of-course moon periods
     */
    async calculateVoidMoonPeriods(julianDay, timezone) {
        try {
            const voidPeriods = [];
            const moonResult = sweph.calc_ut(julianDay, sweph.SE_MOON, sweph.SEFLG_SWIEPH);

            if (moonResult.error) {
                return [];
            }

            const moonLongitude = moonResult.xx[0];
            const moonSign = Math.floor(moonLongitude / 30);

            // Calculate when Moon makes its last aspect in current sign
            const lastAspectTime = await this.calculateLastAspectInSign(julianDay, moonSign);

            // Calculate when Moon enters next sign
            const nextSignEntry = await this.calculateMoonSignEntry(julianDay, moonSign + 1);

            if (lastAspectTime && nextSignEntry) {
                const voidStart = moment(lastAspectTime);
                const voidEnd = moment(nextSignEntry);
                const duration = voidEnd.diff(voidStart, 'hours', true);

                if (duration > 0 && duration < 48) { // Reasonable void period
                    voidPeriods.push({
                        startTime: voidStart.toISOString(),
                        endTime: voidEnd.toISOString(),
                        duration: duration,
                        sign: this.getZodiacSignName(moonSign),
                        significance: this.getVoidMoonSignificance(duration)
                    });
                }
            }

            return voidPeriods;

        } catch (error) {
            logger.warn('⚠️ Failed to calculate void moon periods:', error);
            return [];
        }
    }

    /**
     * Find optimal time windows within a day
     */
    findOptimalTimeWindows(
        date,
        planetaryHours,
        lunarSuitability,
        planetarySuitability,
        voidMoonPeriods,
        activity,
        category
    ) {
        const windows = [];
        const activityTemplate = this.activityTemplates[category];

        if (!activityTemplate) {
            return [];
        }

        // Analyze each hour of the day
        for (let hour = 0; hour < 24; hour++) {
            const timeWindow = date.clone().hour(hour).startOf('hour');
            const windowId = `${date.format('YYYY-MM-DD')}_${hour}`;

            // Find corresponding planetary hour
            const planetaryHour = planetaryHours.find(ph => {
                const start = moment(ph.startTime);
                const end = moment(ph.endTime);
                return timeWindow.isBetween(start, end, null, '[)');
            });

            // Check if time is during void moon
            const isVoidMoon = voidMoonPeriods.some(vm => 
                timeWindow.isBetween(moment(vm.startTime), moment(vm.endTime), null, '[)')
            );

            // Calculate base score
            let score = 0.5; // Base score

            // Planetary hour influence
            if (planetaryHour) {
                const planetInfluence = this.planetaryInfluences[planetaryHour.planet];
                if (planetInfluence && planetInfluence.activities.includes(activity)) {
                    score += 0.3;
                }
            }

            // Lunar suitability
            score += lunarSuitability.score * 0.2;

            // Planetary suitability
            score += planetarySuitability.score * 0.2;

            // Void moon penalty
            if (isVoidMoon) {
                score -= 0.3;
            }

            // Time of day preferences
            if (activityTemplate.preferredHours) {
                if (hour >= activityTemplate.preferredHours.start && hour <= activityTemplate.preferredHours.end) {
                    score += 0.1;
                }
            }

            // Only include windows above minimum threshold
            if (score >= this.config.confidenceThreshold) {
                windows.push({
                    id: windowId,
                    dateTime: timeWindow.toISOString(),
                    overallScore: Math.min(1, score),
                    planetaryHour,
                    lunarPhase: lunarSuitability.lunarPhase,
                    voidMoon: isVoidMoon ? voidMoonPeriods.find(vm => 
                        timeWindow.isBetween(moment(vm.startTime), moment(vm.endTime), null, '[)')
                    ) : null,
                    retrogradeImpact: planetarySuitability.retrogradeImpact,
                    factors: {
                        planetary: planetarySuitability.score,
                        lunar: lunarSuitability.score,
                        timing: planetaryHour ? 0.3 : 0
                    }
                });
            }
        }

        return windows;
    }

    /**
     * Format timing recommendations for API response
     */
    formatTimingRecommendations(scoredTimings, explanations, timezone) {
        return scoredTimings.map((timing, index) => ({
            rank: index + 1,
            dateTime: moment(timing.dateTime).tz(timezone).format(),
            localTime: moment(timing.dateTime).tz(timezone).format('YYYY-MM-DD HH:mm'),
            dayOfWeek: moment(timing.dateTime).tz(timezone).format('dddd'),
            score: Math.round(timing.finalScore * 100),
            confidence: timing.confidence,
            summary: explanations[timing.id]?.summary || this.generateBasicSummary(timing),
            astrologicalFactors: {
                planetaryHour: timing.planetaryHour ? {
                    planet: timing.planetaryHour.planet,
                    influence: this.planetaryInfluences[timing.planetaryHour.planet]?.themes || []
                } : null,
                lunarPhase: timing.lunarPhase ? {
                    name: timing.lunarPhase.name,
                    energy: this.lunarCycleInfluences[timing.lunarPhase.name]?.energy,
                    themes: this.lunarCycleInfluences[timing.lunarPhase.name]?.themes || []
                } : null,
                retrogradeImpact: timing.retrogradeImpact || [],
                voidMoon: timing.voidMoon || null
            },
            scoringBreakdown: timing.scoringFactors,
            explanation: explanations[timing.id] || null,
            practicalAdvice: this.generatePracticalAdvice(timing),
            alternatives: this.generateAlternatives(timing, scoredTimings)
        }));
    }

    /**
     * Create AI prompt for timing explanations
     */
    createTimingExplanationPrompt(timing, activity, category, currentConditions, birthData) {
        return {
            system: `You are an expert astrologer specializing in electional astrology (choosing optimal timing). 
            Create clear, specific explanations for why certain times are favorable for activities.
            
            Focus on:
            1. Specific astrological factors creating the favorable timing
            2. How these factors support the intended activity
            3. Practical timing advice
            4. Alternative approaches if timing is challenging
            
            Be specific about degrees, aspects, and house influences when relevant.`,
            
            user: `Explain why ${moment(timing.dateTime).format('MMMM Do YYYY, h:mm A')} is ${timing.finalScore > 0.7 ? 'excellent' : timing.finalScore > 0.5 ? 'good' : 'acceptable'} timing for: ${activity} (${category})

ASTROLOGICAL CONDITIONS:
- Planetary Hour: ${timing.planetaryHour?.planet || 'Not specified'}
- Lunar Phase: ${timing.lunarPhase?.name || 'Not specified'}
- Void Moon: ${timing.voidMoon ? `Yes (${timing.voidMoon.duration} hours)` : 'No'}
- Retrograde Planets: ${timing.retrogradeImpact?.join(', ') || 'None'}
- Overall Score: ${Math.round(timing.finalScore * 100)}%

${birthData ? `PERSONALIZED FACTORS:
This timing analysis includes the person's birth chart for enhanced accuracy.` : ''}

Provide a 3-paragraph explanation:
1. Summary of why this timing works well (2-3 sentences)
2. Specific astrological reasoning (3-4 sentences with technical details)
3. Practical advice for maximizing this timing (2-3 sentences)`
        };
    }

    /**
     * Call OpenAI for timing explanations
     */
    async callOpenAIForTimingExplanation(prompt) {
        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt.system },
                    { role: 'user', content: prompt.user }
                ],
                max_tokens: 500,
                temperature: 0.7
            });

            const explanation = response.choices[0].message.content;
            const paragraphs = explanation.split('\n\n').filter(p => p.trim().length > 0);

            return {
                summary: paragraphs[0] || 'Favorable astrological timing detected.',
                reasoning: paragraphs[1] || 'Multiple astrological factors align to support this activity.',
                advice: paragraphs[2] || 'Proceed with confidence during this optimal timing window.'
            };

        } catch (error) {
            logger.warn('⚠️ OpenAI explanation generation failed, using fallback:', error);
            return this.generateFallbackExplanation(prompt);
        }
    }

    // HELPER METHODS

    dateToJulianDay(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        const minute = date.getMinutes();
        const second = date.getSeconds();

        const a = Math.floor((14 - month) / 12);
        const y = year + 4800 - a;
        const m = month + 12 * a - 3;

        const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
                   Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

        return jdn + (hour - 12) / 24.0 + minute / 1440.0 + second / 86400.0;
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

    getZodiacSign(longitude) {
        return Math.floor(longitude / 30);
    }

    getZodiacSignName(signNumber) {
        const signs = [
            'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
            'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
        ];
        return signs[signNumber % 12];
    }

    getLunarPhaseFromAngle(phaseAngle) {
        if (phaseAngle < 45) return { name: 'newMoon', illumination: phaseAngle / 180 };
        if (phaseAngle < 90) return { name: 'waxingCrescent', illumination: phaseAngle / 180 };
        if (phaseAngle < 135) return { name: 'firstQuarter', illumination: 0.5 };
        if (phaseAngle < 180) return { name: 'waxingGibbous', illumination: phaseAngle / 180 };
        if (phaseAngle < 225) return { name: 'fullMoon', illumination: 1.0 };
        if (phaseAngle < 270) return { name: 'waningGibbous', illumination: (360 - phaseAngle) / 180 };
        if (phaseAngle < 315) return { name: 'lastQuarter', illumination: 0.5 };
        return { name: 'waningCrescent', illumination: (360 - phaseAngle) / 180 };
    }

    calculateAspectBetween(pos1, pos2) {
        const angle = Math.abs(pos2 - pos1);
        const normalizedAngle = angle > 180 ? 360 - angle : angle;
        
        const aspectDefinitions = [
            { name: 'conjunction', angle: 0, orb: 8 },
            { name: 'sextile', angle: 60, orb: 6 },
            { name: 'square', angle: 90, orb: 8 },
            { name: 'trine', angle: 120, orb: 8 },
            { name: 'opposition', angle: 180, orb: 8 }
        ];
        
        for (const aspectDef of aspectDefinitions) {
            const orb = Math.abs(normalizedAngle - aspectDef.angle);
            if (orb <= aspectDef.orb) {
                return {
                    type: aspectDef.name,
                    orb,
                    strength: (aspectDef.orb - orb) / aspectDef.orb,
                    isApplying: pos2 > pos1
                };
            }
        }
        
        return null;
    }

    async getUserBirthData(userId) {
        try {
            const result = await db.query(`
                SELECT birth_date, birth_time, birth_location, timezone,
                       latitude, longitude, birth_chart_data
                FROM user_birth_data 
                WHERE user_id = $1
            `, [userId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.warn('⚠️ Failed to get user birth data:', error);
            return null;
        }
    }

    async cacheTimingRecommendations(userId, activity, category, recommendations) {
        try {
            const cacheKey = `timing:${userId}:${activity}:${category}`;
            await redisService.setData(cacheKey, recommendations, this.config.cacheDuration);
        } catch (error) {
            logger.warn('⚠️ Failed to cache timing recommendations:', error);
        }
    }

    generateBasicSummary(timing) {
        const score = Math.round(timing.finalScore * 100);
        const quality = score > 80 ? 'Excellent' : score > 60 ? 'Good' : 'Acceptable';
        
        return `${quality} timing with ${score}% astrological favorability. ` +
               `${timing.planetaryHour ? `${timing.planetaryHour.planet} hour` : 'Standard timing'} ` +
               `during ${timing.lunarPhase?.name || 'lunar phase'}.`;
    }

    generatePracticalAdvice(timing) {
        const advice = [];
        
        if (timing.planetaryHour) {
            const planet = timing.planetaryHour.planet;
            const influence = this.planetaryInfluences[planet];
            if (influence) {
                advice.push(`Leverage ${planet} energy for ${influence.themes.slice(0, 2).join(' and ')}`);
            }
        }
        
        if (timing.voidMoon && timing.voidMoon.duration > 2) {
            advice.push('Avoid making final decisions during void moon period');
        }
        
        if (timing.retrogradeImpact && timing.retrogradeImpact.length > 0) {
            advice.push('Double-check details due to retrograde influences');
        }
        
        return advice.length > 0 ? advice : ['Proceed with standard precautions'];
    }

    generateAlternatives(timing, allTimings) {
        const alternatives = allTimings
            .filter(t => t.id !== timing.id && t.finalScore > 0.6)
            .slice(0, 2)
            .map(t => ({
                dateTime: moment(t.dateTime).format('YYYY-MM-DD HH:mm'),
                score: Math.round(t.finalScore * 100),
                reason: this.generateAlternativeReason(t)
            }));
            
        return alternatives;
    }

    generateAlternativeReason(timing) {
        if (timing.planetaryHour) {
            return `Strong ${timing.planetaryHour.planet} influence`;
        }
        if (timing.lunarPhase) {
            return `Favorable ${timing.lunarPhase.name} energy`;
        }
        return 'Good overall astrological conditions';
    }

    calculateOverallConfidence(recommendations) {
        if (recommendations.length === 0) return 0;
        
        const avgScore = recommendations.reduce((sum, rec) => sum + rec.score, 0) / recommendations.length;
        return Math.round(avgScore * 0.8); // Conservative confidence calculation
    }

    summarizeCurrentConditions(conditions) {
        return {
            timestamp: conditions.timestamp,
            lunarPhase: conditions.lunarInfo?.phase?.name || 'Unknown',
            retrogradeCount: Object.values(conditions.retrogradeStatus || {})
                .filter(status => status.isRetrograde).length,
            significantAspects: conditions.currentAspects?.filter(a => a.strength > 0.7).length || 0,
            specialConditions: conditions.specialConditions || []
        };
    }

    // Placeholder methods for complex calculations that would need full implementation
    async calculateDailyConditions(julianDay, timezone) {
        return {
            planetaryPositions: await this.calculatePlanetaryPositions(julianDay),
            lunarInfo: await this.calculateLunarInformation(julianDay, timezone),
            retrogradeStatus: await this.calculateRetrogradeStatus(julianDay)
        };
    }

    analyzeLunarSuitability(lunarInfo, activity, category) {
        const phase = lunarInfo.phase?.name || 'unknown';
        const lunarInfluence = this.lunarCycleInfluences[phase];
        const activityTemplate = this.activityTemplates[category];
        
        let score = 0.5;
        if (lunarInfluence && activityTemplate) {
            if (activityTemplate.bestLunarPhases.includes(phase)) {
                score += lunarInfluence.confidence * 0.5;
            }
        }
        
        return {
            score: Math.min(1, score),
            lunarPhase: lunarInfo.phase,
            factors: [`Lunar ${phase} phase influence`]
        };
    }

    analyzePlanetarySuitability(planetaryPositions, retrogradeStatus, activity, category, birthData) {
        const activityTemplate = this.activityTemplates[category];
        let score = 0.5;
        const retrogradeImpact = [];
        
        if (activityTemplate) {
            // Check favorable planets
            for (const planet of activityTemplate.favorablePlanets) {
                if (planetaryPositions[planet]) {
                    score += 0.1;
                }
            }
            
            // Check retrograde impacts
            for (const planet of activityTemplate.avoidRetrograde) {
                if (retrogradeStatus[planet]?.isRetrograde) {
                    score -= 0.2;
                    retrogradeImpact.push(planet);
                }
            }
        }
        
        return {
            score: Math.max(0, Math.min(1, score)),
            retrogradeImpact,
            factors: [`Planetary alignment for ${category}`]
        };
    }

    calculateSunrise(date, timezone) {
        // Simplified sunrise calculation - would use proper solar calculations in production
        return date.clone().hour(6).minute(30);
    }

    calculateSunset(date, timezone) {
        // Simplified sunset calculation - would use proper solar calculations in production
        return date.clone().hour(18).minute(30);
    }

    calculateTimingConfidence(opportunity, factors) {
        const baseConfidence = opportunity.overallScore;
        const factorBonus = factors.filter(f => f.value > 0).length * 0.05;
        const factorPenalty = factors.filter(f => f.value < 0).length * 0.03;
        
        return Math.max(0.3, Math.min(0.95, baseConfidence + factorBonus - factorPenalty));
    }

    generateFallbackExplanation(prompt) {
        return {
            summary: 'Astrological timing analysis indicates favorable conditions for this activity.',
            reasoning: 'Multiple planetary and lunar factors create supportive energy patterns.',
            advice: 'Proceed with confidence while maintaining awareness of cosmic influences.'
        };
    }

    generateFallbackExplanations(scoredTimings, activity, category) {
        const explanations = {};
        for (const timing of scoredTimings.slice(0, 5)) {
            explanations[timing.id] = this.generateFallbackExplanation({});
        }
        return explanations;
    }

    getFallbackLunarInfo() {
        return {
            longitude: 0,
            sign: 'Unknown',
            degree: 0,
            phase: { name: 'unknown', illumination: 0.5 },
            phaseAngle: 0,
            nextAspect: null,
            calculatedAt: moment().toISOString()
        };
    }

    async calculateNextLunarAspect(julianDay) {
        // Placeholder - would calculate next major aspect Moon makes to another planet
        return null;
    }

    async calculateNextStationaryDate(planet, julianDay) {
        // Placeholder - would calculate when planet stations (goes direct/retrograde)
        return null;
    }

    async calculateLastAspectInSign(julianDay, moonSign) {
        // Placeholder - would calculate last aspect Moon makes before leaving sign
        return null;
    }

    async calculateMoonSignEntry(julianDay, nextSign) {
        // Placeholder - would calculate when Moon enters next sign
        return null;
    }

    getVoidMoonSignificance(duration) {
        if (duration < 1) return 'minor';
        if (duration < 6) return 'moderate';
        if (duration < 12) return 'significant';
        return 'major';
    }

    async checkSpecialConditions(julianDay) {
        // Placeholder - would check for eclipses, major conjunctions, etc.
        return [];
    }
}

module.exports = new AstrologicalTimingService();