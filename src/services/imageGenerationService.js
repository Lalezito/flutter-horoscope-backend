/**
 * AI IMAGE GENERATION SERVICE - DALL-E 3 INTEGRATION
 *
 * Revolutionary Features:
 * - Daily personalized cosmic energy visualizations
 * - Zodiac avatars with birth chart integration
 * - Compatibility visualizations for couples
 * - Moon phase ritual guides
 * - Shareable social media cards
 * - Intelligent caching and cost optimization
 *
 * Cost Optimization:
 * - DALL-E 3 HD: $0.080 per image (1024x1024)
 * - DALL-E 3 Standard: $0.040 per image (1024x1024)
 * - DALL-E 2: $0.020 per image (1024x1024)
 * - Target: 80%+ cache hit rate = $200-400/month for 10,000 users
 *
 * Tier-Based Access:
 * - Free: View cached daily images (same for all users with that sign)
 * - Cosmic ($4.99): 3 personalized images/week
 * - Universe ($9.99): Unlimited generations
 */

const OpenAI = require('openai');
const { randomUUID } = require('crypto');
const db = require('../config/db');
const redisService = require('./redisService');
const receiptValidationService = require('./receiptValidationService');
const logger = require('./loggingService');
const circuitBreaker = require('./circuitBreakerService');
const moment = require('moment-timezone');
const sharp = require('sharp');
const fs = require('fs').promises;

