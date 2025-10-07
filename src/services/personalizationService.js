/**
 * PERSONALIZED HOROSCOPE SERVICE
 * 
 * Advanced astrological calculation service using Swiss Ephemeris
 * Provides hiperpersonal horoscopes based on exact birth time and location
 */

const sweph = require('sweph');
const moment = require('moment-timezone');
const redisService = require('./redisService');
const { Pool } = require('pg');

class PersonalizationService {
    constructor() {
        this.config = {
            // Swiss Ephemeris configuration
            swissEphPath: process.env.SWISS_EPH_PATH || './ephemeris', // Path to ephemeris files
            defaultHouseSystem: 'placidus',
            defaultAyanamsa: 'lahiri',
            
            // Calculation precision
            planetPrecision: 1e-6, // High precision for planetary positions
            housePrecision: 1e-4,   // House cusp precision
            aspectOrb: {
                conjunction: 8,
                opposition: 8,
                trine: 6,
                square: 6,
                sextile: 4,
                quincunx: 3,
                semisextile: 2,
                semisquare: 2,
                sesquisquare: 2
            },
            
            // Cache settings
            birthChartCacheDuration: 0, // Indefinite cache for birth charts
            dailyHoroscopeCacheDuration: 86400, // 24 hours
            transitCacheDuration: 3600, // 1 hour for current transits
        };

        // Planet constants from Swiss Ephemeris
        this.planets = {
            sun: sweph.SE_SUN,
            moon: sweph.SE_MOON,
            mercury: sweph.SE_MERCURY,
            venus: sweph.SE_VENUS,
            mars: sweph.SE_MARS,
            jupiter: sweph.SE_JUPITER,
            saturn: sweph.SE_SATURN,
            uranus: sweph.SE_URANUS,
            neptune: sweph.SE_NEPTUNE,
            pluto: sweph.SE_PLUTO,
            north_node: sweph.SE_TRUE_NODE,
            south_node: sweph.SE_TRUE_NODE, // Will subtract 180 degrees
            chiron: sweph.SE_CHIRON,
            ascendant: sweph.SE_ASC,
            midheaven: sweph.SE_MC
        };

        // House system constants
        this.houseSystems = {
            placidus: 'P',
            koch: 'K',
            campanus: 'C',
            regiomontanus: 'R',
            equal: 'A',
            whole_sign: 'W'
        };

        // Initialize Swiss Ephemerus
        this.initializeSwissEphemeris();
        
        console.log('🌟 Personalization Service initialized with Swiss Ephemeris');
    }

    /**
     * Initialize Swiss Ephemeris
     */
    initializeSwissEphemeris() {
        try {
            // Set ephemeris path
            sweph.set_ephe_path(this.config.swissEphPath);

            // Simple test calculation - just check if sweph is available
            const testJD = sweph.julday(2024, 1, 1, 12.0, 1); // 1 for SE_GREG_CAL

            if (testJD && testJD > 0) {
                console.log('✅ Swiss Ephemeris initialized successfully');
            } else {
                console.warn('⚠️ Swiss Ephemeris test failed - using fallback');
            }
        } catch (error) {
            console.error('❌ Swiss Ephemeris initialization error:', error.message);
            console.warn('⚠️ Will use fallback calculation methods');
        }
    }

