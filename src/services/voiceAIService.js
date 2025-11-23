/**
 * Voice AI Response System
 *
 * Revolutionary TTS system using OpenAI's advanced voice models.
 * Transforms cosmic guidance into immersive audio experiences.
 *
 * Features:
 * - Multiple voice personalities (Cosmic Guide, Energetic Coach, Gentle Healer, Wise Elder)
 * - Smart caching to minimize API costs
 * - Audio playlist generation (morning & evening)
 * - Premium tier integration
 * - Cloud storage for audio files
 * - Cost optimization strategies
 */

const OpenAI = require('openai');
const logger = require('./loggingService');
const redisService = require('./redisService');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { Readable } = require('stream');

class VoiceAIService {
  constructor() {
    this.openai = null;
    this.initialized = false;

    // Voice personality configurations
    this.voicePersonalities = {
      cosmic_guide: {
        voice: 'alloy',
        speed: 0.9,
        style: 'Mystical, warm, wise',
        description: 'Your cosmic guide with ancient wisdom',
        model: 'tts-1-hd' // High quality for premium experience
      },
      energetic_coach: {
        voice: 'nova',
        speed: 1.1,
        style: 'Upbeat, motivating, energetic',
        description: 'Your energetic life coach',
        model: 'tts-1-hd'
      },
      gentle_healer: {
        voice: 'shimmer',
        speed: 0.85,
        style: 'Soft, healing, nurturing',
        description: 'Your gentle cosmic healer',
        model: 'tts-1-hd'
      },
      wise_elder: {
        voice: 'onyx',
        speed: 0.8,
        style: 'Deep, wise, contemplative',
        description: 'Your wise cosmic elder',
        model: 'tts-1'
      },
      mystical_oracle: {
        voice: 'fable',
        speed: 0.88,
        style: 'Mystical, enchanting, otherworldly',
        description: 'Your mystical oracle',
        model: 'tts-1-hd'
      },
      divine_messenger: {
        voice: 'echo',
        speed: 0.92,
        style: 'Clear, celestial, inspiring',
        description: 'Your divine messenger',
        model: 'tts-1-hd'
      }
    };

    // Storage configuration
    this.storageConfig = {
      local: {
        enabled: true,
        basePath: path.join(__dirname, '../../audio_cache')
      },
      s3: {
        enabled: false, // Enable when AWS credentials are configured
        bucket: process.env.AWS_S3_BUCKET || 'zodia-voice-audio',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    };

    // Cost tracking
    this.costMetrics = {
      totalCharactersProcessed: 0,
      totalRequests: 0,
      cacheHitRate: 0,
      estimatedCost: 0
    };

    // Cache TTL configurations
    this.cacheTTL = {
      horoscope: 86400, // 24 hours - same horoscope for all users of same sign
      personalized: 43200, // 12 hours - user-specific content
      meditation: 604800, // 7 days - reusable guided meditations
      affirmation: 259200 // 3 days - rotating affirmations
    };
  }

  /**
   * Initialize the Voice AI Service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        logger.getLogger().warn('OpenAI API key not configured - Voice AI disabled');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      // Ensure local storage directory exists
      if (this.storageConfig.local.enabled) {
        await fs.mkdir(this.storageConfig.local.basePath, { recursive: true });
      }

      this.initialized = true;
      logger.getLogger().info('✅ Voice AI Service initialized');
    } catch (error) {
      logger.logError(error, { service: 'voiceAI', phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Generate voice response with smart caching
   *
   * @param {string} text - Text to convert to speech
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Audio response with URL and metadata
   */
  async generateVoiceResponse(text, options = {}) {
    this.ensureInitialized();

    const {
      voice = 'cosmic_guide',
      userId = null,
      contentType = 'personalized',
      forceRegenerate = false
    } = options;

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(text, voice, contentType);

      // Check cache first
      if (!forceRegenerate) {
        const cached = await this.getCachedAudio(cacheKey);
        if (cached) {
          this.costMetrics.cacheHitRate++;
          logger.getLogger().info('Voice AI cache hit', { cacheKey, voice });

          return {
            audioUrl: cached.url,
            duration: cached.duration,
            voice: voice,
            personality: this.voicePersonalities[voice],
            cached: true,
            cost: 0
          };
        }
      }

      // Get voice configuration
      const voiceConfig = this.voicePersonalities[voice] || this.voicePersonalities.cosmic_guide;

      // Optimize text for TTS (remove markdown, clean up)
      const cleanedText = this.optimizeTextForTTS(text);

      // Generate audio with OpenAI
      const audioBuffer = await this.callOpenAITTS(cleanedText, voiceConfig);

      // Save audio to storage
      const audioUrl = await this.saveAudioToStorage(audioBuffer, cacheKey, userId);

      // Calculate duration and cost
      const duration = this.estimateDuration(cleanedText);
      const cost = this.calculateCost(cleanedText, voiceConfig.model);

      // Cache the result
      const ttl = this.cacheTTL[contentType] || this.cacheTTL.personalized;
      await this.cacheAudioMetadata(cacheKey, {
        url: audioUrl,
        duration: duration,
        voice: voice,
        createdAt: Date.now()
      }, ttl);

      // Update cost metrics
      this.updateCostMetrics(cleanedText, cost);

      logger.getLogger().info('Voice AI generated', {
        cacheKey,
        voice,
        duration,
        cost,
        characters: cleanedText.length
      });

      return {
        audioUrl,
        duration,
        voice,
        personality: voiceConfig,
        cached: false,
        cost
      };

    } catch (error) {
      logger.logError(error, {
        service: 'voiceAI',
        method: 'generateVoiceResponse',
        voice,
        textLength: text.length
      });
      throw error;
    }
  }

