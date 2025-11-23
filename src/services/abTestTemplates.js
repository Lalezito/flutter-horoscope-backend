/**
 * A/B Test Templates
 * Pre-configured test templates for common revenue optimization experiments
 */

class ABTestTemplates {
  /**
   * Paywall message test
   */
  static paywallMessage() {
    return {
      name: 'Paywall Message Optimization',
      hypothesis: 'Emotional messaging converts better than logical messaging',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'Logical Message',
          weight: 50,
          config: {
            paywallMessage: 'Upgrade for unlimited access to all features',
            cta: 'Start Free Trial',
            subtext: 'Cancel anytime'
          }
        },
        {
          id: 'emotional',
          name: 'Emotional Message',
          weight: 50,
          config: {
            paywallMessage: 'Your cosmic journey awaits ✨',
            cta: 'Unlock My Full Potential',
            subtext: 'Join thousands of cosmic seekers'
          }
        }
      ],
      metrics: {
        primary: 'conversion_rate',
        secondary: ['revenue_per_user', 'time_to_convert', 'trial_to_paid_rate']
      }
    };
  }

  /**
   * Pricing test
   */
  static pricing(tier = 'cosmic') {
    const pricingOptions = {
      cosmic: [4.99, 5.99, 6.99],
      universe: [9.99, 11.99, 12.99],
      annual: [49.99, 59.99, 69.99]
    };

    const prices = pricingOptions[tier] || pricingOptions.cosmic;

    return {
      name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Pricing Test`,
      hypothesis: 'Optimal price point maximizes revenue without hurting conversions',
      duration: 21, // Longer for pricing tests
      minSampleSize: 1500,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: `$${prices[0]}/month`,
          weight: 34,
          config: {
            price: prices[0],
            tier: tier
          }
        },
        {
          id: 'variant_a',
          name: `$${prices[1]}/month`,
          weight: 33,
          config: {
            price: prices[1],
            tier: tier
          }
        },
        {
          id: 'variant_b',
          name: `$${prices[2]}/month`,
          weight: 33,
          config: {
            price: prices[2],
            tier: tier
          }
        }
      ],
      metrics: {
        primary: 'revenue_per_user',
        secondary: ['conversion_rate', 'total_revenue', 'cart_abandonment_rate']
      }
    };
  }

  /**
   * Free trial length test
   */
  static trialLength() {
    return {
      name: 'Free Trial Length Optimization',
      hypothesis: 'Longer trials increase trial-to-paid conversion',
      duration: 30, // Long enough to see trial conversions
      minSampleSize: 2000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: '7-Day Trial',
          weight: 25,
          config: {
            trialDays: 7,
            creditCardRequired: true
          }
        },
        {
          id: 'variant_a',
          name: '14-Day Trial',
          weight: 25,
          config: {
            trialDays: 14,
            creditCardRequired: true
          }
        },
        {
          id: 'variant_b',
          name: '7-Day No CC',
          weight: 25,
          config: {
            trialDays: 7,
            creditCardRequired: false
          }
        },
        {
          id: 'variant_c',
          name: '14-Day No CC',
          weight: 25,
          config: {
            trialDays: 14,
            creditCardRequired: false
          }
        }
      ],
      metrics: {
        primary: 'trial_to_paid_conversion',
        secondary: ['trial_signup_rate', 'revenue_per_trial', 'cancellation_rate']
      }
    };
  }

  /**
   * Feature access limits test
   */
  static featureLimits() {
    return {
      name: 'Free Tier Feature Limits',
      hypothesis: 'Optimal free tier limits maximize paid conversions',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'Current Limits',
          weight: 34,
          config: {
            dailyMessages: 3,
            compatibilityChecks: 0,
            dailyHoroscopes: 1
          }
        },
        {
          id: 'generous',
          name: 'Generous Free Tier',
          weight: 33,
          config: {
            dailyMessages: 10,
            compatibilityChecks: 1,
            dailyHoroscopes: 3
          }
        },
        {
          id: 'strict',
          name: 'Strict Free Tier',
          weight: 33,
          config: {
            dailyMessages: 1,
            compatibilityChecks: 0,
            dailyHoroscopes: 1
          }
        }
      ],
      metrics: {
        primary: 'conversion_rate',
        secondary: ['engagement_rate', 'feature_usage', 'time_to_upgrade']
      }
    };
  }

  /**
   * CTA button test
   */
  static ctaButton() {
    return {
      name: 'CTA Button Optimization',
      hypothesis: 'Action-oriented CTAs drive more conversions',
      duration: 7,
      minSampleSize: 800,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'Start Free Trial',
          weight: 25,
          config: {
            ctaText: 'Start Free Trial',
            color: '#7C3AED',
            size: 'large'
          }
        },
        {
          id: 'variant_a',
          name: 'Unlock Now',
          weight: 25,
          config: {
            ctaText: 'Unlock Now',
            color: '#7C3AED',
            size: 'large'
          }
        },
        {
          id: 'variant_b',
          name: 'Begin My Journey',
          weight: 25,
          config: {
            ctaText: 'Begin My Journey',
            color: '#7C3AED',
            size: 'large'
          }
        },
        {
          id: 'variant_c',
          name: 'Upgrade to Premium',
          weight: 25,
          config: {
            ctaText: 'Upgrade to Premium',
            color: '#7C3AED',
            size: 'large'
          }
        }
      ],
      metrics: {
        primary: 'click_through_rate',
        secondary: ['conversion_rate', 'time_to_click']
      }
    };
  }

  /**
   * Notification timing test
   */
  static notificationTiming() {
    return {
      name: 'Daily Horoscope Notification Time',
      hypothesis: 'Morning notifications drive highest engagement',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: '8:00 AM',
          weight: 34,
          config: {
            notificationTime: '08:00',
            timezone: 'user_local'
          }
        },
        {
          id: 'midday',
          name: '12:00 PM',
          weight: 33,
          config: {
            notificationTime: '12:00',
            timezone: 'user_local'
          }
        },
        {
          id: 'evening',
          name: '8:00 PM',
          weight: 33,
          config: {
            notificationTime: '20:00',
            timezone: 'user_local'
          }
        }
      ],
      metrics: {
        primary: 'notification_open_rate',
        secondary: ['app_open_rate', 'engagement_rate', 'retention_rate']
      }
    };
  }

  /**
   * Onboarding flow test
   */
  static onboardingFlow() {
    return {
      name: 'Onboarding Flow Optimization',
      hypothesis: 'Shorter onboarding increases completion rate',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'Full Onboarding (5 steps)',
          weight: 50,
          config: {
            steps: ['welcome', 'birth_info', 'interests', 'notifications', 'premium'],
            skipable: false
          }
        },
        {
          id: 'minimal',
          name: 'Minimal Onboarding (2 steps)',
          weight: 50,
          config: {
            steps: ['welcome', 'birth_info'],
            skipable: true
          }
        }
      ],
      metrics: {
        primary: 'onboarding_completion_rate',
        secondary: ['time_to_complete', 'first_week_retention', 'conversion_rate']
      }
    };
  }

  /**
   * Social proof test
   */
  static socialProof() {
    return {
      name: 'Social Proof on Paywall',
      hypothesis: 'Social proof increases trust and conversions',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'No Social Proof',
          weight: 25,
          config: {
            showSocialProof: false
          }
        },
        {
          id: 'user_count',
          name: 'User Count',
          weight: 25,
          config: {
            showSocialProof: true,
            proofType: 'user_count',
            message: 'Join 10,000+ cosmic seekers'
          }
        },
        {
          id: 'rating',
          name: 'Rating',
          weight: 25,
          config: {
            showSocialProof: true,
            proofType: 'rating',
            message: '⭐️ 4.8/5 stars (2,500+ reviews)'
          }
        },
        {
          id: 'testimonial',
          name: 'Testimonial',
          weight: 25,
          config: {
            showSocialProof: true,
            proofType: 'testimonial',
            message: '"This app changed my life!" - Sarah M.'
          }
        }
      ],
      metrics: {
        primary: 'conversion_rate',
        secondary: ['trust_score', 'time_on_paywall']
      }
    };
  }

  /**
   * UI color scheme test
   */
  static colorScheme() {
    return {
      name: 'App Color Scheme',
      hypothesis: 'Different color schemes affect user engagement',
      duration: 7,
      minSampleSize: 800,
      confidenceLevel: 90,
      variants: [
        {
          id: 'control',
          name: 'Purple (Current)',
          weight: 34,
          config: {
            primaryColor: '#7C3AED',
            accentColor: '#A78BFA'
          }
        },
        {
          id: 'blue',
          name: 'Blue',
          weight: 33,
          config: {
            primaryColor: '#3B82F6',
            accentColor: '#60A5FA'
          }
        },
        {
          id: 'gradient',
          name: 'Cosmic Gradient',
          weight: 33,
          config: {
            primaryColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            accentColor: '#A78BFA'
          }
        }
      ],
      metrics: {
        primary: 'engagement_rate',
        secondary: ['session_duration', 'retention_rate', 'conversion_rate']
      }
    };
  }

  /**
   * Discount timing test
   */
  static discountTiming() {
    return {
      name: 'First Purchase Discount Timing',
      hypothesis: 'Immediate discount offer maximizes conversions',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [
        {
          id: 'control',
          name: 'No Discount',
          weight: 25,
          config: {
            hasDiscount: false
          }
        },
        {
          id: 'immediate',
          name: 'Immediate 20% Off',
          weight: 25,
          config: {
            hasDiscount: true,
            discountPercent: 20,
            showTiming: 'immediately'
          }
        },
        {
          id: 'delayed',
          name: '20% Off After 3 Days',
          weight: 25,
          config: {
            hasDiscount: true,
            discountPercent: 20,
            showTiming: 'day_3'
          }
        },
        {
          id: 'exit_intent',
          name: '20% Off on Exit',
          weight: 25,
          config: {
            hasDiscount: true,
            discountPercent: 20,
            showTiming: 'exit_intent'
          }
        }
      ],
      metrics: {
        primary: 'conversion_rate',
        secondary: ['revenue_per_user', 'discount_usage_rate']
      }
    };
  }

  /**
   * Get all templates
   */
  static getAllTemplates() {
    return {
      paywallMessage: this.paywallMessage(),
      pricing: {
        cosmic: this.pricing('cosmic'),
        universe: this.pricing('universe'),
        annual: this.pricing('annual')
      },
      trialLength: this.trialLength(),
      featureLimits: this.featureLimits(),
      ctaButton: this.ctaButton(),
      notificationTiming: this.notificationTiming(),
      onboardingFlow: this.onboardingFlow(),
      socialProof: this.socialProof(),
      colorScheme: this.colorScheme(),
      discountTiming: this.discountTiming()
    };
  }

  /**
   * Get template by name
   */
  static getTemplate(name) {
    const templates = {
      paywallMessage: this.paywallMessage,
      pricingCosmic: () => this.pricing('cosmic'),
      pricingUniverse: () => this.pricing('universe'),
      pricingAnnual: () => this.pricing('annual'),
      trialLength: this.trialLength,
      featureLimits: this.featureLimits,
      ctaButton: this.ctaButton,
      notificationTiming: this.notificationTiming,
      onboardingFlow: this.onboardingFlow,
      socialProof: this.socialProof,
      colorScheme: this.colorScheme,
      discountTiming: this.discountTiming
    };

    const template = templates[name];
    return template ? template() : null;
  }
}

module.exports = ABTestTemplates;
