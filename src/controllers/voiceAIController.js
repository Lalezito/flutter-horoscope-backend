/**
 * Voice AI Controller
 *
 * Handles all voice AI endpoints and premium access control
 */

const voiceAIService = require('../services/voiceAIService');
const logger = require('../services/loggingService');
const redisService = require('../services/redisService');

class VoiceAIController {
  /**
   * Generate voice response for text
   */
  async generateVoice(req, res) {
    try {
      const { text, voice, contentType } = req.body;
      const userId = req.user?.uid || req.body.userId;
      const userTier = req.user?.tier || 'free';

      // Validate input
      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Text content is required'
        });
      }

      if (text.length > 4000) {
        return res.status(400).json({
          success: false,
          error: 'Text exceeds maximum length of 4000 characters'
        });
      }

      // Check premium access
      const hasAccess = await this.checkUserVoiceQuota(userId, userTier);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Voice generation limit reached. Upgrade to Cosmic or Universe tier for more.',
          upgradePrompt: {
            title: 'Unlock Voice Responses',
            message: 'Get 5 daily voice responses with Cosmic tier, or unlimited with Universe tier.',
            tiers: {
              cosmic: { limit: 5, price: '$4.99/mo' },
              universe: { limit: 'unlimited', price: '$9.99/mo' }
            }
          }
        });
      }

      // Generate voice response
      const result = await voiceAIService.generateVoiceResponse(text, {
        voice: voice || 'cosmic_guide',
        userId,
        contentType: contentType || 'personalized'
      });

      // Track usage
      if (!result.cached) {
        await this.incrementUserVoiceUsage(userId, userTier);
      }

      // Log analytics
      await this.logVoiceAnalytics(userId, userTier, result);

      res.json({
        success: true,
        data: result,
        usage: await this.getUserVoiceUsage(userId, userTier)
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'generateVoice',
        userId: req.user?.uid
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate voice response'
      });
    }
  }

  /**
   * Generate daily audio playlist
   */
  async generatePlaylist(req, res) {
    try {
      const userId = req.user?.uid || req.body.userId;
      const userTier = req.user?.tier || 'free';

      // Check premium access for playlists
      if (!voiceAIService.checkPremiumAccess(userTier, 'playlists')) {
        return res.status(403).json({
          success: false,
          error: 'Audio playlists require Cosmic or Universe tier',
          upgradePrompt: {
            title: 'Unlock Audio Playlists',
            message: 'Get personalized morning and evening audio playlists with premium tiers.',
            feature: 'Daily audio guidance to start and end your day'
          }
        });
      }

      const { userProfile, content } = req.body;

      // Validate required data
      if (!userProfile || !userProfile.sign) {
        return res.status(400).json({
          success: false,
          error: 'User profile with zodiac sign is required'
        });
      }

      // Check if playlist already generated today
      const cached = await this.getCachedPlaylist(userId);
      if (cached) {
        return res.json({
          success: true,
          data: cached,
          cached: true
        });
      }

      // Generate new playlist
      const playlist = await voiceAIService.generateDailyAudioPlaylist(
        userId,
        userProfile,
        content || {}
      );

      res.json({
        success: true,
        data: playlist,
        cached: false
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'generatePlaylist',
        userId: req.user?.uid
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate audio playlist'
      });
    }
  }

  /**
   * Generate affirmations audio
   */
  async generateAffirmations(req, res) {
    try {
      const { sign, count, voice } = req.body;
      const userId = req.user?.uid || req.body.userId;
      const userTier = req.user?.tier || 'free';

      if (!sign) {
        return res.status(400).json({
          success: false,
          error: 'Zodiac sign is required'
        });
      }

      // Check premium access
      const hasAccess = await this.checkUserVoiceQuota(userId, userTier);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Voice generation limit reached'
        });
      }

      const result = await voiceAIService.generateAffirmations(
        sign,
        count || 5,
        voice || 'cosmic_guide'
      );

      // Track usage
      if (!result.cached) {
        await this.incrementUserVoiceUsage(userId, userTier);
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'generateAffirmations',
        userId: req.user?.uid
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate affirmations'
      });
    }
  }

  /**
   * Get available voice personalities
   */
  async getVoicePersonalities(req, res) {
    try {
      const personalities = voiceAIService.getVoicePersonalities();

      res.json({
        success: true,
        data: personalities
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'getVoicePersonalities'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch voice personalities'
      });
    }
  }

  /**
   * Get user's voice usage stats
   */
  async getUserStats(req, res) {
    try {
      const userId = req.user?.uid || req.params.userId;
      const userTier = req.user?.tier || 'free';

      const usage = await this.getUserVoiceUsage(userId, userTier);
      const quota = this.getVoiceQuota(userTier);

      res.json({
        success: true,
        data: {
          tier: userTier,
          usage: usage,
          quota: quota,
          remaining: quota === -1 ? 'unlimited' : Math.max(0, quota - usage)
        }
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'getUserStats',
        userId: req.user?.uid
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch user stats'
      });
    }
  }

  /**
   * Download audio file
   */
  async downloadAudio(req, res) {
    try {
      const { fileName } = req.params;
      const userId = req.user?.uid;
      const userTier = req.user?.tier || 'free';

      // Check download permission
      if (!voiceAIService.checkPremiumAccess(userTier, 'downloads')) {
        return res.status(403).json({
          success: false,
          error: 'Audio downloads require Universe tier'
        });
      }

      // Serve audio file
      const path = require('path');
      const fs = require('fs').promises;

      const filePath = path.join(
        __dirname,
        '../../audio_cache',
        fileName
      );

      // Check file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({
          success: false,
          error: 'Audio file not found'
        });
      }

      // Set headers for download
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Stream file
      const fileStream = require('fs').createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'downloadAudio',
        userId: req.user?.uid
      });

      res.status(500).json({
        success: false,
        error: 'Failed to download audio'
      });
    }
  }

  /**
   * Stream audio file
   */
  async streamAudio(req, res) {
    try {
      const { fileName } = req.params;
      const path = require('path');
      const fs = require('fs');

      const filePath = path.join(
        __dirname,
        '../../audio_cache',
        fileName
      );

      // Check file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Audio file not found'
        });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        // Handle range requests (for seeking in audio)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'audio/mpeg',
        };

        res.writeHead(206, head);
        file.pipe(res);
      } else {
        // Stream entire file
        const head = {
          'Content-Length': fileSize,
          'Content-Type': 'audio/mpeg',
        };

        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'streamAudio',
        fileName: req.params.fileName
      });

      res.status(500).json({
        success: false,
        error: 'Failed to stream audio'
      });
    }
  }

  /**
   * Get voice AI cost metrics (admin only)
   */
  async getCostMetrics(req, res) {
    try {
      // TODO: Add admin authentication check
      const metrics = voiceAIService.getCostMetrics();

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.logError(error, {
        controller: 'voiceAI',
        method: 'getCostMetrics'
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch cost metrics'
      });
    }
  }

  // Helper methods

  /**
   * Check if user has voice quota remaining
   */
  async checkUserVoiceQuota(userId, userTier) {
    const quota = this.getVoiceQuota(userTier);

    if (quota === -1) {
      return true; // Unlimited
    }

    if (quota === 0) {
      return false; // No access
    }

    const usage = await this.getUserVoiceUsage(userId, userTier);
    return usage < quota;
  }

  /**
   * Get voice quota for tier
   */
  getVoiceQuota(tier) {
    const quotas = {
      free: 0,
      cosmic: 5,
      universe: -1 // unlimited
    };

    return quotas[tier] || 0;
  }

  /**
   * Get user's voice usage for today
   */
  async getUserVoiceUsage(userId, userTier) {
    try {
      if (userTier === 'universe') {
        return 0; // Don't track for unlimited
      }

      const redis = redisService.getRedisClient();
      if (!redis) return 0;

      const today = new Date().toISOString().split('T')[0];
      const key = `voice_usage:${userId}:${today}`;

      const usage = await redis.get(key);
      return parseInt(usage || '0', 10);

    } catch (error) {
      logger.logError(error, { method: 'getUserVoiceUsage', userId });
      return 0;
    }
  }

  /**
   * Increment user's voice usage
   */
  async incrementUserVoiceUsage(userId, userTier) {
    try {
      if (userTier === 'universe') {
        return; // Don't track for unlimited
      }

      const redis = redisService.getRedisClient();
      if (!redis) return;

      const today = new Date().toISOString().split('T')[0];
      const key = `voice_usage:${userId}:${today}`;

      await redis.incr(key);
      await redis.expire(key, 86400); // Expire after 24 hours

    } catch (error) {
      logger.logError(error, { method: 'incrementUserVoiceUsage', userId });
    }
  }

  /**
   * Get cached playlist for user
   */
  async getCachedPlaylist(userId) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const today = new Date().toISOString().split('T')[0];
      const key = `playlist:${userId}:${today}`;

      const cached = await redis.get(key);
      if (!cached) return null;

      return JSON.parse(cached);

    } catch (error) {
      logger.logError(error, { method: 'getCachedPlaylist', userId });
      return null;
    }
  }

  /**
   * Log voice analytics
   */
  async logVoiceAnalytics(userId, userTier, result) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return;

      const analytics = {
        userId,
        userTier,
        voice: result.voice,
        duration: result.duration,
        cached: result.cached,
        cost: result.cost,
        timestamp: Date.now()
      };

      // Store in analytics stream
      await redis.xadd(
        'voice_analytics',
        '*',
        'data',
        JSON.stringify(analytics)
      );

    } catch (error) {
      logger.logError(error, { method: 'logVoiceAnalytics', userId });
    }
  }
}

module.exports = new VoiceAIController();
