/**
 * Custom API Routes
 * PoliBit, DiDit KYC, and Smart Contract Deployment endpoints
 */
const express = require('express');
const apiManager = require('../services/apiManager');
const { authenticate, createToken } = require('../middleware/auth');
const {
  catchAsync,
  validate,
  NotFoundError
} = require('../middleware/errorHandler');
const { User, MFAFactor } = require('../models/supabase');
const { getSupabase } = require('../config/database');

const router = express.Router();


// ===== LOGIN API ENDPOINTS =====

router.post('/login', catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  validate({email, password}, 'email and password are required to login');

  // Authenticate with Supabase Auth
  const supabase = getSupabase();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError || !authData.user) {
    console.error('Supabase Auth Error:', authError);
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      debug: process.env.NODE_ENV === 'development' ? authError?.message : undefined
    });
  }

  // Check if MFA is required (user exists but no session)
  if (authData.user && !authData.session) {
    return res.status(200).json({
      success: true,
      mfaRequired: true,
      message: 'MFA verification required',
      userId: authData.user.id
    });
  }

  // Check if user exists in users table
  const user = await User.findById(authData.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found in system. Please contact administrator.'
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Account has been deactivated'
    });
  }

  // Update last login
  const updatedUser = await User.findByIdAndUpdate(user.id, {
    lastLogin: new Date()
  });

  // Create JWT token with user data
  const token = createToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    expiresIn: '24h',
    // Include Supabase session for MFA and other Supabase features
    supabase: {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresIn: authData.session.expires_in,
      expiresAt: authData.session.expires_at
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      appLanguage: user.appLanguage,
      profileImage: user.profileImage,
      role: user.role,
      lastLogin: updatedUser.lastLogin,
      kycId: user.kycId,
      kycStatus: user.kycStatus,
      kycUrl: user.kycUrl,
      address: user.address,
      country: user.country
    }
  });
}));


// ===== MFA ENDPOINTS =====

/**
 * @route   POST /api/custom/mfa/enroll
 * @desc    Enroll user in MFA (generate QR code)
 * @access  Private
 * @body    {
 *            supabaseAccessToken: string - Supabase access token from login
 *            supabaseRefreshToken: string - Supabase refresh token from login
 *            factorType?: 'totp' (default) - Type of MFA (totp for authenticator apps)
 *            friendlyName?: string - Name for this MFA factor
 *          }
 */
router.post('/mfa/enroll', authenticate, catchAsync(async (req, res) => {
  const { id: userId } = req.user;
  const {
    factorType = 'totp',
    friendlyName,
    supabaseAccessToken: bodyAccessToken,
    supabaseRefreshToken: bodyRefreshToken
  } = req.body || {};

  // Get Supabase tokens from body or headers
  const supabaseAccessToken = bodyAccessToken || req.headers['x-supabase-access-token'];
  const supabaseRefreshToken = bodyRefreshToken || req.headers['x-supabase-refresh-token'];

  // Validate required Supabase tokens
  if (!supabaseAccessToken || !supabaseRefreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Supabase access and refresh tokens are required for MFA enrollment',
      hint: 'Send both supabaseAccessToken and supabaseRefreshToken in request body. Get them from login response: supabase.accessToken and supabase.refreshToken',
      note: 'These are different from your JWT Bearer token',
      missing: {
        accessToken: !supabaseAccessToken,
        refreshToken: !supabaseRefreshToken
      }
    });
  }

  // Validate factorType if provided
  const validFactorTypes = ['totp'];
  const wasFactorTypeProvided = req.body && req.body.factorType !== undefined;

  if (wasFactorTypeProvided && !validFactorTypes.includes(factorType)) {
    return res.status(400).json({
      success: false,
      message: `Invalid factorType. Supported types: ${validFactorTypes.join(', ')}. Defaults to 'totp' if not specified.`
    });
  }

  const supabase = getSupabase();

  // Set the Supabase session for MFA operations
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: supabaseAccessToken,
    refresh_token: supabaseRefreshToken
  });

  if (sessionError || !sessionData.session) {
    console.error('Session error:', sessionError);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired Supabase session',
      hint: 'Please login again to get fresh tokens',
      error: sessionError?.message || 'Session not established',
      debug: process.env.NODE_ENV === 'development' ? {
        hasAccessToken: !!supabaseAccessToken,
        hasRefreshToken: !!supabaseRefreshToken,
        sessionError: sessionError?.message
      } : undefined
    });
  }

  // Enroll in MFA with Supabase Auth
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType,
    friendlyName: friendlyName || 'Authenticator App'
  });

  if (error) {
    console.error('MFA enrollment error:', error);

    // Provide user-friendly error messages
    let userMessage = 'Failed to enroll in MFA';
    if (error.message.includes('missing sub claim')) {
      userMessage = 'Authentication session expired. Please login again to enroll in MFA.';
    } else if (error.message.includes('already enrolled')) {
      userMessage = 'You are already enrolled in MFA. Please unenroll first to re-enroll.';
    }

    return res.status(400).json({
      success: false,
      message: userMessage,
      error: error.message
    });
  }

  // Save MFA factor to database
  await MFAFactor.upsert({
    userId,
    factorId: data.id,
    factorType,
    friendlyName: friendlyName || 'Authenticator App',
    isActive: true,
    enrolledAt: new Date().toISOString()
  });

  res.status(200).json({
    success: true,
    message: `MFA enrollment initiated using ${factorType.toUpperCase()}. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.).`,
    info: !wasFactorTypeProvided ? 'Using default factorType: totp' : undefined,
    data: {
      factorId: data.id,
      factorType: factorType,
      qrCode: data.totp.qr_code, // QR code as SVG or URL
      secret: data.totp.secret, // Secret key for manual entry
      uri: data.totp.uri // otpauth:// URI
    }
  });
}));