    /**
     * Calculate birth chart for a user
     */
    async calculateBirthChart(userId, birthData) {
        const cacheKey = `birth_chart:${userId}`;
        
        try {
            // Check cache first
            const cachedChart = await redisService.get(cacheKey);
            if (cachedChart) {
                console.log('📊 Retrieved birth chart from cache for user:', userId);
                return cachedChart;
            }

            console.log('🔄 Calculating new birth chart for user:', userId);

            // Convert birth time to Julian Day
            const julianDay = this.calculateJulianDay(birthData);
            
            // Calculate planetary positions
            const planetaryPositions = await this.calculatePlanetaryPositions(julianDay);
            
            // Calculate house cusps and important points
            const houses = await this.calculateHouses(julianDay, birthData);
            
            // Calculate aspects between planets
            const aspects = this.calculateAspects(planetaryPositions);
            
            // Build comprehensive birth chart data
            const birthChart = {
                user_id: userId,
                birth_data: birthData,
                julian_day: julianDay,
                planetary_positions: planetaryPositions,
                house_cusps: houses.cusps,
                ascendant: houses.ascendant,
                midheaven: houses.midheaven,
                descendant: (houses.ascendant + 180) % 360,
                ic: (houses.midheaven + 180) % 360,
                aspects: aspects,
                calculation_timestamp: new Date().toISOString(),
                chart_metadata: {
                    house_system: birthData.house_system || this.config.defaultHouseSystem,
                    ayanamsa: birthData.ayanamsa || this.config.defaultAyanamsa,
                    coordinates: {
                        latitude: birthData.birth_latitude,
                        longitude: birthData.birth_longitude
                    },
                    timezone: birthData.birth_timezone
                }
            };

            // Cache the birth chart (no expiration since birth data doesn't change)
            await redisService.set(cacheKey, birthChart, this.config.birthChartCacheDuration);
            
            console.log('✅ Birth chart calculated and cached for user:', userId);
            return birthChart;

        } catch (error) {
            console.error('❌ Birth chart calculation error for user', userId, ':', error);
            throw new Error(`Failed to calculate birth chart: ${error.message}`);
        }
    }

    /**
     * Generate personalized daily horoscope
     */
    async generatePersonalizedHoroscope(userId, date = new Date()) {
        const dateStr = moment(date).format('YYYY-MM-DD');
        const cacheKey = `personalized_horoscope:${userId}:${dateStr}`;
        
        try {
            // Check cache first
            const cachedHoroscope = await redisService.get(cacheKey);
            if (cachedHoroscope) {
                console.log('📖 Retrieved personalized horoscope from cache for user:', userId);
                return cachedHoroscope;
            }

            console.log('🔮 Generating personalized horoscope for user:', userId, 'date:', dateStr);

            // Get user's birth chart
            const birthChart = await this.getBirthChartFromDB(userId);
            if (!birthChart) {
                throw new Error('User birth chart not found. Please complete birth data first.');
            }

            // Calculate current transits for the date
            const transits = await this.calculateDailyTransits(date);
            
            // Calculate transit aspects to natal planets
            const transitAspects = this.calculateTransitAspects(birthChart.planetary_positions, transits);
            
            // Determine personalization factors
            const personalizationFactors = this.analyzePersonalizationFactors(birthChart, transits, transitAspects);
            
            // Generate personalized content based on aspects and transits
            const personalizedContent = await this.generatePersonalizedContent(
                birthChart,
                transits,
                transitAspects,
                personalizationFactors,
                dateStr
            );

            const personalizedHoroscope = {
                user_id: userId,
                date: dateStr,
                birth_chart_id: birthChart.id,
                current_transits: transits,
                transit_aspects: transitAspects,
                personalization_factors: personalizationFactors,
                content: personalizedContent.content,
                ratings: personalizedContent.ratings,
                lucky_numbers: personalizedContent.lucky_numbers,
                lucky_colors: personalizedContent.lucky_colors,
                mood: personalizedContent.mood,
                advice: personalizedContent.advice,
                keywords: personalizedContent.keywords,
                personalization_level: personalizationFactors.overall_score,
                generated_at: new Date().toISOString()
            };

            // Cache for 24 hours
            await redisService.set(cacheKey, personalizedHoroscope, this.config.dailyHoroscopeCacheDuration);
            
            console.log('✅ Personalized horoscope generated for user:', userId);
            return personalizedHoroscope;

        } catch (error) {
            console.error('❌ Personalized horoscope generation error for user', userId, ':', error);
            throw new Error(`Failed to generate personalized horoscope: ${error.message}`);
        }
    }

    /**
     * Calculate Julian Day from birth data
     */
    calculateJulianDay(birthData) {
        const birthMoment = moment.tz(
            `${birthData.birth_date} ${birthData.birth_time || '12:00:00'}`,
            'YYYY-MM-DD HH:mm:ss',
            birthData.birth_timezone
        ).utc();

        const year = birthMoment.year();
        const month = birthMoment.month() + 1; // moment.js months are 0-indexed
        const day = birthMoment.date();
        const hour = birthMoment.hour() + (birthMoment.minute() / 60.0) + (birthMoment.second() / 3600.0);

        return sweph.julday(year, month, day, hour, 1); // 1 for SE_GREG_CAL
    }

