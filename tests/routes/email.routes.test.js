/**
 * Email Routes Tests
 * Tests for src/routes/email.routes.js
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
    req.auth = { userId: 'user-123' };
    req.user = { id: 'user-123' };
    next();
  },
}));

const mockGetUserContext = jest.fn();

jest.mock('../../src/middleware/rbac', () => ({
  getUserContext: mockGetUserContext,
  ROLES: {
    ROOT: 0,
    ADMIN: 1,
    SUPPORT: 2,
    INVESTOR: 3,
    GUEST: 4
  }
}));

const mockSendEmail = jest.fn();
const mockTestConnection = jest.fn();
const mockIsValidEmail = jest.fn();

jest.mock('../../src/utils/emailSender', () => ({
  sendEmail: mockSendEmail,
  testConnection: mockTestConnection,
  isValidEmail: mockIsValidEmail,
}));

const { getSupabase } = require('../../src/config/database');
const { EmailSettings, EmailLog } = require('../../src/models/supabase');

describe('Email Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/users', require('../../src/routes/email.routes'));
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();

    // Default to ROOT role and user-123
    mockGetUserContext.mockReturnValue({
      userId: 'user-123',
      userRole: 0 // ROOT
    });

    // Default email validation to true
    mockIsValidEmail.mockReturnValue(true);
  });

  describe('POST /api/users/:userId/email-settings', () => {
    const validSettings = {
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: false,
      smtpUsername: 'user@example.com',
      smtpPassword: 'password123',
      fromEmail: 'noreply@example.com',
      fromName: 'Example Company',
      replyToEmail: 'support@example.com'
    };

    test('should return 403 if user tries to manage other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR - not admin
      });

      const response = await request(app)
        .post('/api/users/user-456/email-settings')
        .send(validSettings);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('only manage your own');
    });

    test('should allow admin to manage other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        ...validSettings
      });

      const response = await request(app)
        .post('/api/users/user-456/email-settings')
        .send(validSettings);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return 400 if smtpHost is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpHost: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if smtpPort is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpPort: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if smtpUsername is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpUsername: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if smtpPassword is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpPassword: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if fromEmail is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, fromEmail: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if fromEmail is invalid', async () => {
      mockIsValidEmail.mockReturnValue(false);

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send(validSettings);

      expect(response.status).toBe(400);
    });

    test('should return 400 if replyToEmail is invalid', async () => {
      mockIsValidEmail.mockImplementation((email) => {
        if (email === 'support@example.com') return false;
        return true;
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send(validSettings);

      expect(response.status).toBe(400);
    });

    test('should return 400 if port is out of range (too low)', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpPort: 0 });

      expect(response.status).toBe(400);
    });

    test('should return 400 if port is out of range (too high)', async () => {
      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, smtpPort: 70000 });

      expect(response.status).toBe(400);
    });

    test('should convert encryption=ssl to smtpSecure=true', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        ...validSettings,
        smtpSecure: true
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, encryption: 'ssl' });

      expect(response.status).toBe(200);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ smtpSecure: true })
      );
    });

    test('should convert encryption=tls to smtpSecure=false', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        ...validSettings
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, encryption: 'tls' });

      expect(response.status).toBe(200);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ smtpSecure: false })
      );
    });

    test('should convert encryption=starttls to smtpSecure=false', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        ...validSettings
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, encryption: 'starttls' });

      expect(response.status).toBe(200);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ smtpSecure: false })
      );
    });

    test('should convert encryption=none to smtpSecure=false', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        ...validSettings
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send({ ...validSettings, encryption: 'none' });

      expect(response.status).toBe(200);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ smtpSecure: false })
      );
    });

    test('should save settings successfully', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        ...validSettings
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send(validSettings);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('saved successfully');
      expect(response.body.data.id).toBe('settings-123');
    });

    test('should set fromName and replyToEmail to null if not provided', async () => {
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123'
      });

      const settingsWithoutOptional = { ...validSettings };
      delete settingsWithoutOptional.fromName;
      delete settingsWithoutOptional.replyToEmail;

      const response = await request(app)
        .post('/api/users/user-123/email-settings')
        .send(settingsWithoutOptional);

      expect(response.status).toBe(200);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          fromName: null,
          replyToEmail: null
        })
      );
    });
  });

  describe('GET /api/users/:userId/email-settings', () => {
    test('should return 403 if user tries to view other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/users/user-456/email-settings');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('only view your own');
    });

    test('should allow admin to view other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-456',
        smtpHost: 'smtp.example.com'
      });

      const response = await request(app).get('/api/users/user-456/email-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should return existing settings', async () => {
      jest.spyOn(EmailSettings, 'findByUserId').mockResolvedValue({
        id: 'settings-123',
        userId: 'user-123',
        smtpHost: 'smtp.example.com',
        smtpPort: 587
      });

      const response = await request(app).get('/api/users/user-123/email-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('settings-123');
    });

    test('should create default settings if none exist', async () => {
      jest.spyOn(EmailSettings, 'findByUserId').mockResolvedValue(null);
      jest.spyOn(EmailSettings, 'upsert').mockResolvedValue({
        id: 'settings-new',
        userId: 'user-123',
        smtpHost: '',
        smtpPort: 587,
        smtpSecure: false
      });

      const response = await request(app).get('/api/users/user-123/email-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(EmailSettings.upsert).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          smtpHost: '',
          smtpPort: 587,
          smtpSecure: false
        })
      );
    });
  });

  describe('POST /api/users/:userId/email-settings/test', () => {
    test('should return 403 if unauthorized', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app)
        .post('/api/users/user-456/email-settings/test')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should return 400 if testEmail is invalid', async () => {
      mockIsValidEmail.mockReturnValue(false);

      const response = await request(app)
        .post('/api/users/user-123/email-settings/test')
        .send({ testEmail: 'invalid-email' });

      expect(response.status).toBe(400);
    });

    test('should test connection successfully without testEmail', async () => {
      mockTestConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful'
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings/test')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('successful');
      expect(mockTestConnection).toHaveBeenCalledWith('user-123', undefined);
    });

    test('should test connection successfully with valid testEmail', async () => {
      mockTestConnection.mockResolvedValue({
        success: true,
        message: 'Test email sent'
      });

      const response = await request(app)
        .post('/api/users/user-123/email-settings/test')
        .send({ testEmail: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockTestConnection).toHaveBeenCalledWith('user-123', 'test@example.com');
    });

    test('should return 400 if connection test fails', async () => {
      mockTestConnection.mockRejectedValue(new Error('Connection refused'));

      const response = await request(app)
        .post('/api/users/user-123/email-settings/test')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('failed');
      expect(response.body.details.message).toBe('Connection refused');
    });
  });

  describe('DELETE /api/users/:userId/email-settings', () => {
    test('should return 403 if user tries to delete other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).delete('/api/users/user-456/email-settings');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('only delete your own');
    });

    test('should allow admin to delete other user settings', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailSettings, 'delete').mockResolvedValue(true);

      const response = await request(app).delete('/api/users/user-456/email-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should delete settings successfully', async () => {
      jest.spyOn(EmailSettings, 'delete').mockResolvedValue(true);

      const response = await request(app).delete('/api/users/user-123/email-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(EmailSettings.delete).toHaveBeenCalledWith('user-123');
    });
  });

  describe('POST /api/users/:userId/send-email', () => {
    const validEmail = {
      to: ['recipient@example.com'],
      subject: 'Test Email',
      bodyText: 'This is a test email'
    };

    test('should return 403 if unauthorized', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app)
        .post('/api/users/user-456/send-email')
        .send(validEmail);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should return 400 if to is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({ ...validEmail, to: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if to is not an array', async () => {
      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({ ...validEmail, to: 'not-an-array' });

      expect(response.status).toBe(400);
    });

    test('should return 400 if to is empty array', async () => {
      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({ ...validEmail, to: [] });

      expect(response.status).toBe(400);
    });

    test('should return 400 if subject is missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({ ...validEmail, subject: undefined });

      expect(response.status).toBe(400);
    });

    test('should return 400 if both bodyText and bodyHtml are missing', async () => {
      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({ ...validEmail, bodyText: undefined });

      expect(response.status).toBe(400);
    });

    test('should send email with bodyHtml only', async () => {
      mockSendEmail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['recipient@example.com']
      });

      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send({
          to: ['recipient@example.com'],
          subject: 'Test Email',
          bodyHtml: '<p>This is a test email</p>'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should send email successfully', async () => {
      mockSendEmail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send(validEmail);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('sent successfully');
      expect(response.body.data.messageId).toBe('msg-123');
    });

    test('should send email with all optional fields', async () => {
      mockSendEmail.mockResolvedValue({
        messageId: 'msg-123',
        accepted: ['recipient@example.com']
      });

      const emailWithAllFields = {
        ...validEmail,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        bodyHtml: '<p>HTML content</p>',
        attachments: [{ filename: 'test.pdf' }],
        fromEmail: 'custom@example.com',
        fromName: 'Custom Sender',
        replyTo: 'reply@example.com'
      };

      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send(emailWithAllFields);

      expect(response.status).toBe(200);
      expect(mockSendEmail).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining(emailWithAllFields)
      );
    });

    test('should return 500 if email sending fails', async () => {
      mockSendEmail.mockRejectedValue(new Error('SMTP connection failed'));

      const response = await request(app)
        .post('/api/users/user-123/send-email')
        .send(validEmail);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('SMTP connection failed');
    });
  });

  describe('GET /api/users/:userId/email-logs', () => {
    test('should return 403 if user tries to view other user logs', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/users/user-456/email-logs');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('only view your own');
    });

    test('should allow admin to view other user logs', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailLog, 'findByUserId').mockResolvedValue({
        count: 0,
        total: 0,
        logs: []
      });

      const response = await request(app).get('/api/users/user-456/email-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should get email logs with default pagination', async () => {
      jest.spyOn(EmailLog, 'findByUserId').mockResolvedValue({
        count: 2,
        total: 10,
        logs: [
          { id: 'log-1', subject: 'Email 1' },
          { id: 'log-2', subject: 'Email 2' }
        ]
      });

      const response = await request(app).get('/api/users/user-123/email-logs');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.total).toBe(10);
      expect(response.body.data).toHaveLength(2);
      expect(EmailLog.findByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          limit: 50,
          offset: 0
        })
      );
    });

    test('should get email logs with custom pagination', async () => {
      jest.spyOn(EmailLog, 'findByUserId').mockResolvedValue({
        count: 1,
        total: 10,
        logs: [{ id: 'log-3', subject: 'Email 3' }]
      });

      const response = await request(app)
        .get('/api/users/user-123/email-logs')
        .query({ limit: 10, offset: 5 });

      expect(response.status).toBe(200);
      expect(EmailLog.findByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          limit: 10,
          offset: 5
        })
      );
    });

    test('should filter logs by status', async () => {
      jest.spyOn(EmailLog, 'findByUserId').mockResolvedValue({
        count: 1,
        total: 1,
        logs: [{ id: 'log-1', status: 'sent' }]
      });

      const response = await request(app)
        .get('/api/users/user-123/email-logs')
        .query({ status: 'sent' });

      expect(response.status).toBe(200);
      expect(EmailLog.findByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ status: 'sent' })
      );
    });

    test('should filter logs by date range', async () => {
      jest.spyOn(EmailLog, 'findByUserId').mockResolvedValue({
        count: 0,
        total: 0,
        logs: []
      });

      const response = await request(app)
        .get('/api/users/user-123/email-logs')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(EmailLog.findByUserId).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
      );
    });
  });

  describe('GET /api/users/:userId/email-stats', () => {
    test('should return 403 if unauthorized', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/users/user-456/email-stats');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should allow admin to view other user stats', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailLog, 'getStatistics').mockResolvedValue({
        totalSent: 0,
        totalFailed: 0
      });

      const response = await request(app).get('/api/users/user-456/email-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should get email stats with default days', async () => {
      jest.spyOn(EmailLog, 'getStatistics').mockResolvedValue({
        totalSent: 50,
        totalFailed: 5,
        totalBounced: 2,
        successRate: 90.9
      });

      const response = await request(app).get('/api/users/user-123/email-stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSent).toBe(50);
      expect(EmailLog.getStatistics).toHaveBeenCalledWith('user-123', 30);
    });

    test('should get email stats with custom days', async () => {
      jest.spyOn(EmailLog, 'getStatistics').mockResolvedValue({
        totalSent: 100,
        totalFailed: 10
      });

      const response = await request(app)
        .get('/api/users/user-123/email-stats')
        .query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(EmailLog.getStatistics).toHaveBeenCalledWith('user-123', 7);
    });
  });
});