/**
 * @route   POST /api/custom/mfa/verify
 * @desc    Verify MFA code and complete enrollment or login
 * @access  Public (for login)
 * @body    {
 *            userId: string - User ID (from login response when mfaRequired: true)
 *            code: string - 6-digit verification code from authenticator app
 *            factorType?: 'totp' - Type of MFA factor (default: 'totp')
 *          }
 */
router.post('/mfa/verify', catchAsync(async (req, res) => {
  const { userId, code, factorType = 'totp' } = req.body || {};

  // Validate required fields
  if (!userId || !code) {
    return res.status(400).json({
      success: false,
      message: 'User ID and verification code are required',
      hint: 'Get userId from login response when mfaRequired is true'
    });
  }

  // Get the user's active MFA factor from database
  const factors = await MFAFactor.findByUserId(userId, true);
  const factor = factors.find(f => f.factorType === factorType);

  if (!factor) {
    return res.status(404).json({
      success: false,
      message: 'No active MFA factor found for this user',
      hint: 'User needs to enroll in MFA first'
    });
  }

  const factorId = factor.factorId;
  const supabase = getSupabase();

  // Verify the MFA code
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Failed to create MFA challenge',
      error: error.message
    });
  }

  // Verify the challenge with the code
  const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: data.id,
    code
  });

  if (verifyError) {
    return res.status(400).json({
      success: false,
      message: 'Invalid verification code',
      error: verifyError.message
    });
  }

  // Update last used timestamp in our database
  try {
    await MFAFactor.updateLastUsed(factorId);
  } catch (updateError) {
    console.error('Failed to update MFA last used:', updateError);
    // Don't fail the request if this fails
  }

  // Get user details for response
  const user = await User.findById(userId);

  // Create JWT token
  const token = createToken({
    id: user.id,
    email: user.email,
    role: user.role
  });

  res.status(200).json({
    success: true,
    message: 'MFA verification successful',
    token,
    expiresIn: '24h',
    supabase: {
      accessToken: verifyData.access_token,
      refreshToken: verifyData.refresh_token,
      expiresIn: verifyData.expires_in,
      expiresAt: verifyData.expires_at
    },
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      kycId: user.kycId,
      kycStatus: user.kycStatus,
      kycUrl: user.kycUrl,
      address: user.address,
      country: user.country
    }
  });
}));

/**
 * @route   POST /api/custom/mfa/unenroll
 * @desc    Remove MFA from user account
 * @access  Private
 * @body    {
 *            supabaseAccessToken: string - Supabase access token from login
 *            supabaseRefreshToken: string - Supabase refresh token from login
 *            factorId?: string - Optional, will auto-retrieve if not provided
 *            factorType?: 'totp' - Type of MFA to remove (default: 'totp')
 *          }
 */
