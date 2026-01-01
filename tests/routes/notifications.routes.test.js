/**
 * Notifications Routes Tests
 * Tests for src/routes/notifications.routes.js
 */

const express = require('express');
const request = require('supertest');
const { createMockSupabaseClient } = require('../helpers/mockSupabase');

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabase: jest.fn(),
}));

const mockGetUserContext = jest.fn();
jest.mock('../../src/middleware/rbac', () => ({
  getUserContext: (...args) => mockGetUserContext(...args),
  ROLES: {
    ROOT: 0,
    ADMIN: 1,
    SUPPORT: 2,
    INVESTOR: 3,
    GUEST: 4,
  },
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
const { NotificationSettings } = require('../../src/models/supabase');

describe('Notifications Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mount routes
    const notificationsRoutes = require('../../src/routes/notifications.routes');
    app.use('/api/notifications', notificationsRoutes);

    // Add error handler middleware
    app.use(errorHandler);
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();

    // Default mock for getUserContext
    mockGetUserContext.mockReturnValue({
      userId: 'user-123',
      userRole: 1 // ADMIN
    });
  });

  describe('CORS middleware', () => {
    test('should set CORS headers on requests', async () => {
      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .get('/api/notifications/settings')
        .set('Origin', 'https://example.com');

      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    test('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/api/notifications/settings')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/notifications/settings/:id', () => {
    test('should get notification settings by user ID as ROOT', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 0 // ROOT
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-456',
        userId: 'user-456',
        emailNotifications: true,
        portfolioNotifications: false
      });

      const response = await request(app).get('/api/notifications/settings/user-456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user-456');
    });

    test('should get notification settings by user ID as ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-456',
        userId: 'user-456',
        emailNotifications: true
      });

      const response = await request(app).get('/api/notifications/settings/user-456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should create settings if not found', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 0 // ROOT
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue(null);

      jest.spyOn(NotificationSettings, 'create').mockResolvedValue({
        id: 'settings-new',
        userId: 'user-456',
        emailNotifications: false,
        portfolioNotifications: false
      });

      const response = await request(app).get('/api/notifications/settings/user-456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(NotificationSettings.create).toHaveBeenCalledWith({ userId: 'user-456' });
    });

    test('should return 403 for non-ROOT/ADMIN users', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/notifications/settings/user-456');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

  });

  describe('GET /api/notifications/settings', () => {
    test('should get own notification settings', async () => {
      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true,
        portfolioNotifications: true
      });

      const response = await request(app).get('/api/notifications/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('user-123');
    });

    test('should create settings if not found', async () => {
      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue(null);

      jest.spyOn(NotificationSettings, 'create').mockResolvedValue({
        id: 'settings-new',
        userId: 'user-123',
        emailNotifications: false
      });

      const response = await request(app).get('/api/notifications/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(NotificationSettings.create).toHaveBeenCalledWith({ userId: 'user-123' });
    });
  });

  describe('PUT /api/notifications/settings', () => {
    test('should update notification settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: false
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true,
        portfolioNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({
          emailNotifications: true,
          portfolioNotifications: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.emailNotifications).toBe(true);
    });

    test('should create settings if not found', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue(null);

      jest.spyOn(NotificationSettings, 'create').mockResolvedValue({
        id: 'settings-new',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({
          emailNotifications: true
        });

      expect(response.status).toBe(200);
      expect(NotificationSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          emailNotifications: true
        })
      );
    });

    test('should allow ROOT users to update settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 0 // ROOT
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({ emailNotifications: true });

      expect(response.status).toBe(200);
    });

    test('should allow SUPPORT users to update settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 2 // SUPPORT
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({ emailNotifications: true });

      expect(response.status).toBe(200);
    });

    test('should allow INVESTOR users to update settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({ emailNotifications: true });

      expect(response.status).toBe(200);
    });

    test('should return 403 for GUEST users', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 4 // GUEST
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({ emailNotifications: true });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('should only update allowed fields', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        emailNotifications: true
      });

      const response = await request(app)
        .put('/api/notifications/settings')
        .send({
          emailNotifications: true,
          hackerField: 'should-be-ignored',
          id: 'hacker-id'
        });

      expect(response.status).toBe(200);
      expect(NotificationSettings.updateByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.not.objectContaining({
          hackerField: expect.anything(),
          id: expect.anything()
        })
      );
    });

    test('should update all allowed notification fields', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(NotificationSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      jest.spyOn(NotificationSettings, 'updateByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      const allFields = {
        emailNotifications: true,
        portfolioNotifications: true,
        reportNotifications: true,
        investorActivityNotifications: true,
        systemUpdateNotifications: true,
        marketingEmailNotifications: true,
        pushNotifications: true,
        smsNotifications: true,
        notificationFrequency: 'daily',
        preferredContactMethod: 'email',
        reportDeliveryFormat: 'pdf',
        documentUploads: true,
        generalAnnouncements: true,
        capitalCallNotices: true,
        distributionNotices: true,
        k1TaxForms: true,
        paymentConfirmations: true,
        quarterlyReports: true,
        securityAlerts: true,
        urgentCapitalCalls: true
      };

      const response = await request(app)
        .put('/api/notifications/settings')
        .send(allFields);

      expect(response.status).toBe(200);
      expect(NotificationSettings.updateByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining(allFields)
      );
    });
  });

  describe('PATCH /api/notifications/settings/enable-all', () => {
    test('should enable all notifications', async () => {
      const mockSettings = {
        id: 'settings-123',
        userId: 'user-123',
        enableAll: jest.fn().mockResolvedValue({
          id: 'settings-123',
          userId: 'user-123',
          emailNotifications: true,
          portfolioNotifications: true
        })
      };

      jest.spyOn(NotificationSettings, 'findOrCreateByUserId').mockResolvedValue(mockSettings);

      const response = await request(app).patch('/api/notifications/settings/enable-all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications enabled successfully');
      expect(mockSettings.enableAll).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/notifications/settings/disable-all', () => {
    test('should disable all notifications', async () => {
      const mockSettings = {
        id: 'settings-123',
        userId: 'user-123',
        disableAll: jest.fn().mockResolvedValue({
          id: 'settings-123',
          userId: 'user-123',
          emailNotifications: false,
          portfolioNotifications: false
        })
      };

      jest.spyOn(NotificationSettings, 'findOrCreateByUserId').mockResolvedValue(mockSettings);

      const response = await request(app).patch('/api/notifications/settings/disable-all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications disabled successfully');
      expect(mockSettings.disableAll).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/notifications/settings', () => {
    test('should delete notification settings', async () => {
      jest.spyOn(NotificationSettings, 'findOneAndDelete').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      const response = await request(app).delete('/api/notifications/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification settings deleted successfully');
      expect(NotificationSettings.findOneAndDelete).toHaveBeenCalledWith({ userId: 'user-123' });
    });
  });
});