  /**
   * Generate daily audio playlist for user
   *
   * @param {string} userId - User ID
   * @param {Object} userProfile - User profile data
   * @param {Object} content - Content for playlist (horoscope, meditation, etc.)
   * @returns {Promise<Object>} Complete audio playlist
   */
  async generateDailyAudioPlaylist(userId, userProfile, content) {
    this.ensureInitialized();

    try {
      const { sign, voice = 'cosmic_guide', name = 'Cosmic Soul' } = userProfile;
      const playlist = {
        userId,
        generatedAt: new Date().toISOString(),
        voice: voice,
        tracks: []
      };

      // Morning playlist
      const morningPlaylist = {
        title: "Morning Cosmic Activation",
        category: "morning",
        tracks: [],
        totalDuration: 0
      };

      // 1. Personalized morning greeting
      const greetingText = this.generateGreetingScript(name, sign);
      const greeting = await this.generateVoiceResponse(greetingText, {
        voice,
        userId,
        contentType: 'personalized'
      });
      morningPlaylist.tracks.push({
        type: 'greeting',
        title: 'Morning Cosmic Greeting',
        ...greeting
      });

      // 2. Daily horoscope
      if (content.dailyHoroscope) {
        const horoscopeScript = this.formatHoroscopeForVoice(content.dailyHoroscope, sign);
        const horoscope = await this.generateVoiceResponse(horoscopeScript, {
          voice,
          userId,
          contentType: 'horoscope'
        });
        morningPlaylist.tracks.push({
          type: 'horoscope',
          title: 'Daily Cosmic Guidance',
          ...horoscope
        });
      }

      // 3. Morning meditation
      const meditationScript = this.generateMeditationScript('morning', sign);
      const meditation = await this.generateVoiceResponse(meditationScript, {
        voice,
        userId,
        contentType: 'meditation'
      });
      morningPlaylist.tracks.push({
        type: 'meditation',
        title: 'Morning Cosmic Meditation',
        ...meditation
      });

      // Calculate total duration
      morningPlaylist.totalDuration = morningPlaylist.tracks.reduce(
        (sum, track) => sum + track.duration, 0
      );
      playlist.tracks.push(morningPlaylist);

      // Evening playlist
      const eveningPlaylist = {
        title: "Evening Reflection",
        category: "evening",
        tracks: [],
        totalDuration: 0
      };

      // 1. Day review prompt
      const reviewText = this.generateReviewScript(sign);
      const review = await this.generateVoiceResponse(reviewText, {
        voice,
        userId,
        contentType: 'personalized'
      });
      eveningPlaylist.tracks.push({
        type: 'day_review',
        title: 'Evening Reflection',
        ...review
      });

      // 2. Tomorrow preview
      if (content.tomorrowHoroscope) {
        const tomorrowScript = this.formatHoroscopeForVoice(content.tomorrowHoroscope, sign, true);
        const tomorrow = await this.generateVoiceResponse(tomorrowScript, {
          voice,
          userId,
          contentType: 'horoscope'
        });
        eveningPlaylist.tracks.push({
          type: 'tomorrow_preview',
          title: 'Tomorrow\'s Cosmic Preview',
          ...tomorrow
        });
      }

      // 3. Sleep story based on moon phase
      const sleepScript = this.generateSleepStory(content.moonPhase, sign);
      const sleep = await this.generateVoiceResponse(sleepScript, {
        voice: 'gentle_healer', // Always use gentle voice for sleep
        userId,
        contentType: 'meditation'
      });
      eveningPlaylist.tracks.push({
        type: 'sleep_story',
        title: 'Cosmic Sleep Journey',
        ...sleep
      });

      eveningPlaylist.totalDuration = eveningPlaylist.tracks.reduce(
        (sum, track) => sum + track.duration, 0
      );
      playlist.tracks.push(eveningPlaylist);

      // Cache the playlist
      await this.cachePlaylist(userId, playlist);

      logger.getLogger().info('Daily playlist generated', {
        userId,
        morningDuration: morningPlaylist.totalDuration,
        eveningDuration: eveningPlaylist.totalDuration
      });

      return playlist;

    } catch (error) {
      logger.logError(error, {
        service: 'voiceAI',
        method: 'generateDailyAudioPlaylist',
        userId
      });
      throw error;
    }
  }

