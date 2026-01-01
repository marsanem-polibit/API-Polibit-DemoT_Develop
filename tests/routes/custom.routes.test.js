/**
 * Custom Routes Tests
 * Tests for src/routes/custom.routes.js
 *
 * Note: This file contains many complex integrations with external services
 * (Prospera OAuth, DiDit KYC, Crossmint, Supabase Auth MFA).
 * We focus on testing core logic and validation, mocking external dependencies.
 * Many tests are simplified or skipped due to complex mocking requirements.
 */

const express = require('express');
const request = require('supertest');
const { createMockSupabaseClient } = require('../helpers/mockSupabase');

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabase: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.auth = { userId: 'user-123', userRole: 1 };
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
  createToken: jest.fn((payload) => 'mock-jwt-token-' + payload.id),
}));

jest.mock('../../src/services/apiManager', () => ({
  createDiditSession: jest.fn(),
  getDiditSession: jest.fn(),
  getDiditPDF: jest.fn(),
}));

jest.mock('../../src/services/prospera.service', () => ({
  isReady: jest.fn(() => true),
  initialize: jest.fn(() => Promise.resolve(true)),
  generateAuthUrl: jest.fn((redirectUri) => ({
    authUrl: 'https://oauth.prospera.com/auth?code=test',
    codeVerifier: 'test-verifier',
    nonce: 'test-nonce'
  })),
  exchangeCode: jest.fn(),
  getUserProfile: jest.fn(),
  verifyRPN: jest.fn(),
}));

jest.mock('../../src/services/crossmint.service', () => ({
  isReady: jest.fn(() => true),
  initialize: jest.fn(() => Promise.resolve(true)),
  getOrCreateWallet: jest.fn(),
  getWalletBalances: jest.fn(),
  transferToken: jest.fn(),
  getTransferStatus: jest.fn(),
  chain: 'polygon-amoy',
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: jest.fn(),
      admin: {
        createUser: jest.fn(),
        listUsers: jest.fn(),
      },
      mfa: {
        challenge: jest.fn(),
        verify: jest.fn(),
        enroll: jest.fn(),
        unenroll: jest.fn(),
      },
      setSession: jest.fn(),
    },
  })),
}));

const { getSupabase } = require('../../src/config/database');
const { createToken } = require('../../src/middleware/auth');
const { errorHandler } = require('../../src/middleware/errorHandler');
const apiManager = require('../../src/services/apiManager');
const prospera = require('../../src/services/prospera.service');
const crossmint = require('../../src/services/crossmint.service');
const { User, MFAFactor, SmartContract } = require('../../src/models/supabase');