class ImageGenerationService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Image generation models
    this.models = {
      dalle3_hd: {
        name: 'dall-e-3',
        quality: 'hd',
        size: '1024x1024',
        cost: 0.080,
        style: 'vivid'
      },
      dalle3_standard: {
        name: 'dall-e-3',
        quality: 'standard',
        size: '1024x1024',
        cost: 0.040,
        style: 'vivid'
      },
      dalle2: {
        name: 'dall-e-2',
        size: '1024x1024',
        cost: 0.020
      }
    };

    // Zodiac color palettes
    this.zodiacColors = {
      aries: { primary: '#FF6B6B', secondary: '#FFA07A', accent: '#FF4500' },
      taurus: { primary: '#90EE90', secondary: '#98D8C8', accent: '#2E8B57' },
      gemini: { primary: '#FFD700', secondary: '#FFA500', accent: '#FF8C00' },
      cancer: { primary: '#B0C4DE', secondary: '#87CEEB', accent: '#4682B4' },
      leo: { primary: '#FF8C00', secondary: '#FFD700', accent: '#FF6347' },
      virgo: { primary: '#F5DEB3', secondary: '#DEB887', accent: '#D2691E' },
      libra: { primary: '#FFB6C1', secondary: '#FFC0CB', accent: '#FF69B4' },
      scorpio: { primary: '#8B0000', secondary: '#DC143C', accent: '#B22222' },
      sagittarius: { primary: '#9370DB', secondary: '#BA55D3', accent: '#8B008B' },
      capricorn: { primary: '#696969', secondary: '#808080', accent: '#2F4F4F' },
      aquarius: { primary: '#00CED1', secondary: '#20B2AA', accent: '#008B8B' },
      pisces: { primary: '#9370DB', secondary: '#E6E6FA', accent: '#DDA0DD' }
    };

    // Image categories
    this.categories = {
      DAILY_ENERGY: 'daily_energy',
      ZODIAC_AVATAR: 'zodiac_avatar',
      COMPATIBILITY: 'compatibility',
      MOON_RITUAL: 'moon_ritual',
      CUSTOM: 'custom'
    };

    // Cache TTLs
    this.cacheTTL = {
      daily_shared: 86400,      // 24 hours - shared daily images for same sign
      daily_personal: 43200,    // 12 hours - personalized daily images
      avatar: 604800,           // 7 days - user avatars
      compatibility: 259200,    // 3 days - compatibility visualizations
      moon_ritual: 86400        // 24 hours - moon phase rituals
    };

    // Premium tier limits (weekly)
    this.tierLimits = {
      free: { generations: 0, quality: null },
      cosmic: { generations: 3, quality: 'standard' },
      universe: { generations: -1, quality: 'hd' } // -1 = unlimited
    };
  }

  /**
   * GENERATE DAILY ENERGY VISUALIZATION
   * Creates beautiful cosmic art representing user's daily horoscope energy
   */
  async generateDailyEnergyImage(userId, horoscopeData, options = {}) {
    try {
      const { personalized = false } = options;

      // Check tier permissions
      const canGenerate = await this.checkGenerationPermission(userId, 'daily_energy');
      if (!canGenerate.allowed) {
        return {
          success: false,
          error: canGenerate.reason,
          fallback: await this.getCachedDailyImage(horoscopeData.sign, horoscopeData.date)
        };
      }

      // Generate cache key
      const cacheKey = personalized
        ? `daily_energy:personal:${userId}:${horoscopeData.date}`
        : `daily_energy:shared:${horoscopeData.sign}:${horoscopeData.date}`;

      // Check cache first
      const cached = await redisService.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for daily energy image: ${cacheKey}`);
        return {
          success: true,
          cached: true,
          ...cached
        };
      }

      // Build prompt
      const prompt = this.buildDailyEnergyPrompt(horoscopeData, personalized);

      // Select model based on tier
      const userTier = await this.getUserTier(userId);
      const model = userTier === 'universe' ? this.models.dalle3_hd : this.models.dalle3_standard;

      // Generate image
      const image = await this.generateImage(prompt, model);

      if (image.success) {
        // Save to database
        const imageRecord = await this.saveImageRecord({
          userId,
          category: this.categories.DAILY_ENERGY,
          prompt,
          imageUrl: image.url,
          model: model.name,
          quality: model.quality,
          cost: model.cost,
          metadata: {
            sign: horoscopeData.sign,
            date: horoscopeData.date,
            personalized,
            energyLevel: horoscopeData.energyLevel,
            mood: horoscopeData.mood
          }
        });

        // Cache the result
        const ttl = personalized ? this.cacheTTL.daily_personal : this.cacheTTL.daily_shared;
        await redisService.set(cacheKey, {
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `Your cosmic energy visualization for ${horoscopeData.date}`,
          metadata: imageRecord.metadata
        }, ttl);

        // Increment usage counter
        await this.incrementUsageCounter(userId, 'daily_energy');

        return {
          success: true,
          cached: false,
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `Your cosmic energy visualization for ${horoscopeData.date}`,
          shareableCard: await this.createShareableCardUrl(imageRecord.id)
        };
      }

      return { success: false, error: image.error };

    } catch (error) {
      logger.error('Daily energy image generation failed:', error);
      return {
        success: false,
        error: error.message,
        fallback: await this.getCachedDailyImage(horoscopeData.sign, horoscopeData.date)
      };
    }
  }

  /**
   * GENERATE PERSONALIZED ZODIAC AVATAR
   * Creates mystical avatar based on full birth chart
   */
  async generateZodiacAvatar(userId, userProfile) {
    try {
      // Check permissions
      const canGenerate = await this.checkGenerationPermission(userId, 'avatar');
      if (!canGenerate.allowed) {
        return { success: false, error: canGenerate.reason };
      }

      // Check cache
      const cacheKey = `avatar:${userId}:${userProfile.version || 1}`;
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return { success: true, cached: true, ...cached };
      }

      // Build avatar prompt
      const prompt = this.buildAvatarPrompt(userProfile);

      // Use HD quality for avatars (premium feature)
      const image = await this.generateImage(prompt, this.models.dalle3_hd);

      if (image.success) {
        const imageRecord = await this.saveImageRecord({
          userId,
          category: this.categories.ZODIAC_AVATAR,
          prompt,
          imageUrl: image.url,
          model: this.models.dalle3_hd.name,
          quality: this.models.dalle3_hd.quality,
          cost: this.models.dalle3_hd.cost,
          metadata: {
            sunSign: userProfile.sunSign,
            moonSign: userProfile.moonSign,
            risingSign: userProfile.risingSign,
            version: userProfile.version || 1
          }
        });

        // Cache for 7 days
        await redisService.set(cacheKey, {
          imageUrl: image.url,
          imageId: imageRecord.id
        }, this.cacheTTL.avatar);

        await this.incrementUsageCounter(userId, 'avatar');

        return {
          success: true,
          cached: false,
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `Your personalized ${userProfile.sunSign} avatar`
        };
      }

      return { success: false, error: image.error };

    } catch (error) {
      logger.error('Avatar generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * GENERATE COMPATIBILITY VISUALIZATION
   * Creates romantic cosmic art showing relationship compatibility
   */
  async generateCompatibilityArt(userId, user1Data, user2Data, compatibilityScore) {
    try {
      // Check permissions
      const canGenerate = await this.checkGenerationPermission(userId, 'compatibility');
      if (!canGenerate.allowed) {
        return { success: false, error: canGenerate.reason };
      }

      // Generate cache key (same for both users)
      const signs = [user1Data.sign, user2Data.sign].sort();
      const cacheKey = `compatibility:${signs.join('_')}:${compatibilityScore}`;

      const cached = await redisService.get(cacheKey);
      if (cached) {
        return { success: true, cached: true, ...cached };
      }

      // Build compatibility prompt
      const prompt = this.buildCompatibilityPrompt(user1Data, user2Data, compatibilityScore);

      // Use standard quality for compatibility (can generate many)
      const image = await this.generateImage(prompt, this.models.dalle3_standard);

      if (image.success) {
        const imageRecord = await this.saveImageRecord({
          userId,
          category: this.categories.COMPATIBILITY,
          prompt,
          imageUrl: image.url,
          model: this.models.dalle3_standard.name,
          quality: this.models.dalle3_standard.quality,
          cost: this.models.dalle3_standard.cost,
          metadata: {
            user1Sign: user1Data.sign,
            user2Sign: user2Data.sign,
            compatibilityScore
          }
        });

        await redisService.set(cacheKey, {
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `${user1Data.sign} + ${user2Data.sign} compatibility: ${compatibilityScore}%`
        }, this.cacheTTL.compatibility);

        await this.incrementUsageCounter(userId, 'compatibility');

        return {
          success: true,
          cached: false,
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `${user1Data.sign} + ${user2Data.sign} compatibility: ${compatibilityScore}%`,
          shareableCard: await this.createShareableCardUrl(imageRecord.id)
        };
      }

      return { success: false, error: image.error };

    } catch (error) {
      logger.error('Compatibility art generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * GENERATE MOON PHASE RITUAL GUIDE
   * Creates ritual visualization for new moon, full moon, etc.
   */
  async generateMoonRitualImage(userId, moonPhase, intention, userSign) {
    try {
      const canGenerate = await this.checkGenerationPermission(userId, 'moon_ritual');
      if (!canGenerate.allowed) {
        return { success: false, error: canGenerate.reason };
      }

      const cacheKey = `moon_ritual:${moonPhase}:${userSign}:${intention}`;
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return { success: true, cached: true, ...cached };
      }

      const prompt = this.buildMoonRitualPrompt(moonPhase, intention, userSign);
      const image = await this.generateImage(prompt, this.models.dalle3_standard);

      if (image.success) {
        const imageRecord = await this.saveImageRecord({
          userId,
          category: this.categories.MOON_RITUAL,
          prompt,
          imageUrl: image.url,
          model: this.models.dalle3_standard.name,
          quality: this.models.dalle3_standard.quality,
          cost: this.models.dalle3_standard.cost,
          metadata: { moonPhase, intention, userSign }
        });

        await redisService.set(cacheKey, {
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `${moonPhase} ritual guide for ${intention}`
        }, this.cacheTTL.moon_ritual);

        await this.incrementUsageCounter(userId, 'moon_ritual');

        return {
          success: true,
          imageUrl: image.url,
          imageId: imageRecord.id,
          description: `${moonPhase} ritual guide for ${intention}`
        };
      }

      return { success: false, error: image.error };

    } catch (error) {
      logger.error('Moon ritual image generation failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * CORE IMAGE GENERATION WITH DALL-E
   */
  async generateImage(prompt, model) {
    try {
      logger.info(`Generating image with ${model.name} (${model.quality || 'standard'})`);

      const requestParams = {
        model: model.name,
        prompt: prompt,
        n: 1,
        size: model.size,
        response_format: 'url'
      };

      // Add quality and style for DALL-E 3
      if (model.name === 'dall-e-3') {
        requestParams.quality = model.quality;
        requestParams.style = model.style;
      }

      const response = await circuitBreaker.execute(
        async () => await this.openai.images.generate(requestParams),
        'dalle_generation'
      );

      if (response && response.data && response.data[0]) {
        return {
          success: true,
          url: response.data[0].url,
          revised_prompt: response.data[0].revised_prompt // DALL-E 3 returns this
        };
      }

      return { success: false, error: 'No image data returned' };

    } catch (error) {
      logger.error('DALL-E generation error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * PROMPT BUILDERS
   */
  buildDailyEnergyPrompt(horoscope, personalized) {
    const colors = this.zodiacColors[horoscope.sign.toLowerCase()];
    const energyDesc = horoscope.energyLevel > 7 ? 'vibrant and powerful' :
                       horoscope.energyLevel > 4 ? 'balanced and harmonious' :
                       'calm and introspective';

    return `
Ethereal cosmic energy visualization representing ${horoscope.sign} energy on ${horoscope.date}.

Energy level: ${horoscope.energyLevel}/10 (${energyDesc})
Primary color palette: ${colors.primary}, ${colors.secondary}, ${colors.accent}
Mood: ${horoscope.mood || 'mystical'}
Focus area: ${horoscope.focus || 'spiritual growth'}

Style: Dreamy, mystical, cosmic, spiritual art
Visual elements: Swirling galaxies, stardust, constellation patterns, ethereal light
Atmosphere: ${horoscope.energyLevel > 7 ? 'Radiant and uplifting' : 'Peaceful and meditative'}
Quality: Professional digital art, high detail, magical realism

The image should feel: ${personalized ? 'Deeply personal and unique' : 'Universal and inspiring'}
Avoid: Text, faces, literal zodiac symbols, mundane elements
    `.trim();
  }

  buildAvatarPrompt(userProfile) {
    const colors = this.zodiacColors[userProfile.sunSign.toLowerCase()];

    return `
Mystical cosmic portrait representing a ${userProfile.sunSign} individual with:
- Sun in ${userProfile.sunSign} (core identity)
- Moon in ${userProfile.moonSign} (emotional nature)
- Rising in ${userProfile.risingSign} (outer expression)

Personality essence: ${userProfile.traits ? userProfile.traits.join(', ') : 'wise, intuitive, powerful'}

Style: Ethereal portrait, cosmic spiritual art, magical realism
Color palette: ${colors.primary}, ${colors.secondary}, ${colors.accent} with celestial gold accents
Visual elements: Cosmic aura, stardust, subtle constellation patterns, divine light
Quality: Professional portrait art, highly detailed, mystical atmosphere

Should evoke: Personal power, spiritual depth, cosmic connection
Avoid: Literal human faces, text, obvious zodiac symbols, photorealism
    `.trim();
  }

  buildCompatibilityPrompt(user1, user2, score) {
    const colors1 = this.zodiacColors[user1.sign.toLowerCase()];
    const colors2 = this.zodiacColors[user2.sign.toLowerCase()];
    const compatibilityDesc = score > 80 ? 'highly compatible, harmonious union' :
                             score > 60 ? 'moderately compatible, balanced energy' :
                             'challenging but growth-oriented connection';

    return `
Cosmic visualization of relationship compatibility between:
- ${user1.sign} (element: ${user1.element}, energy: ${colors1.primary})
- ${user2.sign} (element: ${user2.element}, energy: ${colors2.primary})

Compatibility: ${score}% (${compatibilityDesc})

Visual concept: Two cosmic energies ${score > 80 ? 'merging harmoniously into one beautiful spiral' :
                                     score > 60 ? 'dancing together in balanced orbit' :
                                     'creating beautiful tension and growth through contrast'}

Style: Romantic, ethereal, cosmic energy art
Color blend: Gradient between ${colors1.primary} and ${colors2.primary}
Atmosphere: ${score > 70 ? 'Magical, harmonious, dreamy' : 'Complex, intriguing, transformative'}
Visual elements: Intertwining energy streams, stardust, cosmic dance, celestial harmony

Should feel: ${score > 70 ? 'Destined and magical' : 'Challenging but beautiful'}
Avoid: Human figures, text, literal symbols, hearts
    `.trim();
  }

  buildMoonRitualPrompt(moonPhase, intention, userSign) {
    const colors = this.zodiacColors[userSign.toLowerCase()];

    return `
Mystical ritual guide visualization for ${moonPhase} moon ceremony.

Intention: ${intention}
Zodiac energy: ${userSign}

Style: Spiritual ritual art, mystical altar scene, cosmic ceremony
Color palette: Silver moonlight, ${colors.primary}, deep purples, celestial gold
Visual elements: Moon (${moonPhase}), candles, crystals, sacred geometry, cosmic energy
Atmosphere: Sacred, peaceful, powerful, transformative

Should evoke: Spiritual practice, manifestation energy, cosmic alignment
Quality: Professional spiritual art, detailed, atmospheric
Avoid: Text, human figures, specific religious symbols
    `.trim();
  }

  /**
   * PERMISSION AND TIER MANAGEMENT
   */
  async checkGenerationPermission(userId, category) {
    try {
      // Get user tier
      const userTier = await this.getUserTier(userId);
      const limits = this.tierLimits[userTier];

      // Free tier - only cached images
      if (userTier === 'free') {
        return {
          allowed: false,
          reason: 'Free tier users can only view cached daily images. Upgrade to Cosmic tier for personalized images.',
          tier: userTier
        };
      }

      // Universe tier - unlimited
      if (userTier === 'universe' || limits.generations === -1) {
        return { allowed: true, tier: userTier };
      }

      // Cosmic tier - check weekly limit
      const weeklyUsage = await this.getWeeklyUsage(userId);
      if (weeklyUsage >= limits.generations) {
        return {
          allowed: false,
          reason: `Weekly limit reached (${limits.generations} generations). Upgrade to Universe tier for unlimited generations.`,
          tier: userTier,
          usage: weeklyUsage,
          limit: limits.generations
        };
      }

      return {
        allowed: true,
        tier: userTier,
        remaining: limits.generations - weeklyUsage
      };

    } catch (error) {
      logger.error('Permission check failed:', error);
      return { allowed: false, reason: 'Permission check failed' };
    }
  }

  async getUserTier(userId) {
    try {
      const validation = await receiptValidationService.validateUserSubscription(userId);

      if (validation.isValid && validation.productId) {
        if (validation.productId.includes('universe')) return 'universe';
        if (validation.productId.includes('cosmic')) return 'cosmic';
      }

      return 'free';
    } catch (error) {
      logger.error('Tier check failed:', error);
      return 'free';
    }
  }

  async getWeeklyUsage(userId) {
    try {
      const startOfWeek = moment().startOf('week').toISOString();
      const result = await db.query(
        `SELECT COUNT(*) as count FROM generated_images
         WHERE user_id = $1 AND created_at >= $2`,
        [userId, startOfWeek]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Weekly usage check failed:', error);
      return 0;
    }
  }

  async incrementUsageCounter(userId, category) {
    try {
      await db.query(
        `INSERT INTO image_generation_stats (user_id, category, generated_at)
         VALUES ($1, $2, NOW())`,
        [userId, category]
      );
    } catch (error) {
      logger.error('Usage counter increment failed:', error);
    }
  }

  /**
   * DATABASE OPERATIONS
   */
  async saveImageRecord(data) {
    try {
      const result = await db.query(
        `INSERT INTO generated_images
         (id, user_id, category, prompt, image_url, model, quality, cost, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [
          randomUUID(),
          data.userId,
          data.category,
          data.prompt,
          data.imageUrl,
          data.model,
          data.quality || 'standard',
          data.cost,
          JSON.stringify(data.metadata)
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Image record save failed:', error);
      throw error;
    }
  }

  async getImageById(imageId) {
    try {
      const result = await db.query(
        'SELECT * FROM generated_images WHERE id = $1',
        [imageId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Image fetch failed:', error);
      return null;
    }
  }

  async getUserImages(userId, limit = 20, offset = 0) {
    try {
      const result = await db.query(
        `SELECT id, category, image_url, metadata, created_at
         FROM generated_images
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error('User images fetch failed:', error);
      return [];
    }
  }

  /**
   * CACHED FALLBACK IMAGES
   */
  async getCachedDailyImage(sign, date) {
    const cacheKey = `daily_energy:shared:${sign}:${date}`;
    const cached = await redisService.get(cacheKey);
    return cached ? { imageUrl: cached.imageUrl, cached: true } : null;
  }

  /**
   * SHAREABLE CARD URL GENERATION
   */
  async createShareableCardUrl(imageId) {
    // This would integrate with a card generation service
    // For now, return a URL that the frontend can use
    return `${process.env.API_URL || 'http://localhost:3000'}/api/images/share/${imageId}`;
  }

  /**
   * BATCH GENERATION FOR POPULAR SIGNS
   * Run this as a cron job at midnight to pre-generate daily images
   */
  async batchGenerateDailyImages() {
    try {
      logger.info('Starting batch generation of daily images...');

      const signs = Object.keys(this.zodiacColors);
      const today = moment().format('YYYY-MM-DD');
      const generatedCount = { success: 0, failed: 0, cached: 0 };

      for (const sign of signs) {
        const cacheKey = `daily_energy:shared:${sign}:${today}`;
        const cached = await redisService.get(cacheKey);

        if (cached) {
          generatedCount.cached++;
          continue;
        }

        // Create mock horoscope data for batch generation
        const horoscopeData = {
          sign,
          date: today,
          energyLevel: Math.floor(Math.random() * 5) + 5, // 5-10
          mood: 'mystical',
          focus: 'spiritual growth'
        };

        const prompt = this.buildDailyEnergyPrompt(horoscopeData, false);
        const image = await this.generateImage(prompt, this.models.dalle3_standard);

        if (image.success) {
          await redisService.set(cacheKey, {
            imageUrl: image.url,
            description: `${sign} daily energy for ${today}`
          }, this.cacheTTL.daily_shared);

          generatedCount.success++;
          logger.info(`Generated daily image for ${sign}`);

          // Rate limit: wait 2 seconds between generations
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          generatedCount.failed++;
          logger.error(`Failed to generate image for ${sign}:`, image.error);
        }
      }

      logger.info('Batch generation complete:', generatedCount);
      return generatedCount;

    } catch (error) {
      logger.error('Batch generation failed:', error);
      return { error: error.message };
    }
  }

  /**
   * ANALYTICS AND METRICS
   */
  async getGenerationStats(startDate, endDate) {
    try {
      const result = await db.query(
        `SELECT
          category,
          model,
          COUNT(*) as count,
          SUM(cost) as total_cost,
          AVG(cost) as avg_cost
         FROM generated_images
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY category, model
         ORDER BY count DESC`,
        [startDate, endDate]
      );

      return result.rows;
    } catch (error) {
      logger.error('Stats fetch failed:', error);
      return [];
    }
  }

  async getTotalCost(startDate, endDate) {
    try {
      const result = await db.query(
        `SELECT SUM(cost) as total_cost, COUNT(*) as total_images
         FROM generated_images
         WHERE created_at BETWEEN $1 AND $2`,
        [startDate, endDate]
      );

      return {
        totalCost: parseFloat(result.rows[0].total_cost || 0),
        totalImages: parseInt(result.rows[0].total_images || 0)
      };
    } catch (error) {
      logger.error('Cost calculation failed:', error);
      return { totalCost: 0, totalImages: 0 };
    }
  }

  async getCacheHitRate(days = 7) {
    try {
      const cacheKey = `image_gen_stats:cache_hits:${days}d`;
      const stats = await redisService.get(cacheKey);

      if (stats) {
        const hitRate = (stats.hits / (stats.hits + stats.misses)) * 100;
        return {
          hits: stats.hits,
          misses: stats.misses,
          hitRate: hitRate.toFixed(2) + '%'
        };
      }

      return { hits: 0, misses: 0, hitRate: '0%' };
    } catch (error) {
      logger.error('Cache hit rate calculation failed:', error);
      return { hits: 0, misses: 0, hitRate: '0%' };
    }
  }
}

// Export singleton instance
module.exports = new ImageGenerationService();
