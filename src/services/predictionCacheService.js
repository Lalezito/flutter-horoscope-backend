/**
 * PREDICTION CACHE SERVICE
 * 
 * Handles caching and performance optimizations for the prediction system
 * Uses Redis for fast data retrieval and reduces database load
 */

const redisService = require('./redisService');
const moment = require('moment');

class PredictionCacheService {
    constructor() {
        this.config = {
            // Cache durations (in seconds)
            userPredictionsDuration: 900, // 15 minutes
            userAnalyticsDuration: 1800, // 30 minutes
            systemStatsDuration: 3600, // 1 hour
            astrologicalDataDuration: 7200, // 2 hours
            templatesDuration: 86400, // 24 hours
            
            // Cache key prefixes
            keyPrefixes: {
                userPredictions: 'user_predictions',
                userAnalytics: 'user_analytics',
                systemStats: 'system_stats',
                astroData: 'astro_data',
                templates: 'templates',
                firebaseTokens: 'firebase_tokens',
                userPreferences: 'user_prefs'
            },
            
            // Performance settings
            batchSize: 100,
            preloadEnabled: true,
            compressionEnabled: true
        };

        console.log('🚀 Prediction Cache Service initialized');
    }

    /**
     * Cache user's active predictions
     */
    async cacheUserPredictions(userId, predictions) {
        try {
            const cacheKey = this.buildCacheKey('userPredictions', userId);
            const data = {
                predictions,
                cachedAt: moment().toISOString(),
                count: predictions.length
            };

            await redisService.setex(
                cacheKey, 
                this.config.userPredictionsDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached ${predictions.length} predictions for user ${userId}`);

        } catch (error) {
            console.error('❌ Error caching user predictions:', error);
        }
    }

    /**
     * Get cached user predictions
     */
    async getCachedUserPredictions(userId) {
        try {
            const cacheKey = this.buildCacheKey('userPredictions', userId);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached predictions for user ${userId}`);
                return data.predictions;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached user predictions:', error);
            return null;
        }
    }

    /**
     * Cache user analytics data
     */
    async cacheUserAnalytics(userId, analytics) {
        try {
            const cacheKey = this.buildCacheKey('userAnalytics', userId);
            const data = {
                analytics,
                cachedAt: moment().toISOString()
            };

            await redisService.setex(
                cacheKey,
                this.config.userAnalyticsDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached analytics for user ${userId}`);

        } catch (error) {
            console.error('❌ Error caching user analytics:', error);
        }
    }

    /**
     * Get cached user analytics
     */
    async getCachedUserAnalytics(userId) {
        try {
            const cacheKey = this.buildCacheKey('userAnalytics', userId);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached analytics for user ${userId}`);
                return data.analytics;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached user analytics:', error);
            return null;
        }
    }

    /**
     * Cache astrological calculation data
     */
    async cacheAstrologicalData(userId, date, astroData) {
        try {
            const cacheKey = this.buildCacheKey('astroData', `${userId}_${date}`);
            const data = {
                astroData,
                cachedAt: moment().toISOString(),
                date
            };

            await redisService.setex(
                cacheKey,
                this.config.astrologicalDataDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached astrological data for user ${userId} on ${date}`);

        } catch (error) {
            console.error('❌ Error caching astrological data:', error);
        }
    }

    /**
     * Get cached astrological data
     */
    async getCachedAstrologicalData(userId, date) {
        try {
            const cacheKey = this.buildCacheKey('astroData', `${userId}_${date}`);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached astrological data for user ${userId}`);
                return data.astroData;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached astrological data:', error);
            return null;
        }
    }

    /**
     * Cache prediction templates
     */
    async cacheTemplates(category, templates) {
        try {
            const cacheKey = this.buildCacheKey('templates', category);
            const data = {
                templates,
                cachedAt: moment().toISOString(),
                category,
                count: templates.length
            };

            await redisService.setex(
                cacheKey,
                this.config.templatesDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached ${templates.length} templates for category ${category}`);

        } catch (error) {
            console.error('❌ Error caching templates:', error);
        }
    }

    /**
     * Get cached templates
     */
    async getCachedTemplates(category) {
        try {
            const cacheKey = this.buildCacheKey('templates', category);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached templates for category ${category}`);
                return data.templates;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached templates:', error);
            return null;
        }
    }

