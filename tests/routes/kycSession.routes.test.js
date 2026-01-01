/**
 * KYC Session Routes Tests
 * Tests for src/routes/kycSession.routes.js
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
    req.auth = { userId: 'user-123', userRole: 1, role: 1 };
    req.user = { id: 'user-123', role: 1 };
    next();
  },
}));

const { getSupabase } = require('../../src/config/database');
const { errorHandler } = require('../../src/middleware/errorHandler');
const KycSession = require('../../src/models/supabase/kycSession');
const { User } = require('../../src/models/supabase');

describe('KYC Session Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mount routes
    const kycSessionRoutes = require('../../src/routes/kycSession.routes');
    app.use('/api/kyc-sessions', kycSessionRoutes);

    // Add error handler middleware
    app.use(errorHandler);
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();
  });

  describe('GET /api/kyc-sessions/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/kyc-sessions/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('KYC Session API');
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/kyc-sessions', () => {
    test('should create a new KYC session successfully', async () => {
      const sessionData = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: 'session-123',
        provider: 'veriff',
        expiresAt: '2024-12-31T23:59:59Z'
      };

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: sessionData.userId,
        email: 'user@example.com',
        kycId: null
      });

      jest.spyOn(KycSession, 'create').mockResolvedValue({
        id: 'kyc-session-123',
        ...sessionData,
        status: 'pending',
        verificationData: {}
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionData.userId,
        kycId: 'kyc-session-123'
      });

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send(sessionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KYC session created successfully');
      expect(response.body.data.sessionId).toBe('session-123');
      expect(response.body.isExisting).toBe(false);
    });

    test('should return existing KYC session if user already has kycId', async () => {
      const sessionData = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: 'session-123',
        provider: 'veriff'
      };

      const existingSession = {
        id: 'existing-kyc-123',
        userId: sessionData.userId,
        sessionId: 'existing-session-456',
        provider: 'veriff',
        status: 'completed'
      };

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: sessionData.userId,
        email: 'user@example.com',
        kycId: 'existing-kyc-123'
      });

      jest.spyOn(KycSession, 'findById').mockResolvedValue(existingSession);

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send(sessionData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User already has an existing KYC session');
      expect(response.body.data.id).toBe('existing-kyc-123');
      expect(response.body.isExisting).toBe(true);
    });

    test('should create new session if user has kycId but session not found', async () => {
      const sessionData = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: 'session-123',
        provider: 'veriff'
      };

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: sessionData.userId,
        email: 'user@example.com',
        kycId: 'non-existent-kyc-id'
      });

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      jest.spyOn(KycSession, 'create').mockResolvedValue({
        id: 'new-kyc-session-123',
        ...sessionData,
        status: 'pending',
        verificationData: {}
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionData.userId,
        kycId: 'new-kyc-session-123'
      });

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send(sessionData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.isExisting).toBe(false);
    });

    test('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/kyc-sessions')
        .send({
          sessionId: 'session-123',
          provider: 'veriff'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if sessionId is missing', async () => {
      const response = await request(app)
        .post('/api/kyc-sessions')
        .send({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          provider: 'veriff'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if provider is missing', async () => {
      const response = await request(app)
        .post('/api/kyc-sessions')
        .send({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          sessionId: 'session-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 if user not found', async () => {
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send({
          userId: '550e8400-e29b-41d4-a716-446655440001',
          sessionId: 'session-123',
          provider: 'veriff'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User not found');
    });

    test('should trim whitespace from input fields', async () => {
      const sessionData = {
        userId: '  550e8400-e29b-41d4-a716-446655440001  ',
        sessionId: '  session-123  ',
        provider: '  veriff  '
      };

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: sessionData.userId.trim(),
        email: 'user@example.com',
        kycId: null
      });

      jest.spyOn(KycSession, 'create').mockResolvedValue({
        id: 'kyc-session-123',
        userId: sessionData.userId.trim(),
        sessionId: sessionData.sessionId.trim(),
        provider: sessionData.provider.trim(),
        status: 'pending',
        verificationData: {}
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionData.userId.trim(),
        kycId: 'kyc-session-123'
      });

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send(sessionData);

      expect(response.status).toBe(201);
      expect(KycSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: sessionData.userId.trim(),
          sessionId: sessionData.sessionId.trim(),
          provider: sessionData.provider.trim()
        })
      );
    });

    test('should handle expiresAt as null if not provided', async () => {
      const sessionData = {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        sessionId: 'session-123',
        provider: 'veriff'
      };

      jest.spyOn(User, 'findById').mockResolvedValue({
        id: sessionData.userId,
        email: 'user@example.com',
        kycId: null
      });

      jest.spyOn(KycSession, 'create').mockResolvedValue({
        id: 'kyc-session-123',
        ...sessionData,
        status: 'pending',
        verificationData: {},
        expiresAt: null
      });

      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionData.userId,
        kycId: 'kyc-session-123'
      });

      const response = await request(app)
        .post('/api/kyc-sessions')
        .send(sessionData);

      expect(response.status).toBe(201);
      expect(KycSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: null
        })
      );
    });
  });

  describe('GET /api/kyc-sessions', () => {
    test('should get all KYC sessions without filters', async () => {
      jest.spyOn(KycSession, 'find').mockResolvedValue([
        {
          id: 'kyc-1',
          userId: 'user-1',
          sessionId: 'session-1',
          provider: 'veriff',
          status: 'pending'
        },
        {
          id: 'kyc-2',
          userId: 'user-2',
          sessionId: 'session-2',
          provider: 'onfido',
          status: 'completed'
        }
      ]);

      const response = await request(app).get('/api/kyc-sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
    });

    test('should filter by userId', async () => {
      jest.spyOn(KycSession, 'find').mockImplementation((filter) => {
        if (filter.userId === 'user-1') {
          return Promise.resolve([
            { id: 'kyc-1', userId: 'user-1', sessionId: 'session-1', provider: 'veriff' }
          ]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/kyc-sessions')
        .query({ userId: 'user-1' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(KycSession.find).toHaveBeenCalledWith({ userId: 'user-1' });
    });

    test('should filter by provider', async () => {
      jest.spyOn(KycSession, 'find').mockImplementation((filter) => {
        if (filter.provider === 'veriff') {
          return Promise.resolve([
            { id: 'kyc-1', userId: 'user-1', sessionId: 'session-1', provider: 'veriff' }
          ]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/kyc-sessions')
        .query({ provider: 'veriff' });

      expect(response.status).toBe(200);
      expect(KycSession.find).toHaveBeenCalledWith({ provider: 'veriff' });
    });

    test('should filter by status', async () => {
      jest.spyOn(KycSession, 'find').mockImplementation((filter) => {
        if (filter.status === 'completed') {
          return Promise.resolve([
            { id: 'kyc-1', userId: 'user-1', sessionId: 'session-1', status: 'completed' }
          ]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .get('/api/kyc-sessions')
        .query({ status: 'completed' });

      expect(response.status).toBe(200);
      expect(KycSession.find).toHaveBeenCalledWith({ status: 'completed' });
    });

    test('should filter by multiple criteria', async () => {
      jest.spyOn(KycSession, 'find').mockImplementation((filter) => {
        return Promise.resolve([
          { id: 'kyc-1', userId: 'user-1', provider: 'veriff', status: 'completed' }
        ]);
      });

      const response = await request(app)
        .get('/api/kyc-sessions')
        .query({ userId: 'user-1', provider: 'veriff', status: 'completed' });

      expect(response.status).toBe(200);
      expect(KycSession.find).toHaveBeenCalledWith({
        userId: 'user-1',
        provider: 'veriff',
        status: 'completed'
      });
    });
  });

  describe('GET /api/kyc-sessions/:id', () => {
    test('should get KYC session by ID', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        sessionId: 'session-123',
        provider: 'veriff',
        status: 'pending'
      });

      const response = await request(app).get(`/api/kyc-sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sessionId);
    });

    test('should return 400 if session not found', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      const response = await request(app).get(`/api/kyc-sessions/${sessionId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/kyc-sessions/session/:sessionId', () => {
    test('should get KYC session by session ID', async () => {
      jest.spyOn(KycSession, 'findBySessionId').mockResolvedValue({
        id: 'kyc-123',
        userId: 'user-123',
        sessionId: 'session-456',
        provider: 'veriff',
        status: 'pending'
      });

      const response = await request(app).get('/api/kyc-sessions/session/session-456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe('session-456');
    });

    test('should return 400 if session not found', async () => {
      jest.spyOn(KycSession, 'findBySessionId').mockResolvedValue(null);

      const response = await request(app).get('/api/kyc-sessions/session/nonexistent');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/kyc-sessions/user/:userId', () => {
    test('should get all KYC sessions for a user', async () => {
      jest.spyOn(KycSession, 'findByUserId').mockResolvedValue([
        {
          id: 'kyc-1',
          userId: 'user-123',
          sessionId: 'session-1',
          provider: 'veriff',
          status: 'completed'
        },
        {
          id: 'kyc-2',
          userId: 'user-123',
          sessionId: 'session-2',
          provider: 'onfido',
          status: 'pending'
        }
      ]);

      const response = await request(app).get('/api/kyc-sessions/user/user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
    });

    test('should return empty array if no sessions found', async () => {
      jest.spyOn(KycSession, 'findByUserId').mockResolvedValue([]);

      const response = await request(app).get('/api/kyc-sessions/user/user-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/kyc-sessions/user/:userId/latest', () => {
    test('should get latest KYC session for a user', async () => {
      jest.spyOn(KycSession, 'getLatestForUser').mockResolvedValue({
        id: 'kyc-latest',
        userId: 'user-123',
        sessionId: 'session-latest',
        provider: 'veriff',
        status: 'completed',
        createdAt: '2024-12-31T12:00:00Z'
      });

      const response = await request(app).get('/api/kyc-sessions/user/user-123/latest');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('kyc-latest');
    });

    test('should return 400 if no sessions found for user', async () => {
      jest.spyOn(KycSession, 'getLatestForUser').mockResolvedValue(null);

      const response = await request(app).get('/api/kyc-sessions/user/user-123/latest');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/kyc-sessions/status/:status', () => {
    test('should get sessions by status - pending', async () => {
      jest.spyOn(KycSession, 'findByStatus').mockResolvedValue([
        { id: 'kyc-1', status: 'pending' },
        { id: 'kyc-2', status: 'pending' }
      ]);

      const response = await request(app).get('/api/kyc-sessions/status/pending');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
    });

    test('should get sessions by status - completed', async () => {
      jest.spyOn(KycSession, 'findByStatus').mockResolvedValue([
        { id: 'kyc-1', status: 'completed' }
      ]);

      const response = await request(app).get('/api/kyc-sessions/status/completed');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
    });

    test('should return 400 for invalid status', async () => {
      const response = await request(app).get('/api/kyc-sessions/status/invalid_status');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should accept all valid statuses', async () => {
      const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'expired'];

      for (const status of validStatuses) {
        jest.spyOn(KycSession, 'findByStatus').mockResolvedValue([
          { id: 'kyc-1', status }
        ]);

        const response = await request(app).get(`/api/kyc-sessions/status/${status}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('PUT /api/kyc-sessions/:id', () => {
    test('should update KYC session successfully', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        status: 'completed',
        pdfUrl: 'https://example.com/kyc.pdf'
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'completed',
        pdfUrl: 'https://example.com/kyc.pdf'
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KYC session updated successfully');
      expect(response.body.data.status).toBe('completed');
    });

    test('should update verificationData', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        verificationData: {
          firstName: 'John',
          lastName: 'Doe',
          documentType: 'passport'
        }
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        verificationData: updateData.verificationData
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(KycSession.findByIdAndUpdate).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          verificationData: updateData.verificationData
        })
      );
    });

    test('should update completedAt timestamp', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        completedAt: '2024-12-31T23:59:59Z'
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        completedAt: updateData.completedAt
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
    });

    test('should update expiresAt timestamp', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        expiresAt: '2025-01-31T23:59:59Z'
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        expiresAt: updateData.expiresAt
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
    });

    test('should trim string fields', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        status: '  completed  ',
        pdfUrl: '  https://example.com/kyc.pdf  '
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'completed',
        pdfUrl: 'https://example.com/kyc.pdf'
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(KycSession.findByIdAndUpdate).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: 'completed',
          pdfUrl: 'https://example.com/kyc.pdf'
        })
      );
    });

    test('should ignore non-allowed fields', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const updateData = {
        status: 'completed',
        userId: 'hacker-user',
        sessionId: 'hacker-session',
        provider: 'hacker-provider'
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndUpdate').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'completed'
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(KycSession.findByIdAndUpdate).toHaveBeenCalledWith(
        sessionId,
        expect.not.objectContaining({
          userId: expect.anything(),
          sessionId: expect.anything(),
          provider: expect.anything()
        })
      );
    });

    test('should return 400 if session not found', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send({ status: 'completed' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if no valid fields provided', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      const response = await request(app)
        .put(`/api/kyc-sessions/${sessionId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/kyc-sessions/:id/complete', () => {
    test('should complete KYC session successfully', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const verificationData = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01'
      };
      const pdfUrl = 'https://example.com/kyc-report.pdf';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'complete').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'completed',
        verificationData,
        pdfUrl,
        completedAt: new Date().toISOString()
      });

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/complete`)
        .send({ verificationData, pdfUrl });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KYC session completed successfully');
      expect(response.body.data.status).toBe('completed');
    });

    test('should complete KYC session without pdfUrl', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const verificationData = {
        firstName: 'John',
        lastName: 'Doe'
      };

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'complete').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'completed',
        verificationData,
        completedAt: new Date().toISOString()
      });

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/complete`)
        .send({ verificationData });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 if verificationData is missing', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/complete`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if session not found', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/complete`)
        .send({ verificationData: { firstName: 'John' } });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/kyc-sessions/:id/fail', () => {
    test('should mark KYC session as failed', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';
      const reason = 'Document verification failed';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'in_progress'
      });

      jest.spyOn(KycSession, 'fail').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'failed',
        failureReason: reason
      });

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/fail`)
        .send({ reason });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KYC session marked as failed');
      expect(response.body.data.status).toBe('failed');
    });

    test('should fail session without reason', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'in_progress'
      });

      jest.spyOn(KycSession, 'fail').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'failed'
      });

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/fail`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 if session not found', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/kyc-sessions/${sessionId}/fail`)
        .send({ reason: 'Failed' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/kyc-sessions/:id', () => {
    test('should delete KYC session successfully', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue({
        id: sessionId,
        userId: 'user-123',
        status: 'pending'
      });

      jest.spyOn(KycSession, 'findByIdAndDelete').mockResolvedValue({
        id: sessionId
      });

      const response = await request(app).delete(`/api/kyc-sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('KYC session deleted successfully');
    });

    test('should return 400 if session not found', async () => {
      const sessionId = '550e8400-e29b-41d4-a716-446655440001';

      jest.spyOn(KycSession, 'findById').mockResolvedValue(null);

      const response = await request(app).delete(`/api/kyc-sessions/${sessionId}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