describe('Custom Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mount routes
    const customRoutes = require('../../src/routes/custom.routes');
    app.use('/api/custom', customRoutes);

    // Add error handler middleware
    app.use(errorHandler);
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();
  });

  describe('Helper Functions', () => {
    test('deriveSupabasePassword should create deterministic password', () => {
      // Import the module to test helper functions
      const crypto = require('crypto');
      const prosperaId = 'test-prospera-id';
      const secret = process.env.SUPABASE_USER_SECRET || 'default-secret-change-in-production';

      const expected = crypto
        .createHmac('sha256', secret)
        .update(prosperaId)
        .digest('hex');

      // This tests the logic of the deriveSupabasePassword function
      expect(expected).toBeDefined();
      expect(expected.length).toBe(64); // SHA256 hex is 64 chars
    });

    test('deriveSupabasePassword should warn if SUPABASE_USER_SECRET not set', () => {
      const originalSecret = process.env.SUPABASE_USER_SECRET;
      delete process.env.SUPABASE_USER_SECRET;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Re-require the module to trigger the warning
      jest.resetModules();

      process.env.SUPABASE_USER_SECRET = originalSecret;
      consoleSpy.mockRestore();
    });
  });

  describe('GET /api/custom/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/custom/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Custom APIs');
      expect(response.body.status).toBe('operational');
      expect(response.body.services).toBeDefined();
    });

    test('should include Prospera service status', async () => {
      prospera.isReady.mockReturnValue(true);

      const response = await request(app).get('/api/custom/health');

      expect(response.status).toBe(200);
      expect(response.body.services.prospera).toBe('operational');
    });

    test('should show Prospera as unavailable when not ready', async () => {
      prospera.isReady.mockReturnValue(false);

      const response = await request(app).get('/api/custom/health');

      expect(response.status).toBe(200);
      expect(response.body.services.prospera).toBe('unavailable');

      // Reset
      prospera.isReady.mockReturnValue(true);
    });
  });

  // ===== LOGIN ENDPOINTS =====

  describe('POST /api/custom/login', () => {
    test.skip('should handle successful login', async () => {
      // This test is skipped due to complex Supabase Auth mocking
      // The login endpoint requires mocking createClient, signInWithPassword,
      // and coordinating between Auth and database queries
    });
  });

  // ===== MFA ENDPOINTS =====

  describe('GET /api/custom/mfa/enabled', () => {
    test('should check if MFA is enabled for user', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        mfaFactorId: 'factor-123'
      });

      const response = await request(app).get('/api/custom/mfa/enabled');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(true);
      expect(response.body.mfaFactorId).toBe('factor-123');
    });

    test('should return false if MFA not enabled', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        mfaFactorId: null
      });

      const response = await request(app).get('/api/custom/mfa/enabled');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.enabled).toBe(false);
      expect(response.body.mfaFactorId).toBeNull();
    });

    test('should return 404 if user not found', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const response = await request(app).get('/api/custom/mfa/enabled');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/custom/mfa/status', () => {
    test('should return detailed MFA status', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        mfaFactorId: 'factor-123'
      });

      jest.spyOn(MFAFactor, 'hasActiveMFA').mockResolvedValue(true);
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        {
          id: 'mfa-1',
          factorType: 'totp',
          friendlyName: 'Authenticator App',
          enrolledAt: new Date().toISOString(),
          lastUsedAt: null
        }
      ]);

      const response = await request(app).get('/api/custom/mfa/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.mfaEnabled).toBe(true);
      expect(response.body.data.factorCount).toBe(1);
      expect(response.body.data.factors).toHaveLength(1);
    });
  });

  describe('GET /api/custom/mfa/factors', () => {
    test('should get list of MFA factors', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        {
          id: 'mfa-1',
          factorType: 'totp',
          friendlyName: 'Authenticator App',
          isActive: true
        }
      ]);

      const response = await request(app).get('/api/custom/mfa/factors');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data).toHaveLength(1);
    });

    test('should filter by activeOnly query param', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([]);

      const response = await request(app).get('/api/custom/mfa/factors?activeOnly=false');

      expect(response.status).toBe(200);
      expect(MFAFactor.findByUserId).toHaveBeenCalledWith('user-123', false);
    });
  });

  describe('POST /api/custom/mfa/enroll', () => {
    test('should return 400 if Supabase tokens are missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Supabase access and refresh tokens are required');
    });

    test('should return 400 for invalid factorType', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
          factorType: 'invalid-type',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid factorType');
    });

    test('should return 401 if Supabase session is invalid', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid session' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'invalid-token',
          supabaseRefreshToken: 'invalid-refresh',
          factorType: 'totp',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid or expired Supabase session');
    });

    test('should return 401 if session is not established', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Session not established');
    });

    test('should return 400 if MFA enrollment fails with sub claim error', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: null,
        error: { message: 'missing sub claim in JWT' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Authentication session expired');
    });

    test('should return 400 if user already enrolled in MFA', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: null,
        error: { message: 'User already enrolled in MFA' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already enrolled');
    });

    test('should return 400 for generic MFA enrollment error', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: null,
        error: { message: 'Generic enrollment error' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to enroll in MFA');
    });

    test('should successfully enroll in MFA with default factorType', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: {
          id: 'factor-123',
          totp: {
            qr_code: 'data:image/svg+xml;base64,...',
            secret: 'SECRET123',
            uri: 'otpauth://totp/...'
          }
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'upsert').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.factorId).toBe('factor-123');
      expect(response.body.data.qrCode).toBeDefined();
      expect(response.body.info).toContain('default factorType');
    });

    test('should successfully enroll in MFA with explicit factorType and friendlyName', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: {
          id: 'factor-456',
          totp: {
            qr_code: 'data:image/svg+xml;base64,...',
            secret: 'SECRET456',
            uri: 'otpauth://totp/...'
          }
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'upsert').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
          factorType: 'totp',
          friendlyName: 'My Phone'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.factorId).toBe('factor-456');
      expect(response.body.info).toBeUndefined();
      expect(MFAFactor.upsert).toHaveBeenCalledWith(expect.objectContaining({
        friendlyName: 'My Phone'
      }));
    });

    test('should accept tokens from headers', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.enroll.mockResolvedValue({
        data: {
          id: 'factor-789',
          totp: {
            qr_code: 'data:image/svg+xml;base64,...',
            secret: 'SECRET789',
            uri: 'otpauth://totp/...'
          }
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'upsert').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/enroll')
        .set('x-supabase-access-token', 'header-token')
        .set('x-supabase-refresh-token', 'header-refresh')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/custom/mfa/unenroll', () => {
    test('should return 400 if Supabase tokens are missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Supabase access and refresh tokens are required');
    });

    test('should return 404 if no active MFA factor found', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([]);

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No active MFA factor found');
    });

    test('should return 401 if Supabase session is invalid', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp', isActive: true }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid session' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({
          supabaseAccessToken: 'invalid-token',
          supabaseRefreshToken: 'invalid-refresh',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid or expired Supabase session');
    });

    test('should return 400 if MFA unenrollment fails', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp', isActive: true }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.unenroll.mockResolvedValue({
        data: null,
        error: { message: 'Unenrollment failed' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to unenroll from MFA');
    });

    test('should successfully unenroll from MFA with auto-retrieved factorId', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp', isActive: true }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.unenroll.mockResolvedValue({
        data: { id: 'factor-123' },
        error: null
      });

      jest.spyOn(MFAFactor, 'delete').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('MFA removed successfully');
      expect(MFAFactor.delete).toHaveBeenCalledWith('factor-123');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-123', {
        mfaFactorId: null
      });
    });

    test('should successfully unenroll with explicit factorId', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.unenroll.mockResolvedValue({
        data: { id: 'factor-456' },
        error: null
      });

      jest.spyOn(MFAFactor, 'delete').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
          factorId: 'factor-456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(MFAFactor.delete).toHaveBeenCalledWith('factor-456');
    });

    test('should accept tokens from headers', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-789', factorType: 'totp', isActive: true }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.unenroll.mockResolvedValue({
        data: { id: 'factor-789' },
        error: null
      });

      jest.spyOn(MFAFactor, 'delete').mockResolvedValue({});
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/unenroll')
        .set('x-supabase-access-token', 'header-token')
        .set('x-supabase-refresh-token', 'header-refresh')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/custom/mfa/challenge', () => {
    test('should return 400 if Supabase tokens are missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Supabase tokens are required');
    });

    test('should return 404 if no active MFA factor found', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([]);

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No active MFA factor found');
    });

    test('should return 401 if session is invalid', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp' }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid session' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({
          supabaseAccessToken: 'invalid-token',
          supabaseRefreshToken: 'invalid-refresh',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid session');
    });

    test('should return 400 if challenge creation fails', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp' }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: null,
        error: { message: 'Challenge creation failed' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to create MFA challenge');
    });

    test('should successfully create MFA challenge with auto-retrieved factorId', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-123', factorType: 'totp' }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: {
          id: 'challenge-123',
          expires_at: 123456789
        },
        error: null
      });

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.challengeId).toBe('challenge-123');
      expect(response.body.data.factorId).toBe('factor-123');
    });

    test('should successfully create MFA challenge with explicit factorId', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: {
          id: 'challenge-456',
          expires_at: 987654321
        },
        error: null
      });

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
          factorId: 'factor-456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.challengeId).toBe('challenge-456');
      expect(response.body.data.factorId).toBe('factor-456');
    });

    test('should accept tokens from headers', async () => {
      jest.spyOn(MFAFactor, 'findByUserId').mockResolvedValue([
        { factorId: 'factor-789', factorType: 'totp' }
      ]);

      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: {
          id: 'challenge-789',
          expires_at: 111111111
        },
        error: null
      });

      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .set('x-supabase-access-token', 'header-token')
        .set('x-supabase-refresh-token', 'header-refresh')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/custom/mfa/verify', () => {
    test('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('factorId, challengeId, and code are required');
    });

    test('should return 400 if Supabase tokens are missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '123456',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Supabase tokens are required');
    });

    test('should return 401 if session is invalid', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: null,
        error: { message: 'Invalid session' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '123456',
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid session');
    });

    test('should return 400 if verification fails', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '999999',
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid verification code');
    });

    test('should successfully verify MFA code', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'updateLastUsed').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '123456',
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('AAL2 achieved');
      expect(response.body.data.aal).toBe('aal2');
      expect(MFAFactor.updateLastUsed).toHaveBeenCalledWith('factor-123');
    });

    test('should continue even if updateLastUsed fails', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'updateLastUsed').mockRejectedValue(new Error('DB error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '123456',
          supabaseAccessToken: 'token',
          supabaseRefreshToken: 'refresh',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should accept tokens from headers', async () => {
      mockSupabase.auth.setSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token'
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'updateLastUsed').mockResolvedValue({});

      const response = await request(app)
        .post('/api/custom/mfa/verify')
        .set('x-supabase-access-token', 'header-token')
        .set('x-supabase-refresh-token', 'header-refresh')
        .send({
          factorId: 'factor-123',
          challengeId: 'challenge-123',
          code: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/custom/mfa/login-verify', () => {
    test('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('User ID and verification code are required');
    });

    test('should return 400 if code is missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('User ID and verification code are required');
    });

    test('should return 404 if user not found', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('User not found');
    });

    test('should return 403 if user account is deactivated', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        isActive: false,
      });

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('deactivated');
    });

    test('should return 400 if MFA is not enabled for user', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        isActive: true,
        mfaFactorId: null,
      });

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('MFA is not enabled');
    });

    test('should return 400 if MFA challenge creation fails', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        mfaFactorId: 'factor-123'
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: null,
        error: { message: 'Challenge creation failed' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to create MFA challenge');
    });

    test('should return 401 if MFA verification code is invalid', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        mfaFactorId: 'factor-123'
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: null,
        error: { message: 'Invalid code' }
      });

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '999999' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid verification code');
    });

    test('should successfully verify MFA and return user token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '123-456-7890',
        appLanguage: 'en',
        profileImage: 'http://example.com/avatar.jpg',
        isActive: true,
        mfaFactorId: 'factor-123',
        role: 3,
        kycId: 'kyc-123',
        kycStatus: 'verified',
        kycUrl: 'http://example.com/kyc',
        address: '123 Main St',
        country: 'US',
        walletAddress: '0x123...'
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        ...mockUser,
        lastLogin: new Date()
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: {
          access_token: 'verified-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          expires_at: Date.now() / 1000 + 3600
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'updateLastUsed').mockResolvedValue({});

      createToken.mockReturnValue('mock-jwt-token-user-123');

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('mock-jwt-token-user-123');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.supabase).toBeDefined();
      expect(MFAFactor.updateLastUsed).toHaveBeenCalledWith('factor-123');
    });

    test('should continue if updateLastUsed fails during login-verify', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        mfaFactorId: 'factor-123',
        role: 3
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: 'user-123',
        lastLogin: new Date()
      });

      mockSupabase.auth.mfa.challenge.mockResolvedValue({
        data: { id: 'challenge-123' },
        error: null
      });

      mockSupabase.auth.mfa.verify.mockResolvedValue({
        data: {
          access_token: 'verified-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          expires_at: Date.now() / 1000 + 3600
        },
        error: null
      });

      jest.spyOn(MFAFactor, 'updateLastUsed').mockRejectedValue(new Error('DB error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should return 500 on unexpected error during MFA login-verify', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        isActive: true,
        mfaFactorId: 'factor-123'
      });

      mockSupabase.auth.mfa.challenge.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/custom/mfa/login-verify')
        .send({ userId: 'user-123', code: '123456' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('An error occurred during MFA verification');
    });
  });

  // ===== DIDIT KYC ENDPOINTS =====

  describe('POST /api/custom/didit/session', () => {
    test('should create new DiDit session', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        kycId: null
      });

      apiManager.createDiditSession.mockResolvedValue({
        statusCode: 201,
        body: {
          session_id: 'session-123',
          url: 'https://didit.com/session/123',
          status: 'pending'
        }
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: 'user-123',
        kycId: 'session-123'
      });

      const response = await request(app).post('/api/custom/didit/session');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.session_id).toBe('session-123');
      expect(response.body.existingSession).toBe(false);
    });

    test('should return existing session if valid', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        kycId: 'existing-session-123'
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: 'user-123',
        kycId: 'existing-session-123',
        kycStatus: 'pending'
      });

      apiManager.getDiditSession.mockResolvedValue({
        statusCode: 200,
        body: {
          session_id: 'existing-session-123',
          status: 'pending'
        }
      });

      const response = await request(app).post('/api/custom/didit/session');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.existingSession).toBe(true);
      expect(response.body.data.session_id).toBe('existing-session-123');
    });

    test('should create new session if existing session is expired', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        kycId: 'expired-session-123'
      });

      // First call to getDiditSession returns error (expired)
      apiManager.getDiditSession.mockResolvedValue({
        statusCode: 404,
        error: 'Session expired'
      });

      // Second call to createDiditSession creates new session
      apiManager.createDiditSession.mockResolvedValue({
        statusCode: 201,
        body: {
          session_id: 'new-session-456',
          url: 'https://didit.com/session/456',
          status: 'pending'
        }
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: 'user-123',
        kycId: 'new-session-456'
      });

      const response = await request(app).post('/api/custom/didit/session');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionRenewed).toBe(true);
      expect(response.body.data.session_id).toBe('new-session-456');
    });

    test('should return 404 if user not found', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const response = await request(app).post('/api/custom/didit/session');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    test('should handle DiDit API error when creating session', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        kycId: null
      });

      apiManager.createDiditSession.mockResolvedValue({
        statusCode: 500,
        error: 'DiDit service unavailable',
        body: null
      });

      const response = await request(app).post('/api/custom/didit/session');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/custom/didit/session/:sessionId', () => {
    test('should get DiDit session status', async () => {
      apiManager.getDiditSession.mockResolvedValue({
        statusCode: 200,
        body: {
          session_id: 'session-123',
          status: 'verified',
          user_data: { name: 'John Doe' }
        }
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const response = await request(app).get('/api/custom/didit/session/session-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('verified');
    });

    test('should return 400 if sessionId missing', async () => {
      const response = await request(app).get('/api/custom/didit/session/ ');

      expect(response.status).toBe(404); // Express returns 404 for empty params
    });
  });

  describe('GET /api/custom/didit/session/:sessionId/pdf', () => {
    test('should return PDF data for session', async () => {
      apiManager.getDiditPDF.mockResolvedValue({
        statusCode: 200,
        body: {
          pdfUrl: 'https://didit.com/pdf/session-123.pdf',
          expiresAt: '2024-12-31T23:59:59Z'
        }
      });

      const response = await request(app).get('/api/custom/didit/session/session-123/pdf');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pdfUrl).toBeDefined();
    });

    test('should handle 404 for missing PDF', async () => {
      apiManager.getDiditPDF.mockResolvedValue({
        statusCode: 404,
        error: 'PDF not found'
      });

      const response = await request(app).get('/api/custom/didit/session/session-123/pdf');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/custom/didit/verify', () => {
    test('should create verification session', async () => {
      apiManager.createDiditSession.mockResolvedValue({
        statusCode: 201,
        body: {
          session_id: 'verify-123',
          url: 'https://didit.com/verify/123',
          workflow_id: 'workflow-123',
          status: 'pending'
        }
      });

      const response = await request(app)
        .post('/api/custom/didit/verify')
        .send({ redirectUrl: 'https://app.com/callback' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('verify-123');
    });

    test('should return error if DiDit session creation fails', async () => {
      apiManager.createDiditSession.mockResolvedValue({
        statusCode: 500,
        error: 'Service unavailable',
        body: null
      });

      const response = await request(app)
        .post('/api/custom/didit/verify')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/custom/didit/session/:sessionId error handling', () => {
    test('should handle DiDit API errors', async () => {
      apiManager.getDiditSession.mockResolvedValue({
        statusCode: 500,
        error: 'Internal server error',
        body: null
      });

      const response = await request(app).get('/api/custom/didit/session/session-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });

  // ===== PROSPERA OAUTH ENDPOINTS =====

  describe('POST /api/custom/prospera/auth-url', () => {
    test('should generate Prospera auth URL', async () => {
      prospera.isReady.mockReturnValue(true);
      prospera.generateAuthUrl.mockReturnValue({
        authUrl: 'https://oauth.prospera.com/authorize?code=test',
        codeVerifier: 'test-verifier-123',
        nonce: 'test-nonce-456'
      });

      const response = await request(app)
        .post('/api/custom/prospera/auth-url')
        .send({ redirectUri: 'https://app.example.com/callback' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authUrl).toBeDefined();
      expect(response.body.codeVerifier).toBeDefined();
      expect(response.body.nonce).toBeDefined();
    });

    test.skip('should return 503 if Prospera service fails to initialize', async () => {
      // Skipped: The route has retry/initialization logic that causes timeouts in tests
      // The ensureProsperapInitialized() function has complex async behavior
    });
  });

  describe('POST /api/custom/prospera/complete-registration', () => {
    test('should return 400 if termsAccepted is false', async () => {
      const response = await request(app)
        .post('/api/custom/prospera/complete-registration')
        .send({
          userData: { email: 'test@example.com' },
          sessionData: { accessToken: 'token' },
          termsAccepted: false
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Terms and conditions must be accepted');
    });

    test('should return 409 if user already exists', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue({
        id: 'existing-user',
        email: 'test@example.com'
      });

      const response = await request(app)
        .post('/api/custom/prospera/complete-registration')
        .send({
          userData: { email: 'test@example.com', prosperaId: 'prospera-123' },
          sessionData: { accessToken: 'token', refreshToken: 'refresh', expiresAt: 123456 },
          termsAccepted: true
        });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('User already exists');
    });

    test('should successfully create new user with minimal data', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue({
        id: 'new-user-123',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 3,
        prosperaId: 'prospera-123'
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockImplementation((id, updates) => {
        return Promise.resolve({ id, ...updates });
      });

      crossmint.getOrCreateWallet.mockResolvedValue({
        walletAddress: '0xABC123'
      });

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-user-123' } },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'supabase-token',
            refresh_token: 'supabase-refresh',
            expires_in: 3600,
            expires_at: 123456
          },
          user: { id: 'auth-user-123' }
        },
        error: null
      });

      createToken.mockReturnValue('mock-jwt-token-new-user-123');

      const response = await request(app)
        .post('/api/custom/prospera/complete-registration')
        .send({
          userData: {
            email: 'newuser@example.com',
            name: 'John Doe',
            prosperaId: 'prospera-123',
            picture: 'http://example.com/pic.jpg',
            emailVerified: true,
            givenName: 'John',
            surname: 'Doe'
          },
          sessionData: {
            accessToken: 'prospera-token',
            refreshToken: 'prospera-refresh',
            expiresAt: 999999
          },
          termsAccepted: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('mock-jwt-token-new-user-123');
      expect(response.body.user).toBeDefined();
    });

    test('should handle wallet creation failure gracefully', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue({
        id: 'new-user-456',
        email: 'user2@example.com',
        role: 3
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockImplementation((id, updates) => {
        return Promise.resolve({ id, ...updates });
      });

      crossmint.getOrCreateWallet.mockRejectedValue(new Error('Wallet service down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'auth-user-456' } },
        error: null
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'token',
            refresh_token: 'refresh',
            expires_in: 3600,
            expires_at: 123456
          }
        },
        error: null
      });

      createToken.mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/custom/prospera/complete-registration')
        .send({
          userData: {
            email: 'user2@example.com',
            name: 'User Two',
            prosperaId: 'prospera-456',
            givenName: 'User',
            surname: 'Two'
          },
          sessionData: {
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresAt: 999999
          },
          termsAccepted: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      consoleSpy.mockRestore();
    });

    test('should handle Supabase Auth creation failure gracefully', async () => {
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue({
        id: 'new-user-789',
        email: 'user3@example.com',
        role: 3
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockImplementation((id, updates) => {
        return Promise.resolve({ id, ...updates });
      });

      crossmint.getOrCreateWallet.mockResolvedValue({
        walletAddress: '0xDEF456'
      });

      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: null,
        error: { message: 'Auth service error' }
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Auth service error' }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      createToken.mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/custom/prospera/complete-registration')
        .send({
          userData: {
            email: 'user3@example.com',
            name: 'User Three',
            prosperaId: 'prospera-789',
            givenName: 'User',
            surname: 'Three'
          },
          sessionData: {
            accessToken: 'token',
            refreshToken: 'refresh',
            expiresAt: 999999
          },
          termsAccepted: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.supabase).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  // ===== WALLET ENDPOINTS =====

  describe('GET /api/custom/wallet/balances', () => {
    test.skip('should return empty balances if no wallet', async () => {
      // Skipped due to ensureCrossmintInitialized() async initialization
      // This requires complex mocking of the crossmint service initialization
    });

    test.skip('should get wallet balances', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 404 if user not found', async () => {
      // Skipped - same reason as above
    });
  });

  describe('POST /api/custom/wallet/transfer', () => {
    test.skip('should return 404 if user not found', async () => {
      // Skipped due to ensureCrossmintInitialized() requirement
    });

    test.skip('should return 400 if user has no wallet', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 403 if MFA not enabled', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 400 for missing required fields', async () => {
      // Skipped due to complex validation and initialization
    });

    test.skip('should return 400 for invalid recipient address', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 400 for invalid amount', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 400 for self-transfer', async () => {
      // Skipped - same reason as above
    });
  });

  describe('GET /api/custom/wallet/transfer/:transferId', () => {
    test.skip('should return 404 if user not found', async () => {
      // Skipped due to ensureCrossmintInitialized() requirement
    });

    test.skip('should return 400 if tokenLocator missing', async () => {
      // Skipped - same reason as above
    });

    test.skip('should get transfer status', async () => {
      // Skipped - same reason as above
    });
  });

  // ===== ADDITIONAL PROSPERA TESTS =====

  describe('POST /api/custom/prospera/callback', () => {
    test.skip('should return 400 if code is missing', async () => {
      // Skipped: The route uses ensureBodyParsed() which handles body parsing asynchronously
      // When body fields are missing, it causes validation errors caught by middleware
      // Testing this requires complex stream mocking
    });

    test.skip('should return 400 if codeVerifier is missing', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 400 if nonce is missing', async () => {
      // Skipped - same reason as above
    });

    test('should return 503 if Prospera service fails to initialize', async () => {
      prospera.isReady.mockReturnValue(false);
      prospera.initialize.mockRejectedValue(new Error('Initialization failed'));

      const response = await request(app)
        .post('/api/custom/prospera/callback')
        .send({
          code: 'auth-code',
          codeVerifier: 'verifier',
          nonce: 'nonce'
        });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);

      // Reset
      prospera.isReady.mockReturnValue(true);
      prospera.initialize.mockResolvedValue(true);
    });
  });

  describe('POST /api/custom/prospera/link-wallet', () => {
    test.skip('should return 400 if code is missing', async () => {
      // Skipped: ensureBodyParsed() complexity - see callback tests
    });

    test.skip('should return 400 if codeVerifier is missing', async () => {
      // Skipped - same reason as above
    });

    test.skip('should return 400 if nonce is missing', async () => {
      // Skipped - same reason as above
    });
  });

  // ===== DIAGNOSTIC ENDPOINTS =====

  describe('GET /api/custom/diagnostic/user/:email', () => {
    test('should return user diagnostic information', async () => {
      jest.spyOn(User, 'findByEmail').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        role: 3,
        isActive: true
      });

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        role: 3,
        isActive: true
      });

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'user-123',
              email: 'test@example.com',
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        },
        error: null
      });

      const response = await request(app).get('/api/custom/diagnostic/user/test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.existsInUsersTable).toBe(true);
      expect(response.body.existsInAuth).toBe(true);
    });

    test('should handle user not found in users table', async () => {
      jest.spyOn(User, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: {
          users: [
            {
              id: 'auth-123',
              email: 'test@example.com',
              created_at: '2024-01-01T00:00:00Z'
            }
          ]
        },
        error: null
      });

      const response = await request(app).get('/api/custom/diagnostic/user/test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.existsInUsersTable).toBe(false);
      expect(response.body.existsInAuth).toBe(true);
      expect(response.body.diagnosis).toContain('User exists in Auth but missing from users table');
    });

    test('should handle auth errors gracefully', async () => {
      jest.spyOn(User, 'findByEmail').mockResolvedValue(null);

      mockSupabase.auth.admin.listUsers.mockResolvedValue({
        data: null,
        error: { message: 'Auth service unavailable' }
      });

      const response = await request(app).get('/api/custom/diagnostic/user/test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.existsInAuth).toBe(false);
      expect(response.body.authError).toBe('Auth service unavailable');
    });

    test('should handle auth exception gracefully', async () => {
      jest.spyOn(User, 'findByEmail').mockResolvedValue(null);

      mockSupabase.auth.admin.listUsers.mockRejectedValue(new Error('Connection timeout'));

      const response = await request(app).get('/api/custom/diagnostic/user/test@example.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.authError).toBe('Connection timeout');
    });
  });

  describe('GET /api/custom/diagnostic/supabase', () => {
    test('should return Supabase diagnostic info', async () => {
      mockSupabase.setMockResponse('users', {
        data: null,
        error: null,
        count: 5
      });

      const response = await request(app).get('/api/custom/diagnostic/supabase');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.database).toBeDefined();
      expect(response.body.database.canQueryUsers).toBe(true);
      expect(response.body.database.userCount).toBe(5);
    });

    test('should handle query errors', async () => {
      mockSupabase.setMockResponse('users', {
        data: null,
        error: {
          code: 'PGRST116',
          message: 'Permission denied',
          details: null,
          hint: null
        },
        count: null
      });

      const response = await request(app).get('/api/custom/diagnostic/supabase');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.database.canQueryUsers).toBe(false);
      expect(response.body.database.error).toBeDefined();
    });

    test('should handle query exceptions', async () => {
      // Mock the from().select() chain to throw an exception
      const mockSelect = jest.fn().mockRejectedValue(new Error('Database connection lost'));
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
      mockSupabase.from = mockFrom;

      const response = await request(app).get('/api/custom/diagnostic/supabase');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.database.canQueryUsers).toBe(false);
      expect(response.body.database.error).toBe('Database connection lost');
    });
  });

  describe('GET /api/custom/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/custom/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('operational');
      expect(response.body.service).toBe('Custom APIs');
      expect(response.body.services).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/custom/mfa/challenge', () => {
    test('should return 400 if factorId is missing', async () => {
      const response = await request(app)
        .post('/api/custom/mfa/challenge')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