  /**
   * Generate affirmations audio
   */
  async generateAffirmations(sign, count = 5, voice = 'cosmic_guide') {
    this.ensureInitialized();

    const affirmations = this.getSignAffirmations(sign, count);
    const script = this.formatAffirmationsScript(affirmations, sign);

    return await this.generateVoiceResponse(script, {
      voice,
      contentType: 'affirmation'
    });
  }

  /**
   * Call OpenAI TTS API
   */
  async callOpenAITTS(text, voiceConfig) {
    const response = await this.openai.audio.speech.create({
      model: voiceConfig.model,
      voice: voiceConfig.voice,
      input: text,
      speed: voiceConfig.speed,
      response_format: 'mp3'
    });

    // Convert response to buffer
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  }

  /**
   * Save audio to storage (local or S3)
   */
  async saveAudioToStorage(audioBuffer, cacheKey, userId = null) {
    const fileName = `${cacheKey}.mp3`;

    if (this.storageConfig.local.enabled) {
      const filePath = path.join(this.storageConfig.local.basePath, fileName);
      await fs.writeFile(filePath, audioBuffer);

      // Return URL relative to API endpoint
      return `/api/voice/audio/${fileName}`;
    }

    // TODO: Implement S3 upload when enabled
    if (this.storageConfig.s3.enabled) {
      // AWS S3 upload logic here
      throw new Error('S3 storage not yet implemented');
    }

    throw new Error('No storage backend configured');
  }

  /**
   * Get cached audio metadata
   */
  async getCachedAudio(cacheKey) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return null;

      const cached = await redis.get(`voice:${cacheKey}`);
      if (!cached) return null;