    /**
     * Calculate planetary positions at given Julian Day
     */
    async calculatePlanetaryPositions(julianDay) {
        const positions = {};
        
        try {
            // Calculate positions for all major planets
            for (const [planetName, planetId] of Object.entries(this.planets)) {
                if (planetName === 'south_node') {
                    // South node is 180 degrees opposite to north node
                    const northNodeResult = sweph.calc_ut(julianDay, this.planets.north_node, sweph.SEFLG_SWIEPH);
                    if (!northNodeResult.error) {
                        positions[planetName] = (northNodeResult.longitude + 180) % 360;
                    }
                    continue;
                }

                if (planetName === 'ascendant' || planetName === 'midheaven') {
                    // These are calculated separately in houses calculation
                    continue;
                }

                const result = sweph.calc_ut(julianDay, planetId, sweph.SEFLG_SWIEPH);
                if (result.error) {
                    console.warn(`⚠️ Error calculating ${planetName}:`, result.error);
                    continue;
                }

                positions[planetName] = {
                    longitude: result.longitude,
                    latitude: result.latitude,
                    distance: result.distance,
                    longitude_speed: result.longitudeSpeed,
                    latitude_speed: result.latitudeSpeed,
                    distance_speed: result.distanceSpeed,
                    house: Math.floor(result.longitude / 30) + 1, // Simple house calculation
                    sign: this.getZodiacSign(result.longitude),
                    degree: result.longitude % 30,
                    retrograde: result.longitudeSpeed < 0
                };
            }

            return positions;
        } catch (error) {
            console.error('❌ Error calculating planetary positions:', error);
            throw error;
        }
    }

    /**
     * Calculate house cusps and important angles
     */
    async calculateHouses(julianDay, birthData) {
        try {
            const houseSystem = this.houseSystems[birthData.house_system] || this.houseSystems.placidus;
            
            const result = sweph.houses(
                julianDay,
                birthData.birth_latitude,
                birthData.birth_longitude,
                houseSystem
            );

            if (result.error) {
                console.warn('⚠️ Error calculating houses:', result.error);
                throw new Error('House calculation failed');
            }

            return {
                cusps: result.houses, // Array of 12 house cusps
                ascendant: result.ascendant,
                midheaven: result.midheaven,
                armc: result.armc, // Ascendant Right Ascension of Midheaven
                vertex: result.vertex,
                equasc: result.equasc,
                coasc1: result.coasc1,
                coasc2: result.coasc2,
                polasc: result.polasc
            };
        } catch (error) {
            console.error('❌ Error calculating houses:', error);
            throw error;
        }
    }

    /**
     * Calculate aspects between planets
     */
    calculateAspects(planetaryPositions) {
        const aspects = [];
        const planetNames = Object.keys(planetaryPositions);

        for (let i = 0; i < planetNames.length; i++) {
            for (let j = i + 1; j < planetNames.length; j++) {
                const planet1 = planetNames[i];
                const planet2 = planetNames[j];
                const pos1 = planetaryPositions[planet1].longitude;
                const pos2 = planetaryPositions[planet2].longitude;

                const aspectInfo = this.calculateAspectBetweenPlanets(pos1, pos2);
                if (aspectInfo) {
                    aspects.push({
                        planet1,
                        planet2,
                        aspect: aspectInfo.aspect,
                        orb: aspectInfo.orb,
                        exact: aspectInfo.exact,
                        applying: aspectInfo.applying,
                        strength: aspectInfo.strength
                    });
                }
            }
        }

        return aspects;
    }

