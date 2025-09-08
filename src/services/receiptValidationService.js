const axios = require('axios');
const logger = require('./loggingService');

/**
 * 🏪 APP STORE RECEIPT VALIDATION SERVICE
 * Critical for App Store approval and in-app purchase validation
 */
class ReceiptValidationService {
  constructor() {
    this.sandboxURL = 'https://sandbox.itunes.apple.com/verifyReceipt';
    this.productionURL = 'https://buy.itunes.apple.com/verifyReceipt';
    this.sharedSecret = process.env.APPLE_SHARED_SECRET;
    this.bundleId = process.env.APPLE_BUNDLE_ID || 'com.zodiac.lifecoach';
    
    // Subscription product IDs
    this.subscriptionProducts = {
      monthly: process.env.MONTHLY_SUBSCRIPTION_ID || 'zodiac_monthly_premium',
      yearly: process.env.YEARLY_SUBSCRIPTION_ID || 'zodiac_yearly_premium'
    };
  }

  /**
   * 🔍 VALIDATE RECEIPT WITH APPLE
   * Primary method for validating App Store receipts
   */
  async validateReceipt(receiptData, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.logRequest({
        method: 'RECEIPT_VALIDATION',
        url: 'Apple App Store',
        ip: options.userIP || 'unknown'
      }, null, 0);

      // First try production, then sandbox
      let result = await this._validateWithApple(receiptData, this.productionURL);
      
      // If production fails with status 21007, try sandbox
      if (result.status === 21007) {
        logger.getLogger().info('Receipt is sandbox receipt, trying sandbox validation');
        result = await this._validateWithApple(receiptData, this.sandboxURL);
      }

      const responseTime = Date.now() - startTime;
      
      // Log the validation attempt
      logger.getLogger().info('Receipt validation completed', {
        status: result.status,
        responseTime,
        environment: result.status === 21007 ? 'sandbox' : 'production'
      });

      return this._processValidationResult(result);
      
    } catch (error) {
      logger.logError(error, {
        context: 'receipt_validation',
        receiptDataLength: receiptData ? receiptData.length : 0
      });
      
      return {
        isValid: false,
        error: 'Validation failed',
        message: 'Unable to validate receipt with Apple servers'
      };
    }
  }

  /**
   * 🔄 VALIDATE SUBSCRIPTION STATUS
   * Check if a subscription is currently active
   */
  async validateSubscription(receiptData, productId, options = {}) {
    try {
      const validation = await this.validateReceipt(receiptData, options);
      
      if (!validation.isValid) {
        return {
          isActive: false,
          reason: 'Invalid receipt',
          validation
        };
      }

      const subscription = this._findLatestSubscription(validation.receipt, productId);
      
      if (!subscription) {
        return {
          isActive: false,
          reason: 'Subscription not found',
          productId
        };
      }

      const now = Date.now();
      const expiresDate = parseInt(subscription.expires_date_ms || subscription.expires_date);
      const isActive = expiresDate > now;

      return {
        isActive,
        subscription,
        expiresDate: new Date(expiresDate),
        reason: isActive ? 'Active' : 'Expired',
        validation
      };
      
    } catch (error) {
      logger.logError(error, { context: 'subscription_validation', productId });
      
      return {
        isActive: false,
        reason: 'Validation error',
        error: error.message
      };
    }
  }

  /**
   * 👥 GET USER SUBSCRIPTION STATUS
   * Comprehensive subscription status for a user
   */
  async getUserSubscriptionStatus(receiptData, userId, options = {}) {
    try {
      const validation = await this.validateReceipt(receiptData, options);
      
      if (!validation.isValid) {
        return {
          userId,
          isPremium: false,
          subscriptions: [],
          error: 'Invalid receipt'
        };
      }

      const subscriptions = [];
      const allProducts = Object.values(this.subscriptionProducts);
      
      for (const productId of allProducts) {
        const subStatus = await this.validateSubscription(receiptData, productId, options);
        if (subStatus.subscription) {
          subscriptions.push({
            productId,
            isActive: subStatus.isActive,
            expiresDate: subStatus.expiresDate,
            subscription: subStatus.subscription
          });
        }
      }

      // User is premium if they have at least one active subscription
      const isPremium = subscriptions.some(sub => sub.isActive);
      
      // Find the subscription that expires latest
      const activeSubs = subscriptions.filter(sub => sub.isActive);
      const latestExpiry = activeSubs.reduce((latest, sub) => {
        return !latest || sub.expiresDate > latest ? sub.expiresDate : latest;
      }, null);

      return {
        userId,
        isPremium,
        subscriptions,
        activeSubscriptions: activeSubs.length,
        expiresDate: latestExpiry,
        bundleId: validation.receipt?.bundle_id || this.bundleId
      };
      
    } catch (error) {
      logger.logError(error, { context: 'user_subscription_status', userId });
      
      return {
        userId,
        isPremium: false,
        subscriptions: [],
        error: error.message
      };
    }
  }

  /**
   * 🔄 REFRESH RECEIPT (for auto-renewable subscriptions)
   */
  async refreshReceiptStatus(receiptData, options = {}) {
    try {
      // For auto-renewable subscriptions, we need to check the latest_receipt_info
      const validation = await this.validateReceipt(receiptData, options);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Invalid receipt for refresh'
        };
      }

      const latestReceipts = validation.receipt.latest_receipt_info || [];
      const pendingRenewalInfo = validation.receipt.pending_renewal_info || [];

      return {
        success: true,
        latestReceipts,
        pendingRenewals: pendingRenewalInfo,
        refreshDate: new Date(),
        validation
      };
      
    } catch (error) {
      logger.logError(error, { context: 'receipt_refresh' });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔐 PRIVATE: Validate with Apple servers
   */
  async _validateWithApple(receiptData, url) {
    const payload = {
      'receipt-data': receiptData,
      'password': this.sharedSecret,
      'exclude-old-transactions': true
    };

    const response = await axios.post(url, payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ZodiacLifeCoach/1.0'
      }
    });

    return response.data;
  }

  /**
   * 🔄 PRIVATE: Process validation result from Apple
   */
  _processValidationResult(result) {
    const statusMessages = {
      0: 'Receipt is valid',
      21000: 'The App Store could not read the JSON object you provided',
      21002: 'The data in the receipt-data property was malformed or missing',
      21003: 'The receipt could not be authenticated',
      21004: 'The shared secret you provided does not match the shared secret on file',
      21005: 'The receipt server is not currently available',
      21006: 'This receipt is valid but the subscription has expired',
      21007: 'This receipt is from the sandbox environment',
      21008: 'This receipt is from the production environment',
      21009: 'Internal data access error',
      21010: 'The user account cannot be found or has been deleted'
    };

    const isValid = result.status === 0;
    const message = statusMessages[result.status] || `Unknown status: ${result.status}`;

    return {
      isValid,
      status: result.status,
      message,
      receipt: result.receipt,
      latestReceiptInfo: result.latest_receipt_info,
      pendingRenewalInfo: result.pending_renewal_info,
      environment: result.environment || 'unknown'
    };
  }

  /**
   * 🔍 PRIVATE: Find latest subscription for product
   */
  _findLatestSubscription(receipt, productId) {
    const inAppPurchases = receipt.in_app || [];
    const latestReceipts = receipt.latest_receipt_info || [];
    
    // Combine both arrays and find matching product
    const allTransactions = [...inAppPurchases, ...latestReceipts];
    const productTransactions = allTransactions.filter(item => 
      item.product_id === productId
    );

    if (productTransactions.length === 0) {
      return null;
    }

    // Return the transaction with the latest expiration date
    return productTransactions.reduce((latest, current) => {
      const currentExpires = parseInt(current.expires_date_ms || current.expires_date || 0);
      const latestExpires = parseInt(latest.expires_date_ms || latest.expires_date || 0);
      
      return currentExpires > latestExpires ? current : latest;
    });
  }

  /**
   * 📊 GET SERVICE STATUS
   */
  getStatus() {
    return {
      service: 'ReceiptValidationService',
      configured: !!this.sharedSecret,
      bundleId: this.bundleId,
      subscriptionProducts: this.subscriptionProducts,
      endpoints: {
        production: this.productionURL,
        sandbox: this.sandboxURL
      }
    };
  }

  /**
   * 🧪 TEST CONFIGURATION
   */
  async testConfiguration() {
    try {
      if (!this.sharedSecret) {
        return {
          success: false,
          error: 'Apple shared secret not configured',
          recommendation: 'Set APPLE_SHARED_SECRET environment variable'
        };
      }

      if (!this.bundleId) {
        return {
          success: false,
          error: 'Bundle ID not configured',
          recommendation: 'Set APPLE_BUNDLE_ID environment variable'
        };
      }

      return {
        success: true,
        message: 'Receipt validation service configured correctly',
        config: this.getStatus()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        recommendation: 'Check App Store Connect configuration'
      };
    }
  }
}

module.exports = new ReceiptValidationService();