    /**
     * Cache system statistics
     */
    async cacheSystemStats(timeframe, stats) {
        try {
            const cacheKey = this.buildCacheKey('systemStats', timeframe);
            const data = {
                stats,
                cachedAt: moment().toISOString(),
                timeframe
            };

            await redisService.setex(
                cacheKey,
                this.config.systemStatsDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached system stats for timeframe ${timeframe}`);

        } catch (error) {
            console.error('❌ Error caching system stats:', error);
        }
    }

    /**
     * Get cached system statistics
     */
    async getCachedSystemStats(timeframe) {
        try {
            const cacheKey = this.buildCacheKey('systemStats', timeframe);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached system stats for timeframe ${timeframe}`);
                return data.stats;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached system stats:', error);
            return null;
        }
    }

    /**
     * Cache Firebase token
     */
    async cacheFirebaseToken(userId, token) {
        try {
            const cacheKey = this.buildCacheKey('firebaseTokens', userId);
            
            await redisService.setex(
                cacheKey,
                this.config.userPredictionsDuration,
                token
            );

            console.log(`✅ Cached Firebase token for user ${userId}`);

        } catch (error) {
            console.error('❌ Error caching Firebase token:', error);
        }
    }

    /**
     * Get cached Firebase token
     */
    async getCachedFirebaseToken(userId) {
        try {
            const cacheKey = this.buildCacheKey('firebaseTokens', userId);
            const token = await redisService.get(cacheKey);

            if (token) {
                console.log(`📦 Retrieved cached Firebase token for user ${userId}`);
                return token;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached Firebase token:', error);
            return null;
        }
    }

    /**
     * Cache user preferences
     */
    async cacheUserPreferences(userId, preferences) {
        try {
            const cacheKey = this.buildCacheKey('userPreferences', userId);
            const data = {
                preferences,
                cachedAt: moment().toISOString()
            };

            await redisService.setex(
                cacheKey,
                this.config.userAnalyticsDuration,
                JSON.stringify(data)
            );

            console.log(`✅ Cached preferences for user ${userId}`);

        } catch (error) {
            console.error('❌ Error caching user preferences:', error);
        }
    }

    /**
     * Get cached user preferences
     */
    async getCachedUserPreferences(userId) {
        try {
            const cacheKey = this.buildCacheKey('userPreferences', userId);
            const cachedData = await redisService.get(cacheKey);

            if (cachedData) {
                const data = JSON.parse(cachedData);
                console.log(`📦 Retrieved cached preferences for user ${userId}`);
                return data.preferences;
            }

            return null;

        } catch (error) {
            console.error('❌ Error getting cached user preferences:', error);
            return null;
        }
    }

    /**
     * Invalidate user-specific caches
     */
    async invalidateUserCache(userId) {
        try {
            const keys = [
                this.buildCacheKey('userPredictions', userId),
                this.buildCacheKey('userAnalytics', userId),
                this.buildCacheKey('firebaseTokens', userId),
                this.buildCacheKey('userPreferences', userId)
            ];

            for (const key of keys) {
                await redisService.del(key);
            }

            console.log(`🗑️ Invalidated cache for user ${userId}`);

        } catch (error) {
            console.error('❌ Error invalidating user cache:', error);
        }
    }

    /**
     * Invalidate category-specific template cache
     */
    async invalidateTemplateCache(category) {
        try {
            const cacheKey = this.buildCacheKey('templates', category);
            await redisService.del(cacheKey);

            console.log(`🗑️ Invalidated template cache for category ${category}`);

        } catch (error) {
            console.error('❌ Error invalidating template cache:', error);
        }
    }

    /**
     * Invalidate system statistics cache
     */
    async invalidateSystemStatsCache() {
        try {
            const timeframes = ['7 days', '30 days', '90 days'];
            
            for (const timeframe of timeframes) {
                const cacheKey = this.buildCacheKey('systemStats', timeframe);
                await redisService.del(cacheKey);
            }

            console.log(`🗑️ Invalidated system stats cache`);

        } catch (error) {
            console.error('❌ Error invalidating system stats cache:', error);
        }
    }

    /**
     * Preload popular data for performance
     */
    async preloadPopularData() {
        if (!this.config.preloadEnabled) {
            return;
        }

        try {
            console.log('🔄 Preloading popular prediction data...');

            // Preload templates for popular categories
            const popularCategories = ['love', 'career', 'finance', 'health'];
            
            for (const category of popularCategories) {
                // This would fetch and cache templates
                const cachedTemplates = await this.getCachedTemplates(category);
                if (!cachedTemplates) {
                    console.log(`📥 Preloading templates for ${category}`);
                    // Would call actual template fetching method here
                }
            }

            console.log('✅ Preload completed');

        } catch (error) {
            console.error('❌ Error during preload:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const stats = {
                userPredictions: 0,
                userAnalytics: 0,
                astroData: 0,
                templates: 0,
                firebaseTokens: 0,
                systemStats: 0
            };

            // Count cached entries by scanning keys
            for (const [type, prefix] of Object.entries(this.config.keyPrefixes)) {
                const pattern = `${prefix}:*`;
                const keys = await redisService.keys(pattern);
                
                if (type === 'userPredictions') stats.userPredictions = keys.length;
                else if (type === 'userAnalytics') stats.userAnalytics = keys.length;
                else if (type === 'astroData') stats.astroData = keys.length;
                else if (type === 'templates') stats.templates = keys.length;
                else if (type === 'firebaseTokens') stats.firebaseTokens = keys.length;
                else if (type === 'systemStats') stats.systemStats = keys.length;
            }

            return {
                ...stats,
                totalEntries: Object.values(stats).reduce((sum, count) => sum + count, 0),
                generatedAt: moment().toISOString()
            };

        } catch (error) {
            console.error('❌ Error getting cache stats:', error);
            return null;
        }
    }

    /**
     * Clear all prediction-related caches
     */
    async clearAllPredictionCaches() {
        try {
            console.log('🧹 Clearing all prediction caches...');

            const patterns = Object.values(this.config.keyPrefixes).map(prefix => `${prefix}:*`);
            
            for (const pattern of patterns) {
                const keys = await redisService.keys(pattern);
                
                if (keys.length > 0) {
                    await redisService.del(...keys);
                    console.log(`🗑️ Cleared ${keys.length} keys matching pattern ${pattern}`);
                }
            }

            console.log('✅ All prediction caches cleared');

        } catch (error) {
            console.error('❌ Error clearing caches:', error);
        }
    }

    /**
     * Optimize cache by removing expired entries
     */
    async optimizeCache() {
        try {
            console.log('🔧 Optimizing prediction cache...');

            // Get memory usage before optimization
            const beforeStats = await this.getCacheStats();
            
            // Clear expired entries (Redis handles this automatically, but we can force it)
            const patterns = Object.values(this.config.keyPrefixes).map(prefix => `${prefix}:*`);
            let removedCount = 0;

            for (const pattern of patterns) {
                const keys = await redisService.keys(pattern);
                
                for (const key of keys) {
                    const ttl = await redisService.ttl(key);
                    if (ttl === -2) { // Key doesn't exist
                        removedCount++;
                    }
                }
            }

            const afterStats = await this.getCacheStats();
            
            console.log(`✅ Cache optimization completed. Entries before: ${beforeStats?.totalEntries}, after: ${afterStats?.totalEntries}`);

        } catch (error) {
            console.error('❌ Error optimizing cache:', error);
        }
    }

    // HELPER METHODS

    buildCacheKey(type, identifier) {
        const prefix = this.config.keyPrefixes[type] || type;
        return `${prefix}:${identifier}`;
    }

    /**
     * Batch cache operations for better performance
     */
    async batchCacheOperations(operations) {
        try {
            const batches = this.chunkArray(operations, this.config.batchSize);
            
            for (const batch of batches) {
                const promises = batch.map(op => {
                    switch (op.type) {
                        case 'set':
                            return redisService.setex(op.key, op.duration, op.value);
                        case 'get':
                            return redisService.get(op.key);
                        case 'del':
                            return redisService.del(op.key);
                        default:
                            return Promise.resolve();
                    }
                });

                await Promise.allSettled(promises);
            }

            console.log(`✅ Completed ${operations.length} batch cache operations`);

        } catch (error) {
            console.error('❌ Error in batch cache operations:', error);
        }
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

module.exports = new PredictionCacheService();