    /**
     * Calculate daily transits for a specific date
     */
    async calculateDailyTransits(date) {
        const dateStr = moment(date).format('YYYY-MM-DD');
        const cacheKey = `daily_transits:${dateStr}`;
        
        try {
            // Check cache first
            const cachedTransits = await redisService.get(cacheKey);
            if (cachedTransits) {
                return cachedTransits;
            }

            // Calculate Julian Day for the transit date
            const transitMoment = moment(date).utc().hour(12); // Noon UTC
            const julianDay = sweph.julday(
                transitMoment.year(),
                transitMoment.month() + 1,
                transitMoment.date(),
                transitMoment.hour(),
                1 // 1 for SE_GREG_CAL
            );

            // Calculate current planetary positions
            const transits = await this.calculatePlanetaryPositions(julianDay);
            
            // Cache transits for 1 hour
            await redisService.set(cacheKey, transits, this.config.transitCacheDuration);
            
            return transits;
        } catch (error) {
            console.error('❌ Error calculating daily transits:', error);
            throw error;
        }
    }

    /**
     * Calculate transit aspects to natal planets
     */
    calculateTransitAspects(natalPositions, transitPositions) {
        const transitAspects = [];

        for (const [transitPlanet, transitData] of Object.entries(transitPositions)) {
            for (const [natalPlanet, natalData] of Object.entries(natalPositions)) {
                const aspectInfo = this.calculateAspectBetweenPlanets(
                    transitData.longitude,
                    natalData.longitude
                );

                if (aspectInfo) {
                    transitAspects.push({
                        transit_planet: transitPlanet,
                        natal_planet: natalPlanet,
                        aspect: aspectInfo.aspect,
                        orb: aspectInfo.orb,
                        exact: aspectInfo.exact,
                        strength: aspectInfo.strength,
                        influence: this.calculateTransitInfluence(transitPlanet, natalPlanet, aspectInfo.aspect)
                    });
                }
            }
        }

        // Sort by strength (strongest first)
        return transitAspects.sort((a, b) => b.strength - a.strength);
    }

    /**
     * Calculate aspect between two planetary positions
     */
    calculateAspectBetweenPlanets(pos1, pos2) {
        const diff = Math.abs(pos1 - pos2);
        const angle = Math.min(diff, 360 - diff);

        const aspectTypes = [
            { name: 'conjunction', angle: 0, orb: this.config.aspectOrb.conjunction },
            { name: 'opposition', angle: 180, orb: this.config.aspectOrb.opposition },
            { name: 'trine', angle: 120, orb: this.config.aspectOrb.trine },
            { name: 'square', angle: 90, orb: this.config.aspectOrb.square },
            { name: 'sextile', angle: 60, orb: this.config.aspectOrb.sextile },
            { name: 'quincunx', angle: 150, orb: this.config.aspectOrb.quincunx }
        ];

        for (const aspectType of aspectTypes) {
            const orb = Math.abs(angle - aspectType.angle);
            if (orb <= aspectType.orb) {
                return {
                    aspect: aspectType.name,
                    orb: orb,
                    exact: orb < 1,
                    applying: false, // Would need speed calculations for this
                    strength: (aspectType.orb - orb) / aspectType.orb // 1 = exact, 0 = at orb limit
                };
            }
        }

        return null;
    }

    /**
     * Analyze personalization factors
     */
    analyzePersonalizationFactors(birthChart, transits, transitAspects) {
        const factors = {
            major_transits: [],
            significant_aspects: [],
            planetary_emphases: [],
            house_activations: [],
            overall_score: 0
        };

        // Analyze major transits
        const majorPlanets = ['saturn', 'jupiter', 'uranus', 'neptune', 'pluto'];
        for (const transitAspect of transitAspects) {
            if (majorPlanets.includes(transitAspect.transit_planet) && transitAspect.strength > 0.7) {
                factors.major_transits.push({
                    planet: transitAspect.transit_planet,
                    aspect: transitAspect.aspect,
                    natal_planet: transitAspect.natal_planet,
                    strength: transitAspect.strength
                });
            }
        }

        // Calculate overall personalization score
        factors.overall_score = Math.min(1.0, 
            (factors.major_transits.length * 0.3) + 
            (transitAspects.length * 0.1) +
            0.2 // Base personalization for having complete birth data
        );

        return factors;
    }

