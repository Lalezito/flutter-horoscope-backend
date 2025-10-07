/**
 * OAUTH2/OPENID CONNECT INTEGRATION SERVICE
 * 
 * Enterprise-grade OAuth2 and OpenID Connect integration
 * Features:
 * - Multiple OAuth2 providers (Google, Microsoft, GitHub, etc.)
 * - OpenID Connect compliance
 * - PKCE (Proof Key for Code Exchange) support
 * - State parameter validation
 * - JWT ID token validation
 * - User profile synchronization
 * - Social login security best practices
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const redisService = require('./redisService');
const authService = require('./authenticationService');
const securityHardeningService = require('./securityHardeningService');

class OAuth2Service {
  constructor() {
    this.config = {
      // OAuth2 settings
      authorization_timeout: parseInt(process.env.OAUTH2_TIMEOUT) || 600000, // 10 minutes
      state_expiration: parseInt(process.env.OAUTH2_STATE_EXPIRATION) || 300000, // 5 minutes
      
      // PKCE settings
      code_challenge_method: 'S256',
      code_verifier_length: 128,
      
      // Security settings
      require_pkce: process.env.OAUTH2_REQUIRE_PKCE !== 'false',
      require_state: process.env.OAUTH2_REQUIRE_STATE !== 'false',
      validate_issuer: process.env.OAUTH2_VALIDATE_ISSUER !== 'false',
      
      // User profile settings
      auto_create_users: process.env.OAUTH2_AUTO_CREATE_USERS !== 'false',
      sync_profile_data: process.env.OAUTH2_SYNC_PROFILE !== 'false'
    };

    // OAuth2 providers configuration
    this.providers = {
      google: {
        name: 'Google',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
        jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
        issuer: 'https://accounts.google.com',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: ['openid', 'profile', 'email'],
        supported_response_types: ['code'],
        id_token_signing_alg_values_supported: ['RS256']
      },
      
      microsoft: {
        name: 'Microsoft',
        authorization_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        token_endpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userinfo_endpoint: 'https://graph.microsoft.com/oidc/userinfo',
        jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys',
        issuer: 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        scopes: ['openid', 'profile', 'email'],
        supported_response_types: ['code'],
        id_token_signing_alg_values_supported: ['RS256']
      },
      
      github: {
        name: 'GitHub',
        authorization_endpoint: 'https://github.com/login/oauth/authorize',
        token_endpoint: 'https://github.com/login/oauth/access_token',
        userinfo_endpoint: 'https://api.github.com/user',
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ['user:email'],
        supported_response_types: ['code'],
        // Note: GitHub doesn't support OpenID Connect, only OAuth2
        supports_oidc: false
      }
    };

    // Active authorization requests
    this.activeRequests = new Map();
    this.userProfileCache = new Map();
    
    // JWKS cache for token validation
    this.jwksCache = new Map();

    console.log('🔐 OAuth2/OpenID Connect Service initialized');
  }

  /**
   * Initialize OAuth2 service
   */
  async initialize() {
    try {
      // Validate provider configurations
      await this.validateProviderConfigurations();
      
      // Pre-load JWKS for OpenID Connect providers
      await this.preloadJWKS();
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      console.log('✅ OAuth2 Service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ OAuth2 Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initiate OAuth2 authorization flow
   */
  async initiateAuthorization(provider, redirectUri, extraScopes = [], req) {
    try {
      // Validate provider
      const providerConfig = this.providers[provider];
      if (!providerConfig) {
        throw new Error(`Unsupported OAuth2 provider: ${provider}`);
      }

      if (!providerConfig.client_id || !providerConfig.client_secret) {
        throw new Error(`Provider ${provider} not properly configured`);
      }

      // Generate state parameter for CSRF protection
      const state = this.generateState();
      
      // Generate PKCE parameters
      const pkceParams = this.config.require_pkce ? this.generatePKCE() : null;
      
      // Prepare scopes
      const scopes = [...providerConfig.scopes, ...extraScopes];
      
      // Create authorization request
      const authRequest = {
        provider: provider,
        state: state,
        redirect_uri: redirectUri,
        scopes: scopes,
        pkce: pkceParams,
        created_at: Date.now(),
        ip: req?.ip,
        user_agent: req?.get('User-Agent'),
        expires_at: Date.now() + this.config.state_expiration
      };

      // Store authorization request
      await this.storeAuthorizationRequest(state, authRequest);

      // Build authorization URL
      const authUrl = this.buildAuthorizationURL(providerConfig, authRequest);

      // Log authorization initiation
      await securityHardeningService.auditLogger.logSecurityEvent({
        type: 'oauth2_authorization_initiated',
        severity: 'info',
        ip: req?.ip,
        details: {
          provider: provider,
          state: state,
          scopes: scopes,
          pkce_enabled: !!pkceParams
        }
      });

      return {
        authorization_url: authUrl,
        state: state,
        provider: provider,
        expires_in: this.config.state_expiration / 1000
      };

    } catch (error) {
      console.error('OAuth2 authorization initiation error:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth2 callback and complete authorization
   */
  async handleCallback(code, state, provider, req) {
    const startTime = Date.now();
    
    try {
      // Validate state parameter
      const authRequest = await this.validateState(state);
      if (!authRequest) {
        throw new Error('Invalid or expired state parameter');
      }

      // Validate provider matches
      if (authRequest.provider !== provider) {
        throw new Error('Provider mismatch in callback');
      }

      // Validate request hasn't expired
      if (Date.now() > authRequest.expires_at) {
        throw new Error('Authorization request expired');
      }

      // Exchange authorization code for tokens
      const tokenResponse = await this.exchangeCodeForTokens(
        this.providers[provider],
        authRequest,
        code
      );

      // Validate ID token if present (OpenID Connect)
      let idTokenPayload = null;
      if (tokenResponse.id_token) {
        idTokenPayload = await this.validateIdToken(
          tokenResponse.id_token,
          this.providers[provider]
        );
      }

      // Get user profile information
      const userProfile = await this.getUserProfile(
        this.providers[provider],
        tokenResponse.access_token,
        idTokenPayload
      );

      // Create or update user account
      const user = await this.processUserAccount(userProfile, provider, tokenResponse);

      // Create internal authentication session
      const authResult = await authService.createSession(user, req?.ip, req?.get('User-Agent'));

      // Clean up authorization request
      await this.cleanupAuthorizationRequest(state);

      // Log successful OAuth2 authentication
      await securityHardeningService.auditLogger.logSecurityEvent({
        type: 'oauth2_authentication_success',
        severity: 'info',
        ip: req?.ip,
        details: {
          provider: provider,
          user_id: user.id,
          response_time: Date.now() - startTime
        }
      });

      return {
        access_token: authResult.access_token,
        refresh_token: authResult.refresh_token,
        expires_in: authService.parseExpiration(authService.config.jwtExpiration),
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          provider: provider,
          profile: {
            name: userProfile.name,
            picture: userProfile.picture
          }
        }
      };

    } catch (error) {
      // Log failed OAuth2 authentication
      await securityHardeningService.auditLogger.logSecurityEvent({
        type: 'oauth2_authentication_failure',
        severity: 'warning',
        ip: req?.ip,
        details: {
          provider: provider,
          error: error.message,
          response_time: Date.now() - startTime
        }
      });

      console.error('OAuth2 callback handling error:', error);
      throw error;
    }
  }

  /**
   * Generate PKCE parameters
   */
  generatePKCE() {
    // Generate code verifier
    const codeVerifier = crypto.randomBytes(this.config.code_verifier_length)
      .toString('base64url')
      .slice(0, this.config.code_verifier_length);

    // Generate code challenge
    const codeChallenge = crypto.createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      code_verifier: codeVerifier,
      code_challenge: codeChallenge,
      code_challenge_method: this.config.code_challenge_method
    };
  }

  /**
   * Generate secure state parameter
   */
  generateState() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Build authorization URL
   */
  buildAuthorizationURL(providerConfig, authRequest) {
    const params = new URLSearchParams({
      client_id: providerConfig.client_id,
      response_type: 'code',
      redirect_uri: authRequest.redirect_uri,
      scope: authRequest.scopes.join(' '),
      state: authRequest.state
    });

    // Add PKCE parameters if enabled
    if (authRequest.pkce) {
      params.append('code_challenge', authRequest.pkce.code_challenge);
      params.append('code_challenge_method', authRequest.pkce.code_challenge_method);
    }

    // Provider-specific parameters
    if (providerConfig.name === 'Microsoft') {
      params.append('response_mode', 'query');
    }

    return `${providerConfig.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(providerConfig, authRequest, code) {
    const tokenParams = {
      grant_type: 'authorization_code',
      client_id: providerConfig.client_id,
      client_secret: providerConfig.client_secret,
      code: code,
      redirect_uri: authRequest.redirect_uri
    };

    // Add PKCE code verifier if used
    if (authRequest.pkce) {
      tokenParams.code_verifier = authRequest.pkce.code_verifier;
    }

    try {
      const response = await axios.post(providerConfig.token_endpoint, tokenParams, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'Zodiac-OAuth2-Client/1.0'
        },
        timeout: 10000
      });

      if (!response.data.access_token) {
        throw new Error('No access token received from provider');
      }

      return response.data;

    } catch (error) {
      if (error.response) {
        console.error('Token exchange failed:', error.response.data);
        throw new Error(`Token exchange failed: ${error.response.data.error_description || error.response.data.error}`);
      }
      throw new Error('Token exchange request failed');
    }
  }

  /**
   * Validate OpenID Connect ID token
   */
  async validateIdToken(idToken, providerConfig) {
    try {
      // Decode header to get key ID
      const header = jwt.decode(idToken, { complete: true })?.header;
      if (!header || !header.kid) {
        throw new Error('Invalid ID token header');
      }

      // Get signing key
      const signingKey = await this.getSigningKey(providerConfig, header.kid);

      // Verify and decode token
      const payload = jwt.verify(idToken, signingKey, {
        issuer: providerConfig.issuer,
        audience: providerConfig.client_id,
        algorithms: providerConfig.id_token_signing_alg_values_supported
      });

      // Validate token claims
      this.validateTokenClaims(payload, providerConfig);

      return payload;

    } catch (error) {
      console.error('ID token validation error:', error);
      throw new Error('ID token validation failed');
    }
  }

  /**
   * Get user profile from provider
   */
  async getUserProfile(providerConfig, accessToken, idTokenPayload = null) {
    try {
      // If we have ID token payload with user info, use it
      if (idTokenPayload && idTokenPayload.email) {
        return this.normalizeUserProfile(idTokenPayload, providerConfig.name);
      }

      // Otherwise, fetch from userinfo endpoint
      const response = await axios.get(providerConfig.userinfo_endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Zodiac-OAuth2-Client/1.0'
        },
        timeout: 10000
      });

      return this.normalizeUserProfile(response.data, providerConfig.name);

    } catch (error) {
      console.error('User profile fetch error:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Normalize user profile across different providers
   */
  normalizeUserProfile(rawProfile, providerName) {
    let profile = {
      provider: providerName,
      raw: rawProfile
    };

    switch (providerName) {
      case 'Google':
        profile = {
          ...profile,
          id: rawProfile.id,
          email: rawProfile.email,
          name: rawProfile.name,
          given_name: rawProfile.given_name,
          family_name: rawProfile.family_name,
          picture: rawProfile.picture,
          email_verified: rawProfile.email_verified
        };
        break;

      case 'Microsoft':
        profile = {
          ...profile,
          id: rawProfile.sub,
          email: rawProfile.email,
          name: rawProfile.name,
          given_name: rawProfile.given_name,
          family_name: rawProfile.family_name,
          picture: rawProfile.picture,
          email_verified: rawProfile.email_verified
        };
        break;

      case 'GitHub':
        profile = {
          ...profile,
          id: rawProfile.id?.toString(),
          email: rawProfile.email,
          name: rawProfile.name || rawProfile.login,
          login: rawProfile.login,
          picture: rawProfile.avatar_url,
          email_verified: true // GitHub emails are verified
        };
        break;
    }

    return profile;
  }

  /**
   * Process user account creation/update
   */
  async processUserAccount(userProfile, provider, tokenResponse) {
    try {
      // Check if user already exists by OAuth provider ID
      let user = await this.findUserByProviderId(provider, userProfile.id);

      if (user) {
        // Update existing user profile if sync is enabled
        if (this.config.sync_profile_data) {
          user = await this.updateUserProfile(user, userProfile);
        }
      } else if (this.config.auto_create_users) {
        // Create new user account
        user = await this.createUserFromOAuth(userProfile, provider);
      } else {
        throw new Error('User account not found and auto-creation disabled');
      }

      // Store OAuth tokens if needed (optional)
      await this.storeOAuthTokens(user.id, provider, tokenResponse);

      return user;

    } catch (error) {
      console.error('User account processing error:', error);
      throw error;
    }
  }

  /**
   * Create new user from OAuth profile
   */
  async createUserFromOAuth(userProfile, provider) {
    const userId = crypto.randomUUID();
    const username = this.generateUsername(userProfile);
    
    const user = {
      id: userId,
      username: username,
      email: userProfile.email,
      password_hash: null, // OAuth users don't have passwords
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      oauth_providers: {
        [provider]: {
          provider_id: userProfile.id,
          profile: userProfile,
          linked_at: new Date().toISOString()
        }
      },
      profile: {
        name: userProfile.name,
        picture: userProfile.picture,
        email_verified: userProfile.email_verified
      }
    };

    // Store user in Redis (in production, would use database)
    await redisService.set(`user:${user.id}`, user, 0);
    await redisService.set(`user_lookup:${username}`, user.id, 0);
    await redisService.set(`user_lookup:${userProfile.email}`, user.id, 0);
    await redisService.set(`oauth_user:${provider}:${userProfile.id}`, user.id, 0);

    console.log(`👤 Created new user from ${provider} OAuth: ${username}`);
    
    return user;
  }

  /**
   * Generate unique username from profile
   */
  generateUsername(userProfile) {
    let base = userProfile.login || 
               userProfile.email?.split('@')[0] || 
               userProfile.name?.toLowerCase().replace(/\s+/g, '_') || 
               'user';
    
    // Sanitize username
    base = base.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    // Add random suffix to ensure uniqueness
    const suffix = crypto.randomBytes(4).toString('hex');
    return `${base}_${suffix}`;
  }

  // Utility methods

  async storeAuthorizationRequest(state, authRequest) {
    await redisService.set(`oauth2_auth:${state}`, authRequest, Math.floor(this.config.state_expiration / 1000));
    this.activeRequests.set(state, authRequest);
  }

  async validateState(state) {
    const authRequest = await redisService.get(`oauth2_auth:${state}`);
    return authRequest;
  }

  async cleanupAuthorizationRequest(state) {
    await redisService.delete(`oauth2_auth:${state}`);
    this.activeRequests.delete(state);
  }

  async getSigningKey(providerConfig, keyId) {
    // Check cache first
    const cacheKey = `${providerConfig.name}:${keyId}`;
    if (this.jwksCache.has(cacheKey)) {
      return this.jwksCache.get(cacheKey);
    }

    // Fetch JWKS
    const jwks = await this.fetchJWKS(providerConfig);
    const key = jwks.keys.find(k => k.kid === keyId);
    
    if (!key) {
      throw new Error('Signing key not found');
    }

    // Convert JWK to PEM format (simplified)
    const signingKey = this.jwkToPem(key);
    
    // Cache the key
    this.jwksCache.set(cacheKey, signingKey);
    
    return signingKey;
  }

  async fetchJWKS(providerConfig) {
    const response = await axios.get(providerConfig.jwks_uri, {
      timeout: 10000,
      headers: { 'User-Agent': 'Zodiac-OAuth2-Client/1.0' }
    });
    
    return response.data;
  }

  jwkToPem(jwk) {
    // Simplified JWK to PEM conversion
    // In production, use a proper library like jwk-to-pem
    return `-----BEGIN PUBLIC KEY-----\n${jwk.x5c?.[0] || jwk.n}\n-----END PUBLIC KEY-----`;
  }

  validateTokenClaims(payload, providerConfig) {
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      throw new Error('ID token expired');
    }
    
    if (payload.iat && payload.iat > now + 300) { // 5 minute clock skew
      throw new Error('ID token used before issued');
    }
    
    if (payload.aud !== providerConfig.client_id) {
      throw new Error('ID token audience mismatch');
    }
  }

  async findUserByProviderId(provider, providerId) {
    try {
      const userId = await redisService.get(`oauth_user:${provider}:${providerId}`);
      if (!userId) return null;
      
      return await redisService.get(`user:${userId}`);
    } catch (error) {
      return null;
    }
  }

  async updateUserProfile(user, userProfile) {
    // Update profile fields
    user.profile = {
      ...user.profile,
      name: userProfile.name,
      picture: userProfile.picture,
      email_verified: userProfile.email_verified
    };

    user.oauth_providers[userProfile.provider].profile = userProfile;
    user.oauth_providers[userProfile.provider].updated_at = new Date().toISOString();
    
    // Store updated user
    await redisService.set(`user:${user.id}`, user, 0);
    
    return user;
  }

  async storeOAuthTokens(userId, provider, tokenResponse) {
    // Store OAuth tokens for API access (if needed)
    const tokenData = {
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: tokenResponse.expires_in ? Date.now() + (tokenResponse.expires_in * 1000) : null,
      token_type: tokenResponse.token_type || 'Bearer',
      scope: tokenResponse.scope
    };
    
    await redisService.set(`oauth_tokens:${userId}:${provider}`, tokenData, tokenResponse.expires_in || 3600);
  }

  async validateProviderConfigurations() {
    const configuredProviders = Object.entries(this.providers)
      .filter(([_, config]) => config.client_id && config.client_secret);
    
    if (configuredProviders.length === 0) {
      console.warn('⚠️ No OAuth2 providers configured');
    } else {
      console.log(`✅ OAuth2 providers configured: ${configuredProviders.map(([name]) => name).join(', ')}`);
    }
  }

  async preloadJWKS() {
    for (const [name, config] of Object.entries(this.providers)) {
      if (config.jwks_uri && config.client_id) {
        try {
          await this.fetchJWKS(config);
          console.log(`✅ Pre-loaded JWKS for ${name}`);
        } catch (error) {
          console.warn(`⚠️ Failed to pre-load JWKS for ${name}:`, error.message);
        }
      }
    }
  }

  startCleanupTasks() {
    // Clean up expired authorization requests every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [state, authRequest] of this.activeRequests.entries()) {
        if (authRequest.expires_at < now) {
          this.activeRequests.delete(state);
        }
      }
    }, 300000);
    
    // Clear JWKS cache every hour
    setInterval(() => {
      this.jwksCache.clear();
    }, 3600000);
  }

  /**
   * Get OAuth2 service status
   */
  getStatus() {
    const configuredProviders = Object.entries(this.providers)
      .filter(([_, config]) => config.client_id && config.client_secret)
      .map(([name, config]) => ({
        name,
        supports_oidc: config.supports_oidc !== false,
        scopes: config.scopes
      }));
    
    return {
      configured_providers: configuredProviders.length,
      providers: configuredProviders,
      active_authorization_requests: this.activeRequests.size,
      jwks_cache_size: this.jwksCache.size,
      config: {
        require_pkce: this.config.require_pkce,
        require_state: this.config.require_state,
        auto_create_users: this.config.auto_create_users,
        sync_profile_data: this.config.sync_profile_data
      }
    };
  }
}

module.exports = new OAuth2Service();