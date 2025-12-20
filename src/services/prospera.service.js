/**
 * Prospera OAuth Service
 * Handles OAuth 2.0 / OIDC authentication with eProspera platform
 */

const { Issuer, generators } = require('openid-client');

class ProsperapOAuthService {
  constructor() {
    this.client = null;
    this.issuer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the OAuth client with eProspera OIDC configuration
   * This should be called once when the server starts
   */
  async initialize() {
    try {
      console.log('[Prospera OAuth] Initializing...');

      // Check required environment variables
      if (!process.env.EPROSPERA_CLIENT_ID || !process.env.EPROSPERA_CLIENT_SECRET) {
        console.warn('[Prospera OAuth] Missing credentials. Set EPROSPERA_CLIENT_ID and EPROSPERA_CLIENT_SECRET');
        return false;
      }

      // Discover Prospera OIDC configuration
      // Staging: https://staging-portal.eprospera.com
      // Production: https://portal.eprospera.com
      const issuerUrl = process.env.EPROSPERA_ISSUER_URL || 'https://staging-portal.eprospera.com';

      console.log(`[Prospera OAuth] Discovering issuer: ${issuerUrl}`);
      this.issuer = await Issuer.discover(issuerUrl);

      // Create OAuth client
      this.client = new this.issuer.Client({
        client_id: process.env.EPROSPERA_CLIENT_ID,
        client_secret: process.env.EPROSPERA_CLIENT_SECRET,
        redirect_uris: [
          `${process.env.FRONTEND_URL}/lp-portal/login`,
        ],
        response_types: ['code'],
      });

      this.isInitialized = true;
      console.log('[Prospera OAuth] ✓ Initialized successfully');
      console.log(`[Prospera OAuth] Issuer: ${this.issuer.issuer}`);
      console.log(`[Prospera OAuth] Redirect URI: ${process.env.FRONTEND_URL}/lp-portal/login`);

      return true;
    } catch (error) {
      console.error('[Prospera OAuth] Initialization failed:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Generate OAuth authorization URL with PKCE
   * @returns {Object} { authUrl, codeVerifier }
   */
  generateAuthUrl() {
    if (!this.isInitialized || !this.client) {
      throw new Error('Prospera OAuth client not initialized. Call initialize() first.');
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    // Generate nonce for OpenID Connect
    const nonce = generators.nonce();

    // Generate authorization URL
    const authUrl = this.client.authorizationUrl({
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: generators.state(), // CSRF protection
      nonce: nonce, // Required by Prospera for openid scope
    });

    console.log('[Prospera OAuth] Generated auth URL');

    return {
      authUrl,
      codeVerifier,
      nonce, // Return nonce so frontend can store it
    };
  }

  /**
   * Exchange authorization code for tokens and user info
   * @param {string} code - Authorization code from OAuth callback
   * @param {string} codeVerifier - PKCE code verifier
   * @param {string} nonce - Nonce for ID token validation
   * @returns {Object} { accessToken, refreshToken, expiresAt, user }
   */
  async exchangeCode(code, codeVerifier, nonce) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Prospera OAuth client not initialized. Call initialize() first.');
    }

    try {
      console.log('[Prospera OAuth] Exchanging authorization code for tokens...');

      // Exchange code for tokens
      const tokenSet = await this.client.callback(
        `${process.env.FRONTEND_URL}/lp-portal/login`,
        { code },
        { code_verifier: codeVerifier, nonce: nonce }
      );

      console.log('[Prospera OAuth] ✓ Token exchange successful');

      // Get user information
      const userinfo = await this.client.userinfo(tokenSet.access_token);

      console.log('[Prospera OAuth] ✓ User info retrieved');
      console.log('[Prospera OAuth] User email:', userinfo.email);

      return {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at,
        idToken: tokenSet.id_token,
        user: {
          prosperaId: userinfo.sub,
          email: userinfo.email,
          name: userinfo.name || '',
          picture: userinfo.picture || null,
          emailVerified: userinfo.email_verified || false,
        },
      };
    } catch (error) {
      console.error('[Prospera OAuth] Code exchange failed:', error.message);
      throw new Error(`Failed to authenticate with Prospera: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token from previous authentication
   * @returns {Object} { accessToken, refreshToken, expiresAt }
   */
  async refreshToken(refreshToken) {
    if (!this.isInitialized || !this.client) {
      throw new Error('Prospera OAuth client not initialized. Call initialize() first.');
    }

    try {
      console.log('[Prospera OAuth] Refreshing access token...');

      const tokenSet = await this.client.refresh(refreshToken);

      console.log('[Prospera OAuth] ✓ Token refresh successful');

      return {
        accessToken: tokenSet.access_token,
        refreshToken: tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at,
      };
    } catch (error) {
      console.error('[Prospera OAuth] Token refresh failed:', error.message);
      throw new Error(`Failed to refresh Prospera token: ${error.message}`);
    }
  }

  /**
   * Check if the service is ready to use
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.client !== null;
  }
}

// Export singleton instance
module.exports = new ProsperapOAuthService();