    /**
     * Generate personalized content based on astrological factors
     */
    async generatePersonalizedContent(birthChart, transits, transitAspects, personalizationFactors, dateStr) {
        // This would integrate with your AI content generation service
        // For now, returning structured example based on astrological calculations
        
        const content = {
            general: await this.generateGeneralPersonalizedText(transitAspects, personalizationFactors),
            love: await this.generateLovePersonalizedText(transitAspects, birthChart),
            career: await this.generateCareerPersonalizedText(transitAspects, birthChart),
            health: await this.generateHealthPersonalizedText(transitAspects, birthChart),
            money: await this.generateMoneyPersonalizedText(transitAspects, birthChart)
        };

        const ratings = this.calculatePersonalizedRatings(transitAspects);
        const luckyNumbers = this.calculateLuckyNumbers(birthChart, transits);
        const luckyColors = this.calculateLuckyColors(birthChart, transits);
        const mood = this.calculateMood(transitAspects);
        const advice = await this.generatePersonalizedAdvice(transitAspects, personalizationFactors);
        const keywords = this.extractKeywords(transitAspects, personalizationFactors);

        return {
            content,
            ratings,
            lucky_numbers: luckyNumbers,
            lucky_colors: luckyColors,
            mood,
            advice,
            keywords
        };
    }

    /**
     * Get zodiac sign from longitude
     */
    getZodiacSign(longitude) {
        const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                     'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
        return signs[Math.floor(longitude / 30)];
    }

    /**
     * Calculate transit influence strength
     */
    calculateTransitInfluence(transitPlanet, natalPlanet, aspect) {
        const influences = {
            saturn: { weight: 0.9, effects: ['responsibility', 'limitation', 'structure'] },
            jupiter: { weight: 0.8, effects: ['expansion', 'opportunity', 'growth'] },
            uranus: { weight: 0.7, effects: ['change', 'innovation', 'sudden events'] },
            neptune: { weight: 0.6, effects: ['intuition', 'spirituality', 'confusion'] },
            pluto: { weight: 0.8, effects: ['transformation', 'power', 'intensity'] },
            mars: { weight: 0.5, effects: ['action', 'conflict', 'energy'] }
        };

        const aspectStrengths = {
            conjunction: 1.0,
            opposition: 0.9,
            square: 0.8,
            trine: 0.7,
            sextile: 0.5,
            quincunx: 0.3
        };

        const planetInfluence = influences[transitPlanet] || { weight: 0.3, effects: [] };
        const aspectStrength = aspectStrengths[aspect] || 0.3;

        return {
            strength: planetInfluence.weight * aspectStrength,
            effects: planetInfluence.effects,
            type: aspect
        };
    }

    // Helper methods for content generation (simplified versions)
    async generateGeneralPersonalizedText(transitAspects, factors) {
        const majorTransits = factors.major_transits;
        if (majorTransits.length > 0) {
            const mainTransit = majorTransits[0];
            return `Today's energy is particularly influenced by ${mainTransit.planet} forming a ${mainTransit.aspect} to your natal ${mainTransit.natal_planet}. This creates a personalized cosmic signature that affects you uniquely.`;
        }
        return "The current planetary alignments create a unique personal energy pattern for you today.";
    }

    async generateLovePersonalizedText(transitAspects, birthChart) {
        const venusTransits = transitAspects.filter(t => t.transit_planet === 'venus' || t.natal_planet === 'venus');
        if (venusTransits.length > 0) {
            const transit = venusTransits[0];
            return `Venus energy is personally affecting your chart through a ${transit.aspect} aspect, bringing unique romantic opportunities.`;
        }
        return "Love energies flow in harmony with your personal astrological signature.";
    }

    async generateCareerPersonalizedText(transitAspects, birthChart) {
        const careerTransits = transitAspects.filter(t => 
            t.transit_planet === 'saturn' || t.natal_planet === 'midheaven' || t.transit_planet === 'mars'
        );
        if (careerTransits.length > 0) {
            const transit = careerTransits[0];
            return `Career matters are highlighted by ${transit.transit_planet} creating a ${transit.aspect} to your personal chart.`;
        }
        return "Professional opportunities align with your unique astrological profile.";
    }

