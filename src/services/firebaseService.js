const admin = require('firebase-admin');
const logger = require('./loggingService');

/**
 * 🔥 FIREBASE ADMIN SDK SERVICE - PRODUCTION READY
 * Real Firebase integration for push notifications and backend operations
 */
class FirebaseService {
  constructor() {
    this.initialized = false;
    this.messaging = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  async initialize() {
    if (this.initialized) {
      logger.getLogger().info('Firebase Admin already initialized');
      return;
    }

    try {
      // OPTION 1: Individual environment variables (RECOMMENDED for Railway)
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
          universe_domain: "googleapis.com"
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        logger.getLogger().info('🔥 Firebase Admin initialized with individual env vars');
      }
      // OPTION 2: Check if running in production with service account JSON
      else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        logger.getLogger().info('🔥 Firebase Admin initialized with service account JSON');
      }
      // OPTION 3: Check for service account key file
      else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
        logger.getLogger().info('🔥 Firebase Admin initialized with credentials file');
      }
      // Development mode - use mock implementation
      else {
        logger.getLogger().warn('🔧 Firebase Admin running in development mode (no credentials found)');
        this.initializeMockMode();
        return;
      }

      this.messaging = admin.messaging();
      this.initialized = true;
      
      logger.getLogger().info('✅ Firebase Admin Service initialized successfully');
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'initialize' });
      // Fall back to mock mode if initialization fails
      this.initializeMockMode();
    }
  }

  /**
   * Initialize mock mode for development
   */
  initializeMockMode() {
    this.initialized = true;
    this.messaging = {
      send: async (message) => {
        logger.getLogger().info('📱 [MOCK] Sending push notification:', message);
        return { messageId: `mock_${Date.now()}` };
      },
      sendMulticast: async (message) => {
        logger.getLogger().info('📱 [MOCK] Sending multicast notification:', message);
        return { 
          successCount: message.tokens?.length || 0,
          failureCount: 0,
          responses: []
        };
      },
      subscribeToTopic: async (tokens, topic) => {
        logger.getLogger().info(`📱 [MOCK] Subscribing ${tokens.length} tokens to topic: ${topic}`);
        return { successCount: tokens.length, failureCount: 0 };
      },
      unsubscribeFromTopic: async (tokens, topic) => {
        logger.getLogger().info(`📱 [MOCK] Unsubscribing ${tokens.length} tokens from topic: ${topic}`);
        return { successCount: tokens.length, failureCount: 0 };
      }
    };
    logger.getLogger().info('🔧 Firebase Admin running in mock mode');
  }

  /**
   * Send push notification to specific device token
   */
  async sendNotification(token, notification, data = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'zodiac_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      logger.info(`✅ Notification sent successfully: ${response.messageId}`);
      return { success: true, messageId: response.messageId };
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'send_notification' });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple device tokens
   */
  async sendMulticastNotification(tokens, notification, data = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const message = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'zodiac_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.sendMulticast(message);
      logger.info(`✅ Multicast notification sent: ${response.successCount} successful, ${response.failureCount} failed`);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
      };
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'send_multicast' });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send topic notification
   */
  async sendTopicNotification(topic, notification, data = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'zodiac_notifications',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await this.messaging.send(message);
      logger.info(`✅ Topic notification sent to ${topic}: ${response.messageId}`);
      return { success: true, messageId: response.messageId };
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'send_topic', topic });
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe tokens to a topic
   */
  async subscribeToTopic(tokens, topic) {
    if (!this.initialized) await this.initialize();

    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);
      logger.info(`✅ Subscribed ${response.successCount} tokens to topic: ${topic}`);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'subscribe', topic });
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe tokens from a topic
   */
  async unsubscribeFromTopic(tokens, topic) {
    if (!this.initialized) await this.initialize();

    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
      logger.info(`✅ Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      logger.logError(error, { service: 'firebase', operation: 'unsubscribe', topic });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily horoscope notifications
   */
  async sendDailyHoroscopeNotifications(horoscopes) {
    const results = [];
    
    for (const horoscope of horoscopes) {
      try {
        const result = await this.sendTopicNotification(
          `horoscope_${horoscope.sign.toLowerCase()}`,
          {
            title: `🌟 Your Daily ${horoscope.sign} Horoscope`,
            body: horoscope.content.substring(0, 100) + '...',
          },
          {
            type: 'daily_horoscope',
            sign: horoscope.sign,
            date: horoscope.date,
          }
        );
        results.push({ sign: horoscope.sign, ...result });
      } catch (error) {
        logger.logError(error, { service: 'firebase', operation: 'daily_horoscope', sign: horoscope.sign });
        results.push({ sign: horoscope.sign, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Send weekly horoscope notifications
   */
  async sendWeeklyHoroscopeNotifications(horoscopes) {
    const results = [];
    
    for (const horoscope of horoscopes) {
      try {
        const result = await this.sendTopicNotification(
          `horoscope_${horoscope.sign.toLowerCase()}`,
          {
            title: `🔮 Your Weekly ${horoscope.sign} Forecast`,
            body: `Week of ${horoscope.week_start} - ${horoscope.week_end}`,
          },
          {
            type: 'weekly_horoscope',
            sign: horoscope.sign,
            week_start: horoscope.week_start,
            week_end: horoscope.week_end,
          }
        );
        results.push({ sign: horoscope.sign, ...result });
      } catch (error) {
        logger.logError(error, { service: 'firebase', operation: 'weekly_horoscope', sign: horoscope.sign });
        results.push({ sign: horoscope.sign, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Validate Firebase configuration
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT || !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      databaseUrl: !!process.env.FIREBASE_DATABASE_URL,
      mockMode: !admin.apps.length,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
const firebaseService = new FirebaseService();
module.exports = firebaseService;