router.post('/mfa/unenroll', authenticate, catchAsync(async (req, res) => {
  const { id: userId } = req.user;
  const {
    factorId,
    factorType = 'totp',
    supabaseAccessToken: bodyAccessToken,
    supabaseRefreshToken: bodyRefreshToken
  } = req.body || {};

  // Get Supabase tokens from body or headers
  const supabaseAccessToken = bodyAccessToken || req.headers['x-supabase-access-token'];
  const supabaseRefreshToken = bodyRefreshToken || req.headers['x-supabase-refresh-token'];

  // Validate required Supabase tokens
  if (!supabaseAccessToken || !supabaseRefreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Supabase access and refresh tokens are required for MFA unenrollment',
      hint: 'Send both supabaseAccessToken and supabaseRefreshToken in request body',
      missing: {
        accessToken: !supabaseAccessToken,
        refreshToken: !supabaseRefreshToken
      }
    });
  }

  let factorIdToRemove = factorId;

  // If factorId not provided, get it from database based on user and type
  if (!factorIdToRemove) {
    const factors = await MFAFactor.findByUserId(userId, true); // active only
    const factor = factors.find(f => f.factorType === factorType);

    if (!factor) {
      return res.status(404).json({
        success: false,
        message: 'No active MFA factor found for this user'
      });
    }

    factorIdToRemove = factor.factorId;
  }

  const supabase = getSupabase();

  // Set the Supabase session for MFA operations
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: supabaseAccessToken,
    refresh_token: supabaseRefreshToken
  });

  if (sessionError || !sessionData.session) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired Supabase session',
      hint: 'Please login again to get fresh tokens',
      error: sessionError?.message || 'Session not established'
    });
  }

  // Unenroll from Supabase Auth
  const { data, error } = await supabase.auth.mfa.unenroll({
    factorId: factorIdToRemove
  });

  if (error) {
    console.error('MFA unenrollment error:', error);
    return res.status(400).json({
      success: false,
      message: 'Failed to unenroll from MFA',
      error: error.message
    });
  }

  // Remove from our database
  await MFAFactor.delete(factorIdToRemove);

  res.status(200).json({
    success: true,
    message: 'MFA removed successfully',
    data
  });
}));

/**
 * @route   GET /api/custom/mfa/status
 * @desc    Get user's MFA enrollment status
 * @access  Private
 */
router.get('/mfa/status', authenticate, catchAsync(async (req, res) => {
  const { id: userId } = req.user;

  // Check if user has active MFA
  const hasActiveMFA = await MFAFactor.hasActiveMFA(userId);

  // Get all active factors
  const activeFactors = await MFAFactor.findByUserId(userId, true);

  res.status(200).json({
    success: true,
    data: {
      mfaEnabled: hasActiveMFA,
      factorCount: activeFactors.length,
      factors: activeFactors.map(factor => ({
        id: factor.id,
        factorType: factor.factorType,
        friendlyName: factor.friendlyName,
        enrolledAt: factor.enrolledAt,
        lastUsedAt: factor.lastUsedAt
      }))
    }
  });
}));

/**
 * @route   GET /api/custom/mfa/factors
 * @desc    Get list of enrolled MFA factors for user
 * @access  Private
 */
router.get('/mfa/factors', authenticate, catchAsync(async (req, res) => {
  const { id: userId } = req.user;
  const { activeOnly = true } = req.query;

  // Get factors from our database
  const factors = await MFAFactor.findByUserId(userId, activeOnly === 'true');

  res.status(200).json({
    success: true,
    count: factors.length,
    data: factors
  });
}));

// ===== DIDIT KYC API =====

/**
 * @route   POST /api/custom/didit/token
 * @desc    Get DiDit authentication token
 * @access  Public
 * @body    {} (uses env credentials)
 */
router.post('/didit/token', authenticate, catchAsync(async (req, res) => {
  const context = { auth: req.auth };
  const result = await apiManager.getDiditToken(context, req.body);

  if (result.error) {
    return res.status(result.statusCode || 500).json({
      error: result.error,
      message: 'Failed to get DiDit token',
      details: result.body,
    });
  }

  res.status(result.statusCode || 200).json({
    success: true,
    message: 'Token generated successfully',
    data: result.body,
  });
}));

/**
 * @route   POST /api/custom/didit/session
 * @desc    Create a new DiDit KYC verification session or retrieve existing one
 * @access  Private (requires authentication)
 * @body    {
 *            callback?: string (optional, default: from env or https://cdmxhomes.polibit.io/marketplace),
 *            features?: string (optional, default: from env or "OCR + FACE"),
 *            vendorData?: string (optional, default: from env or "CDMXHomes")
 *          }
 */
router.post('/didit/session', authenticate, catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Find the user to check if they already have a KYC session
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const context = { auth: req.auth };

  // Get DiDit authentication token
  const tokenResult = await apiManager.getDiditToken(context, {});

  if (tokenResult.error) {
    return res.status(tokenResult.statusCode || 500).json({
      error: 'Failed to get DiDit authentication token',
      details: tokenResult.error,
    });
  }

  const token = tokenResult.body.access_token;

  // If user already has a kyc_id, retrieve the existing session
  if (user.kycId) {
    const variables = {
      sessionID: user.kycId,
      token
    };

    const result = await apiManager.getDiditSession(context, variables);

    if (result.error) {
      return res.status(result.statusCode || 500).json({
        error: result.error,
        message: 'Failed to retrieve existing DiDit session',
        details: result.body,
      });
    }

    // Update user's kycStatus with the latest status from DiDit
    const sessionData = result.body;
    if (sessionData.status) {
      await User.findByIdAndUpdate(userId, {
        kycStatus: sessionData.status
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Existing KYC session retrieved',
      existingSession: true,
      data: sessionData,
    });
  }

  // No existing session, create a new one
  const result = await apiManager.createDiditSession(context, {
    token,
    ...req.body
  });

  if (result.error) {
    return res.status(result.statusCode || 500).json({
      error: result.error,
      message: 'Failed to create DiDit session',
      details: result.body,
    });
  }

  // Save session data to user profile
  const sessionData = result.body;
  await User.findByIdAndUpdate(userId, {
    kycId: sessionData.session_id,
    kycStatus: sessionData.status,
    kycUrl: sessionData.url
  });

  res.status(result.statusCode || 201).json({
    success: true,
    message: 'KYC session created successfully',
    existingSession: false,
    data: sessionData,
  });
}));