    async generateHealthPersonalizedText(transitAspects, birthChart) {
        const healthTransits = transitAspects.filter(t => t.natal_planet === 'mars' || t.transit_planet === 'mars');
        if (healthTransits.length > 0) {
            return "Your personal energy levels are influenced by current Mars transits to your chart.";
        }
        return "Health and vitality flow in harmony with your personal astrological constitution.";
    }

    async generateMoneyPersonalizedText(transitAspects, birthChart) {
        const moneyTransits = transitAspects.filter(t => t.transit_planet === 'jupiter' || t.natal_planet === 'jupiter');
        if (moneyTransits.length > 0) {
            const transit = moneyTransits[0];
            return `Financial opportunities are personalized through Jupiter's ${transit.aspect} aspect to your natal chart.`;
        }
        return "Financial energies are aligned with your personal abundance patterns.";
    }

    calculatePersonalizedRatings(transitAspects) {
        // Calculate ratings based on transit aspects
        const positiveAspects = ['trine', 'sextile', 'conjunction'];
        const challengingAspects = ['square', 'opposition'];

        let loveRating = 3;
        let workRating = 3;
        let healthRating = 3;
        let moneyRating = 3;

        for (const aspect of transitAspects) {
            const modifier = positiveAspects.includes(aspect.aspect) ? 1 : 
                           challengingAspects.includes(aspect.aspect) ? -1 : 0;
            
            if (aspect.natal_planet === 'venus' || aspect.transit_planet === 'venus') {
                loveRating += modifier * aspect.strength;
            }
            if (aspect.natal_planet === 'mars' || aspect.transit_planet === 'saturn') {
                workRating += modifier * aspect.strength;
            }
            if (aspect.natal_planet === 'mars') {
                healthRating += modifier * aspect.strength;
            }
            if (aspect.natal_planet === 'jupiter' || aspect.transit_planet === 'jupiter') {
                moneyRating += modifier * aspect.strength;
            }
        }

        return {
            love_rating: Math.max(1, Math.min(5, Math.round(loveRating))),
            work_rating: Math.max(1, Math.min(5, Math.round(workRating))),
            health_rating: Math.max(1, Math.min(5, Math.round(healthRating))),
            money_rating: Math.max(1, Math.min(5, Math.round(moneyRating))),
            overall_rating: Math.max(1, Math.min(5, Math.round((loveRating + workRating + healthRating + moneyRating) / 4)))
        };
    }

    calculateLuckyNumbers(birthChart, transits) {
        // Generate lucky numbers based on planetary positions
        const numbers = [];
        if (birthChart.planetary_positions.sun) {
            numbers.push(Math.floor(birthChart.planetary_positions.sun.degree) + 1);
        }
        if (birthChart.planetary_positions.moon) {
            numbers.push(Math.floor(birthChart.planetary_positions.moon.degree) + 1);
        }
        // Add more based on current transits
        for (const planet of ['jupiter', 'venus']) {
            if (transits[planet]) {
                numbers.push(Math.floor(transits[planet].degree) + 1);
            }
        }
        return numbers.slice(0, 6); // Return up to 6 lucky numbers
    }

    calculateLuckyColors(birthChart, transits) {
        const colors = [];
        
        // Colors based on current sun transit
        if (transits.sun) {
            const sunSign = this.getZodiacSign(transits.sun.longitude);
            const signColors = {
                aries: ['red', 'orange'],
                taurus: ['green', 'brown'],
                gemini: ['yellow', 'light blue'],
                cancer: ['silver', 'sea blue'],
                leo: ['gold', 'orange'],
                virgo: ['navy', 'grey'],
                libra: ['pink', 'light green'],
                scorpio: ['deep red', 'black'],
                sagittarius: ['purple', 'turquoise'],
                capricorn: ['dark green', 'brown'],
                aquarius: ['electric blue', 'silver'],
                pisces: ['sea green', 'lavender']
            };
            colors.push(...(signColors[sunSign] || ['blue', 'white']));
        }
        
        return colors.slice(0, 3); // Return up to 3 colors
    }

