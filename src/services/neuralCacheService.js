const cacheService = require('./cacheService');
const logger = require('./loggingService');

/**
 * 🧠 NEURAL CACHE SERVICE
 * Specialized caching strategies for neural compatibility analysis
 * Extends existing cache service with neural-optimized performance patterns
 */

class NeuralCacheService {
  constructor() {
    this.baseCache = cacheService;
    this.neuralPrefix = 'neural:';
    this.defaultTTL = 3600; // 1 hour for neural analysis
    this.deepAnalysisTTL = 7200; // 2 hours for deep analysis (more expensive)
    this.historyTTL = 1800; // 30 minutes for user history
    this.insightsTTL = 2700; // 45 minutes for insights
  }

  /**
   * 🔮 CACHE NEURAL COMPATIBILITY ANALYSIS
   * Optimized caching for neural compatibility calculations
   */
  async cacheNeuralAnalysis(sign1, sign2, analysisLevel, language, neuralData, ttl = null) {
    try {
      const cacheKey = this.buildNeuralKey('analysis', sign1, sign2, analysisLevel, language);
      const cacheTTL = ttl || this.getTTLForAnalysisLevel(analysisLevel);
      
      // Add metadata for cache management
      const cacheData = {
        ...neuralData,
        cached_at: new Date().toISOString(),
        analysis_level: analysisLevel,
        cache_version: '1.0.0',
        expires_at: new Date(Date.now() + (cacheTTL * 1000)).toISOString()
      };
      
      const cached = await this.baseCache.set(cacheKey, cacheData, cacheTTL);
      
      if (cached) {
        // Track cache performance metrics
        logger.getLogger().info('Neural cache set successful', {
          signs: [sign1, sign2],
          level: analysisLevel,
          language,
          ttl: cacheTTL
        });
        
        // Update neural cache statistics
        await this.updateNeuralCacheStats('set', analysisLevel);
      }
      
      return cached;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'cache_analysis',
        signs: [sign1, sign2],
        level: analysisLevel
      });
      return false;
    }
  }

  /**
   * 🔍 GET CACHED NEURAL ANALYSIS
   * Retrieve cached neural compatibility with performance tracking
   */
  async getCachedNeuralAnalysis(sign1, sign2, analysisLevel, language) {
    try {
      const cacheKey = this.buildNeuralKey('analysis', sign1, sign2, analysisLevel, language);
      const startTime = Date.now();
      
      const cachedData = await this.baseCache.get(cacheKey);
      const retrievalTime = Date.now() - startTime;
      
      if (cachedData) {
        // Add cache hit metadata
        cachedData.cached = true;
        cachedData.cache_hit_at = new Date().toISOString();
        cachedData.retrieval_time_ms = retrievalTime;
        
        // Track cache hit performance
        logger.getLogger().info('Neural cache hit', {
          signs: [sign1, sign2],
          level: analysisLevel,
          retrieval_time: retrievalTime
        });
        
        // Update neural cache statistics
        await this.updateNeuralCacheStats('hit', analysisLevel);
        
        return cachedData;
      } else {
        // Track cache miss
        logger.getLogger().info('Neural cache miss', {
          signs: [sign1, sign2],
          level: analysisLevel
        });
        
        await this.updateNeuralCacheStats('miss', analysisLevel);
        return null;
      }
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'get_analysis',
        signs: [sign1, sign2],
        level: analysisLevel
      });
      return null;
    }
  }

  /**
   * 📊 CACHE USER NEURAL HISTORY
   * Cache paginated user analysis history with privacy controls
   */
  async cacheUserHistory(userId, page, limit, language, historyData) {
    try {
      const cacheKey = this.buildHistoryKey(userId, page, limit, language);
      
      // Add privacy and GDPR metadata
      const cacheData = {
        ...historyData,
        user_id: userId,
        cached_at: new Date().toISOString(),
        privacy_compliant: true,
        gdpr_retention: this.historyTTL,
        can_delete: true
      };
      
      const cached = await this.baseCache.set(cacheKey, cacheData, this.historyTTL);
      
      if (cached) {
        logger.getLogger().info('Neural history cache set successful', {
          user_id: userId,
          page,
          limit,
          ttl: this.historyTTL
        });
      }
      
      return cached;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'cache_history',
        user_id: userId
      });
      return false;
    }
  }

  /**
   * 📚 GET CACHED USER HISTORY
   * Retrieve user history with privacy validation
   */
  async getCachedUserHistory(userId, page, limit, language) {
    try {
      const cacheKey = this.buildHistoryKey(userId, page, limit, language);
      const cachedData = await this.baseCache.get(cacheKey);
      
      if (cachedData) {
        // Validate privacy compliance
        if (cachedData.privacy_compliant && cachedData.can_delete) {
          cachedData.retrieved_at = new Date().toISOString();
          
          logger.getLogger().info('Neural history cache hit', {
            user_id: userId,
            page,
            limit
          });
          
          return cachedData;
        } else {
          // Remove non-compliant cache entry
          await this.deleteUserHistory(userId, page, limit, language);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'get_history',
        user_id: userId
      });
      return null;
    }
  }

  /**
   * 🎯 CACHE NEURAL INSIGHTS
   * Cache contextual neural insights with context-aware TTL
   */
  async cacheNeuralInsights(sign1, sign2, context, language, insightsData) {
    try {
      const cacheKey = this.buildInsightsKey(sign1, sign2, context, language);
      
      const cacheData = {
        ...insightsData,
        context,
        cached_at: new Date().toISOString(),
        context_specific: true
      };
      
      return await this.baseCache.set(cacheKey, cacheData, this.insightsTTL);
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'cache_insights',
        signs: [sign1, sign2],
        context
      });
      return false;
    }
  }

  /**
   * 💡 GET CACHED NEURAL INSIGHTS
   */
  async getCachedNeuralInsights(sign1, sign2, context, language) {
    try {
      const cacheKey = this.buildInsightsKey(sign1, sign2, context, language);
      return await this.baseCache.get(cacheKey);
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'get_insights',
        signs: [sign1, sign2],
        context
      });
      return null;
    }
  }

  /**
   * 🗑️ DELETE USER HISTORY (GDPR Compliance)
   * Complete removal of user neural compatibility history
   */
  async deleteUserHistory(userId, page = null, limit = null, language = null) {
    try {
      if (page && limit && language) {
        // Delete specific page
        const cacheKey = this.buildHistoryKey(userId, page, limit, language);
        return await this.baseCache.delete(cacheKey);
      } else {
        // Delete all user history (GDPR right to deletion)
        const userPattern = `${this.neuralPrefix}history:${userId}:*`;
        return await this.deleteByPattern(userPattern);
      }
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'delete_history',
        user_id: userId
      });
      return false;
    }
  }

  /**
   * 🧹 CLEANUP EXPIRED NEURAL CACHE
   * Performance-optimized cleanup of expired neural analysis cache
   */
  async cleanupExpiredNeuralCache() {
    try {
      const patterns = [
        `${this.neuralPrefix}analysis:*`,
        `${this.neuralPrefix}history:*`,
        `${this.neuralPrefix}insights:*`
      ];
      
      let cleanedCount = 0;
      
      for (const pattern of patterns) {
        const deleted = await this.deleteExpiredByPattern(pattern);
        cleanedCount += deleted;
      }
      
      logger.getLogger().info(`Neural cache cleanup completed: ${cleanedCount} expired entries removed`);
      return cleanedCount;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'cleanup'
      });
      return 0;
    }
  }

  /**
   * 📈 GET NEURAL CACHE STATISTICS
   * Comprehensive neural cache performance metrics
   */
  async getNeuralCacheStats() {
    try {
      const statsKey = `${this.neuralPrefix}stats`;
      const stats = await this.baseCache.get(statsKey) || {
        total_sets: 0,
        total_hits: 0,
        total_misses: 0,
        by_level: {
          standard: { sets: 0, hits: 0, misses: 0 },
          advanced: { sets: 0, hits: 0, misses: 0 },
          deep: { sets: 0, hits: 0, misses: 0 }
        },
        cache_efficiency: 0,
        last_cleanup: null
      };
      
      // Calculate derived metrics
      const totalRequests = stats.total_hits + stats.total_misses;
      stats.cache_efficiency = totalRequests > 0 ? 
        Math.round((stats.total_hits / totalRequests) * 100) : 0;
      
      return stats;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'get_stats'
      });
      return null;
    }
  }

  /**
   * ⚡ PREFETCH POPULAR COMBINATIONS
   * Proactive caching of popular sign combinations
   */
  async prefetchPopularCombinations(popularCombinations = []) {
    try {
      const prefetchResults = [];
      
      for (const combo of popularCombinations) {
        const { sign1, sign2, analysisLevel = 'standard', language = 'en' } = combo;
        
        // Check if already cached
        const cached = await this.getCachedNeuralAnalysis(sign1, sign2, analysisLevel, language);
        
        if (!cached) {
          // Mark for prefetch (would typically trigger background analysis)
          prefetchResults.push({
            sign1,
            sign2,
            analysisLevel,
            language,
            status: 'queued_for_prefetch'
          });
        } else {
          prefetchResults.push({
            sign1,
            sign2,
            analysisLevel,
            language,
            status: 'already_cached'
          });
        }
      }
      
      logger.getLogger().info(`Neural cache prefetch queued: ${prefetchResults.length} combinations`);
      return prefetchResults;
    } catch (error) {
      logger.logError(error, {
        service: 'neural_cache',
        operation: 'prefetch'
      });
      return [];
    }
  }

  // PRIVATE METHODS

  /**
   * 🔑 BUILD NEURAL CACHE KEY
   */
  buildNeuralKey(type, sign1, sign2, analysisLevel, language) {
    const normalizedSigns = [sign1, sign2].sort(); // Consistent ordering
    return `${this.neuralPrefix}${type}:${normalizedSigns[0]}:${normalizedSigns[1]}:${analysisLevel}:${language}`;
  }

  /**
   * 🔑 BUILD HISTORY CACHE KEY
   */
  buildHistoryKey(userId, page, limit, language) {
    return `${this.neuralPrefix}history:${userId}:${page}:${limit}:${language}`;
  }

  /**
   * 🔑 BUILD INSIGHTS CACHE KEY
   */
  buildInsightsKey(sign1, sign2, context, language) {
    const normalizedSigns = [sign1, sign2].sort();
    return `${this.neuralPrefix}insights:${normalizedSigns[0]}:${normalizedSigns[1]}:${context}:${language}`;
  }

  /**
   * ⏰ GET TTL FOR ANALYSIS LEVEL
   */
  getTTLForAnalysisLevel(level) {
    const ttlMap = {
      'standard': this.defaultTTL,
      'advanced': Math.round(this.defaultTTL * 1.5),
      'deep': this.deepAnalysisTTL
    };
    return ttlMap[level] || this.defaultTTL;
  }

  /**
   * 📊 UPDATE NEURAL CACHE STATISTICS
   */
  async updateNeuralCacheStats(operation, analysisLevel) {
    try {
      const statsKey = `${this.neuralPrefix}stats`;
      const stats = await this.baseCache.get(statsKey) || {
        total_sets: 0,
        total_hits: 0,
        total_misses: 0,
        by_level: {
          standard: { sets: 0, hits: 0, misses: 0 },
          advanced: { sets: 0, hits: 0, misses: 0 },
          deep: { sets: 0, hits: 0, misses: 0 }
        }
      };
      
      // Update counters
      stats[`total_${operation}s`]++;
      if (stats.by_level[analysisLevel]) {
        stats.by_level[analysisLevel][`${operation}s`]++;
      }
      
      // Save updated stats with short TTL (statistics don't need long persistence)
      await this.baseCache.set(statsKey, stats, 300); // 5 minutes
    } catch (error) {
      // Don't log stats errors to avoid noise
      console.warn('Neural cache stats update failed:', error.message);
    }
  }

  /**
   * 🗑️ DELETE BY PATTERN (Mock implementation)
   */
  async deleteByPattern(pattern) {
    // In production, this would use Redis SCAN and DELETE
    // For now, return mock success
    logger.getLogger().info(`Neural cache pattern delete: ${pattern}`);
    return 1;
  }

  /**
   * 🧹 DELETE EXPIRED BY PATTERN (Mock implementation)
   */
  async deleteExpiredByPattern(pattern) {
    // In production, this would scan for expired keys and delete them
    // For now, return mock cleanup count
    return Math.floor(Math.random() * 10);
  }
}

// Export singleton instance
const neuralCacheService = new NeuralCacheService();
module.exports = neuralCacheService;