      return JSON.parse(cached);
    } catch (error) {
      logger.logError(error, { method: 'getCachedAudio', cacheKey });
      return null;
    }
  }

  /**
   * Cache audio metadata
   */
  async cacheAudioMetadata(cacheKey, metadata, ttl) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return;

      await redis.setex(
        `voice:${cacheKey}`,
        ttl,
        JSON.stringify(metadata)
      );
    } catch (error) {
      logger.logError(error, { method: 'cacheAudioMetadata', cacheKey });
    }
  }

  /**
   * Cache playlist
   */
  async cachePlaylist(userId, playlist) {
    try {
      const redis = redisService.getRedisClient();
      if (!redis) return;

      const today = new Date().toISOString().split('T')[0];
      const key = `playlist:${userId}:${today}`;

      await redis.setex(key, 86400, JSON.stringify(playlist)); // 24h cache
    } catch (error) {
      logger.logError(error, { method: 'cachePlaylist', userId });
    }
  }

  /**
   * Generate cache key for content
   */
  generateCacheKey(text, voice, contentType) {
    const hash = crypto
      .createHash('sha256')
      .update(`${text}:${voice}:${contentType}`)
      .digest('hex')
      .substring(0, 16);

    return `${contentType}_${voice}_${hash}`;
  }

  /**
   * Optimize text for TTS (remove markdown, clean formatting)
   */
  optimizeTextForTTS(text) {
    let cleaned = text
      // Remove markdown formatting
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/`(.+?)`/g, '$1') // Code
      // Remove emojis (TTS doesn't handle them well)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  /**
   * Estimate audio duration based on text length
   * Average speaking rate: ~150 words per minute
   */
  estimateDuration(text) {
    const words = text.split(/\s+/).length;
    const minutes = words / 150;
    const seconds = Math.ceil(minutes * 60);
    return seconds;
  }

  /**
   * Calculate cost for TTS generation
   * OpenAI pricing: $15/1M characters (tts-1), $30/1M characters (tts-1-hd)
   */
  calculateCost(text, model) {
    const characters = text.length;
    const pricePerMillion = model === 'tts-1-hd' ? 30 : 15;
    const cost = (characters / 1000000) * pricePerMillion;
    return cost;
  }

  /**
   * Update cost tracking metrics
   */
  updateCostMetrics(text, cost) {
    this.costMetrics.totalCharactersProcessed += text.length;
    this.costMetrics.totalRequests++;
    this.costMetrics.estimatedCost += cost;
  }

  /**
   * Get cost metrics for analytics
   */
  getCostMetrics() {
    return {
      ...this.costMetrics,
      averageCostPerRequest: this.costMetrics.totalRequests > 0
        ? this.costMetrics.estimatedCost / this.costMetrics.totalRequests
        : 0
    };
  }

  /**
   * Generate morning greeting script
   */
  generateGreetingScript(name, sign) {
    const greetings = [
      `Good morning, ${name}. As the cosmic energies align with your ${sign} nature, let's embrace this beautiful day together.`,
      `Welcome to a new day, dear ${name}. The universe has special gifts for ${sign} souls like you today.`,
      `Greetings, ${name}. The cosmic currents are flowing favorably for ${sign} today. Let's discover what awaits you.`
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Format horoscope for voice narration
   */
  formatHoroscopeForVoice(horoscope, sign, isTomorrow = false) {
    const timeframe = isTomorrow ? "tomorrow" : "today";

    return `
Your cosmic guidance for ${timeframe}, dear ${sign}.

${horoscope}

Remember, the stars guide us, but we create our own destiny.
Go forth with cosmic confidence.
    `.trim();
  }

  /**
   * Generate meditation script
   */
  generateMeditationScript(timeOfDay, sign) {
    if (timeOfDay === 'morning') {
      return `
Take a deep breath in... and out.

As a ${sign}, you carry unique cosmic gifts.
Today, the universe supports your journey.

Breathe in the golden light of possibility.
Breathe out any doubts or fears.

Set your intention for this day.
You are aligned with cosmic abundance.
You are exactly where you need to be.

When you're ready, open your eyes and embrace your day with cosmic confidence.
      `.trim();
    }

    return `
Settle into this moment. Breathe deeply.

As this day comes to a close, honor all you've experienced.
As a ${sign}, you've navigated today's energies with grace.

Release what no longer serves you.
Embrace the wisdom you've gained.

You are safe. You are loved. You are cosmically supported.

Rest well, dear soul.
    `.trim();
  }

  /**
   * Generate evening review script
   */
  generateReviewScript(sign) {
    return `
Let's reflect on your day together.

What moments brought you joy?
Where did you feel aligned with your ${sign} nature?
What lessons did the universe offer you today?

Take a moment to acknowledge your growth.
Every experience is a cosmic gift.
    `.trim();
  }

  /**
   * Generate sleep story based on moon phase
   */
  generateSleepStory(moonPhase, sign) {
    const stories = {
      'new_moon': `
Under the dark canvas of the new moon, we begin anew.
Imagine yourself floating in a cosmic void, surrounded by infinite possibility.
Each breath draws in stardust, filling you with potential.
As a ${sign}, this is your time to plant seeds of intention.
Let them rest in the fertile darkness of your dreams tonight.
      `,
      'full_moon': `
The full moon illuminates the night sky, revealing all.
Picture yourself bathed in silvery moonlight, clear and complete.
Everything you've worked toward is now visible.
As a ${sign}, you can see how far you've come.
Rest in this moonlit clarity, knowing you are exactly where you need to be.
      `
    };

    return (stories[moonPhase] || stories['new_moon']).trim();
  }

  /**
   * Get zodiac sign-specific affirmations
   */
  getSignAffirmations(sign, count) {
    const affirmationBank = {
      aries: [
        "I am a fearless cosmic warrior",
        "My courage inspires others",
        "I embrace new beginnings with passion",
        "My leadership lights the way",
        "I trust my bold instincts"
      ],
      taurus: [
        "I am grounded and abundant",
        "Beauty flows through my life",
        "I create lasting value",
        "My patience is my power",
        "I am cosmically prosperous"
      ],
      // Add more signs as needed
    };

    const signs = affirmationBank[sign.toLowerCase()] || affirmationBank.aries;
    return signs.slice(0, count);
  }

  /**
   * Format affirmations into narration script
   */
  formatAffirmationsScript(affirmations, sign) {
    return `
Your cosmic affirmations as a ${sign}.

Listen deeply. Breathe into these truths.

${affirmations.map((aff, i) => `${aff}. Pause. Breathe.`).join('\n\n')}

Carry these cosmic truths with you today.
    `.trim();
  }

  /**
   * Ensure service is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Voice AI Service not initialized - check OpenAI API key');
    }
  }

  /**
   * Get available voice personalities
   */
  getVoicePersonalities() {
    return this.voicePersonalities;
  }

  /**
   * Check premium tier access for voice features
   */
  checkPremiumAccess(userTier, requestedFeature) {
    const accessLevels = {
      free: {
        voiceResponses: 0,
        customVoice: false,
        downloads: false,
        playlists: false
      },
      cosmic: {
        voiceResponses: 5, // 5 per day
        customVoice: true,
        downloads: false,
        playlists: true
      },
      universe: {
        voiceResponses: -1, // unlimited
        customVoice: true,
        downloads: true,
        playlists: true
      }
    };

    const tier = accessLevels[userTier] || accessLevels.free;
    return tier[requestedFeature];
  }
}

// Export singleton instance
module.exports = new VoiceAIService();