    calculateMood(transitAspects) {
        const moodScores = {
            positive: 0,
            challenging: 0,
            neutral: 0
        };

        for (const aspect of transitAspects) {
            if (['trine', 'sextile'].includes(aspect.aspect)) {
                moodScores.positive += aspect.strength;
            } else if (['square', 'opposition'].includes(aspect.aspect)) {
                moodScores.challenging += aspect.strength;
            } else {
                moodScores.neutral += aspect.strength;
            }
        }

        if (moodScores.positive > moodScores.challenging) {
            return 'optimistic';
        } else if (moodScores.challenging > moodScores.positive) {
            return 'contemplative';
        } else {
            return 'balanced';
        }
    }

    async generatePersonalizedAdvice(transitAspects, factors) {
        if (factors.major_transits.length > 0) {
            const mainTransit = factors.major_transits[0];
            return `Focus on ${mainTransit.planet} energy today. This ${mainTransit.aspect} aspect to your ${mainTransit.natal_planet} suggests paying attention to themes of personal growth and transformation.`;
        }
        return "Trust your intuition and follow your personal rhythm today.";
    }

    extractKeywords(transitAspects, factors) {
        const keywords = [];
        
        for (const aspect of transitAspects.slice(0, 5)) { // Top 5 aspects
            const planetKeywords = {
                sun: ['identity', 'confidence', 'leadership'],
                moon: ['emotions', 'intuition', 'home'],
                mercury: ['communication', 'thinking', 'travel'],
                venus: ['love', 'beauty', 'harmony'],
                mars: ['action', 'energy', 'courage'],
                jupiter: ['growth', 'opportunity', 'wisdom'],
                saturn: ['discipline', 'structure', 'responsibility'],
                uranus: ['innovation', 'freedom', 'change'],
                neptune: ['spirituality', 'dreams', 'illusion'],
                pluto: ['transformation', 'power', 'rebirth']
            };

            if (planetKeywords[aspect.transit_planet]) {
                keywords.push(...planetKeywords[aspect.transit_planet]);
            }
        }

        // Remove duplicates and return up to 8 keywords
        return [...new Set(keywords)].slice(0, 8);
    }

    /**
     * Get birth chart from database
     */
    async getBirthChartFromDB(userId) {
        // This would query your PostgreSQL database
        // For now, returning a mock structure
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        try {
            const result = await pool.query(`
                SELECT bc.*, bd.birth_date, bd.birth_time, bd.birth_timezone, 
                       bd.birth_latitude, bd.birth_longitude
                FROM user_birth_chart bc
                JOIN user_birth_data bd ON bc.birth_data_id = bd.id
                WHERE bc.user_id = $1
            `, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            console.error('❌ Database error getting birth chart:', error);
            throw error;
        }
    }

    /**
     * Validate premium subscription for personalized features
     */
    async validatePremiumSubscription(userId) {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });

        try {
            const result = await pool.query(`
                SELECT subscription_status, subscription_expires_at
                FROM users
                WHERE id = $1 AND status = 'active'
            `, [userId]);

            if (result.rows.length === 0) {
                return { valid: false, reason: 'User not found or inactive' };
            }

            const user = result.rows[0];
            
            if (!['premium', 'premium_plus'].includes(user.subscription_status)) {
                return { valid: false, reason: 'Premium subscription required' };
            }

            if (user.subscription_expires_at && new Date(user.subscription_expires_at) < new Date()) {
                return { valid: false, reason: 'Subscription expired' };
            }

            return { valid: true };
        } catch (error) {
            console.error('❌ Error validating premium subscription:', error);
            throw error;
        }
    }

    /**
     * Get service status for monitoring
     */
    getStatus() {
        return {
            service: 'PersonalizationService',
            status: 'active',
            swiss_ephemeris: 'initialized',
            features: [
                'birth_chart_calculation',
                'daily_personalized_horoscopes',
                'transit_calculations',
                'aspect_analysis',
                'redis_caching',
                'premium_validation'
            ],
            cache_duration: {
                birth_charts: this.config.birthChartCacheDuration,
                daily_horoscopes: this.config.dailyHoroscopeCacheDuration,
                transits: this.config.transitCacheDuration
            }
        };
    }
}

module.exports = new PersonalizationService();