/**
 * @route   GET /api/custom/didit/session/:sessionId
 * @desc    Get DiDit session decision/status
 * @access  Private (requires authentication)
 * @params  sessionId - The DiDit session ID
 */
router.get('/didit/session/:sessionId', authenticate, catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;
  const { sessionId } = req.params;

  validate(sessionId, 'sessionId is required');

  const context = { auth: req.auth };

  // Get DiDit authentication token
  const tokenResult = await apiManager.getDiditToken(context, {});

  if (tokenResult.error) {
    return res.status(tokenResult.statusCode || 500).json({
      error: 'Failed to get DiDit authentication token',
      details: tokenResult.error,
    });
  }

  const token = tokenResult.body.access_token;

  const variables = {
    sessionID: sessionId,
    token
  };

  const result = await apiManager.getDiditSession(context, variables);

  if (result.error) {
    if (result.statusCode === 404) {
      throw new NotFoundError(`DiDit session with ID ${sessionId} not found`);
    }

    return res.status(result.statusCode || 500).json({
      error: result.error,
      message: 'Failed to fetch DiDit session',
      details: result.body,
    });
  }

  // Update user's kycStatus with the latest status from DiDit
  const sessionData = result.body;
  if (sessionData.status) {
    await User.findByIdAndUpdate(userId, {
      kycStatus: sessionData.status
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Existing KYC session retrieved',
    sessionId,
    data: sessionData,
  });
}));

/**
 * @route   GET /api/custom/didit/session/:sessionId/pdf
 * @desc    Get DiDit session PDF report
 * @access  Public
 * @params  sessionId - The DiDit session ID
 * @query   token: string (required - DiDit auth token)
 */
router.get('/didit/session/:sessionId/pdf', authenticate, catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { token } = req.query;

  validate(sessionId, 'sessionId is required');
  validate(token, 'DiDit token is required');

  const context = { auth: req.auth };
  const variables = { 
    ...req.query, 
    sessionID: sessionId,
    token 
  };

  const result = await apiManager.getDiditPDF(context, variables);

  if (result.error) {
    if (result.statusCode === 404) {
      throw new NotFoundError(`PDF for session ${sessionId} not found`);
    }
    
    return res.status(result.statusCode || 500).json({
      error: result.error,
      message: 'Failed to fetch DiDit PDF',
      details: result.body,
    });
  }

  res.status(result.statusCode || 200).json({
    success: true,
    sessionId,
    data: result.body,
  });
}));

/**
 * @route   POST /api/custom/didit/verify
 * @desc    Complete DiDit KYC verification flow (token + session + decision)
 * @access  Public
 * @body    {
 *            callback?: string,
 *            features?: string,
 *            vendorData?: string
 *          }
 */
router.post('/didit/verify', authenticate, catchAsync(async (req, res) => {
  const context = { auth: req.auth };

  // Step 1: Get token
  const tokenResult = await apiManager.getDiditToken(context, {});
  
  if (tokenResult.error) {
    return res.status(tokenResult.statusCode || 500).json({
      error: 'Failed to get authentication token',
      details: tokenResult.error,
    });
  }

  const token = tokenResult.body.access_token;

  // Step 2: Create session
  const sessionResult = await apiManager.createDiditSession(context, { 
    token,
    ...req.body 
  });

  if (sessionResult.error) {
    return res.status(sessionResult.statusCode || 500).json({
      error: 'Failed to create verification session',
      details: sessionResult.error,
    });
  }

  const sessionData = sessionResult.body;

  res.status(201).json({
    success: true,
    message: 'KYC verification session created',
    data: {
      sessionId: sessionData.session_id,
      verificationUrl: sessionData.url,
      token: token,
      expiresIn: tokenResult.body.expires_in,
    },
  });
}));

/**
 * @route   GET /api/custom/health
 * @desc    Health check for Custom API routes
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    service: 'Custom APIs',
    services: {
      polibit: 'operational',
      didit: 'operational',
      contractDeployment: 'operational',
    },
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;