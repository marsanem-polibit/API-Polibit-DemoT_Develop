/**
 * Email Domain Routes Tests
 * Tests for src/routes/emailDomain.routes.js
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

const mockCreateDomain = jest.fn();
const mockGetDomain = jest.fn();
const mockVerifyDomain = jest.fn();
const mockListDomains = jest.fn();
const mockDeleteDomain = jest.fn();
const mockFormatDnsRecords = jest.fn();

jest.mock('../../src/utils/resendDomains', () => ({
  createDomain: mockCreateDomain,
  getDomain: mockGetDomain,
  verifyDomain: mockVerifyDomain,
  listDomains: mockListDomains,
  deleteDomain: mockDeleteDomain,
  formatDnsRecords: mockFormatDnsRecords
}));

const mockClearDomainCache = jest.fn();

jest.mock('../../src/utils/emailSender', () => ({
  clearDomainCache: mockClearDomainCache
}));

const { getSupabase } = require('../../src/config/database');
const { EmailDomain } = require('../../src/models/supabase');

describe('Email Domain Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/email-domains', require('../../src/routes/emailDomain.routes'));
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();

    // Default to ROOT role
    mockGetUserContext.mockReturnValue({
      userId: 'user-123',
      userRole: 0 // ROOT
    });

    // Default formatDnsRecords to return records as-is
    mockFormatDnsRecords.mockImplementation((records) => records);
  });

  describe('GET /api/email-domains', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/email-domains');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only ROOT and ADMIN');
    });

    test('should allow ADMIN to view domains', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN
      });

      jest.spyOn(EmailDomain, 'findAll').mockResolvedValue([]);

      const response = await request(app).get('/api/email-domains');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should get all email domains', async () => {
      jest.spyOn(EmailDomain, 'findAll').mockResolvedValue([
        {
          id: 'domain-1',
          domainName: 'example.com',
          status: 'verified'
        },
        {
          id: 'domain-2',
          domainName: 'test.com',
          status: 'pending'
        }
      ]);

      const response = await request(app).get('/api/email-domains');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/email-domains/verified', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 2 // SUPPORT
      });

      const response = await request(app).get('/api/email-domains/verified');

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Unauthorized');
    });

    test('should get only verified domains', async () => {
      jest.spyOn(EmailDomain, 'findVerified').mockResolvedValue([
        {
          id: 'domain-1',
          domainName: 'example.com',
          status: 'verified'
        }
      ]);

      const response = await request(app).get('/api/email-domains/verified');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].status).toBe('verified');
    });
  });

  describe('GET /api/email-domains/:id', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(403);
    });

    test('should return 404 if domain not found', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(null);

      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    test('should get domain without resendDomainId', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        status: 'pending',
        resendDomainId: null
      });

      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('domain-123');
      expect(mockGetDomain).not.toHaveBeenCalled();
    });

    test('should update status if changed in Resend', async () => {
      const mockDomain = {
        id: 'domain-123',
        domainName: 'example.com',
        status: 'pending',
        resendDomainId: 'resend-123'
      };

      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(mockDomain);
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue({
        ...mockDomain,
        status: 'verified'
      });

      mockGetDomain.mockResolvedValue({
        status: 'verified',
        records: [{ type: 'TXT', name: '_resend', value: 'verification-token' }]
      });

      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(mockGetDomain).toHaveBeenCalledWith('resend-123');
      expect(EmailDomain.updateStatus).toHaveBeenCalledWith(
        'domain-123',
        'verified',
        expect.any(Array)
      );
    });

    test('should handle Resend API errors gracefully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        status: 'pending',
        resendDomainId: 'resend-123'
      });

      mockGetDomain.mockRejectedValue(new Error('Resend API error'));

      // Should still return the domain even if Resend call fails
      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should not update status if unchanged', async () => {
      const mockDomain = {
        id: 'domain-123',
        domainName: 'example.com',
        status: 'verified',
        resendDomainId: 'resend-123'
      };

      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(mockDomain);
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue(mockDomain);

      mockGetDomain.mockResolvedValue({
        status: 'verified',
        records: []
      });

      const response = await request(app).get('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(EmailDomain.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/email-domains', () => {
    test('should return 403 if user is not ROOT', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN - not ROOT
      });

      const response = await request(app)
        .post('/api/email-domains')
        .send({ domainName: 'example.com' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only ROOT users');
    });

    test('should return 400 if domainName is missing', async () => {
      const response = await request(app)
        .post('/api/email-domains')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should return 409 if domain already exists', async () => {
      jest.spyOn(EmailDomain, 'findByDomainName').mockResolvedValue({
        id: 'existing-domain',
        domainName: 'example.com'
      });

      const response = await request(app)
        .post('/api/email-domains')
        .send({ domainName: 'example.com' });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already registered');
    });

    test('should return 400 if Resend domain creation fails', async () => {
      jest.spyOn(EmailDomain, 'findByDomainName').mockResolvedValue(null);
      mockCreateDomain.mockRejectedValue(new Error('Invalid domain name'));

      const response = await request(app)
        .post('/api/email-domains')
        .send({ domainName: 'example.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid domain name');
    });

    test('should create domain successfully', async () => {
      jest.spyOn(EmailDomain, 'findByDomainName').mockResolvedValue(null);
      jest.spyOn(EmailDomain, 'create').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123',
        domainName: 'example.com',
        status: 'pending'
      });

      mockCreateDomain.mockResolvedValue({
        id: 'resend-123',
        name: 'example.com',
        status: 'pending',
        region: 'us-east-1',
        records: [
          { type: 'TXT', name: '_resend', value: 'verification-token' }
        ]
      });

      const response = await request(app)
        .post('/api/email-domains')
        .send({ domainName: 'example.com', region: 'us-east-1' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('add the DNS records');
      expect(mockCreateDomain).toHaveBeenCalledWith('example.com', 'us-east-1');
      expect(EmailDomain.create).toHaveBeenCalledWith({
        resendDomainId: 'resend-123',
        domainName: 'example.com',
        status: 'pending',
        region: 'us-east-1',
        dnsRecords: expect.any(Array)
      });
    });

    test('should convert domain name to lowercase', async () => {
      jest.spyOn(EmailDomain, 'findByDomainName').mockResolvedValue(null);
      jest.spyOn(EmailDomain, 'create').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com'
      });

      mockCreateDomain.mockResolvedValue({
        id: 'resend-123',
        name: 'example.com',
        status: 'pending',
        region: 'us-east-1',
        records: []
      });

      const response = await request(app)
        .post('/api/email-domains')
        .send({ domainName: 'EXAMPLE.COM' });

      expect(response.status).toBe(201);
      expect(mockCreateDomain).toHaveBeenCalledWith('example.com', undefined);
    });
  });

  describe('POST /api/email-domains/:id/verify', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 2 // SUPPORT
      });

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(403);
    });

    test('should return 404 if domain not found', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(null);

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(404);
    });

    test('should return 400 if domain not linked to Resend', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        resendDomainId: null
      });

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not linked to Resend');
    });

    test('should handle verify call errors gracefully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue({
        id: 'domain-123',
        status: 'verified'
      });

      mockVerifyDomain.mockRejectedValue(new Error('Verify failed'));
      mockGetDomain.mockResolvedValue({
        status: 'verified',
        records: []
      });

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
    });

    test('should return 400 if getting domain status fails', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });

      mockVerifyDomain.mockResolvedValue({});
      mockGetDomain.mockRejectedValue(new Error('API error'));

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to get domain status');
    });

    test('should verify domain successfully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue({
        id: 'domain-123',
        status: 'verified'
      });

      mockVerifyDomain.mockResolvedValue({});
      mockGetDomain.mockResolvedValue({
        status: 'verified',
        records: [{ type: 'TXT', name: '_resend', value: 'token' }]
      });

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
      expect(response.body.message).toContain('verified successfully');
      expect(mockClearDomainCache).toHaveBeenCalled();
    });

    test('should return not verified message if domain not verified', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue({
        id: 'domain-123',
        status: 'pending'
      });

      mockVerifyDomain.mockResolvedValue({});
      mockGetDomain.mockResolvedValue({
        status: 'pending',
        records: []
      });

      const response = await request(app).post('/api/email-domains/domain-123/verify');

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.message).toContain('not yet verified');
      expect(mockClearDomainCache).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/email-domains/:id/config', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 3 // INVESTOR
      });

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({ fromEmail: 'noreply@example.com' });

      expect(response.status).toBe(403);
    });

    test('should return 404 if domain not found', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({ fromEmail: 'noreply@example.com' });

      expect(response.status).toBe(404);
    });

    test('should return 400 if fromEmail domain does not match', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com'
      });

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({ fromEmail: 'noreply@different.com' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('must use the domain');
    });

    test('should return 400 if replyToEmail format is invalid', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com'
      });

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({ replyToEmail: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid reply-to email');
    });

    test('should update email config successfully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com'
      });
      jest.spyOn(EmailDomain, 'updateEmailConfig').mockResolvedValue({
        id: 'domain-123',
        fromEmail: 'noreply@example.com',
        fromName: 'Example Team',
        replyToEmail: 'support@example.com'
      });

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({
          fromEmail: 'noreply@example.com',
          fromName: 'Example Team',
          replyToEmail: 'support@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      expect(mockClearDomainCache).toHaveBeenCalled();
      expect(EmailDomain.updateEmailConfig).toHaveBeenCalledWith(
        'domain-123',
        {
          fromEmail: 'noreply@example.com',
          fromName: 'Example Team',
          replyToEmail: 'support@example.com'
        }
      );
    });

    test('should handle case-insensitive domain matching', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'EXAMPLE.COM'
      });
      jest.spyOn(EmailDomain, 'updateEmailConfig').mockResolvedValue({
        id: 'domain-123',
        fromEmail: 'noreply@example.com'
      });

      const response = await request(app)
        .put('/api/email-domains/domain-123/config')
        .send({ fromEmail: 'noreply@example.com' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/email-domains/:id', () => {
    test('should return 403 if user is not ROOT', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'admin-123',
        userRole: 1 // ADMIN - not ROOT
      });

      const response = await request(app).delete('/api/email-domains/domain-123');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only ROOT users');
    });

    test('should return 404 if domain not found', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(null);

      const response = await request(app).delete('/api/email-domains/domain-123');

      expect(response.status).toBe(404);
    });

    test('should delete domain without resendDomainId', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        resendDomainId: null
      });
      jest.spyOn(EmailDomain, 'delete').mockResolvedValue(true);

      const response = await request(app).delete('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockDeleteDomain).not.toHaveBeenCalled();
      expect(mockClearDomainCache).toHaveBeenCalled();
    });

    test('should continue deletion even if Resend deletion fails', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'delete').mockResolvedValue(true);

      mockDeleteDomain.mockRejectedValue(new Error('Resend API error'));

      const response = await request(app).delete('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(EmailDomain.delete).toHaveBeenCalledWith('domain-123');
    });

    test('should delete domain successfully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'delete').mockResolvedValue(true);

      mockDeleteDomain.mockResolvedValue({ success: true });

      const response = await request(app).delete('/api/email-domains/domain-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(mockDeleteDomain).toHaveBeenCalledWith('resend-123');
      expect(EmailDomain.delete).toHaveBeenCalledWith('domain-123');
      expect(mockClearDomainCache).toHaveBeenCalled();
    });
  });

  describe('GET /api/email-domains/:id/dns-records', () => {
    test('should return 403 if user is not ROOT or ADMIN', async () => {
      mockGetUserContext.mockReturnValue({
        userId: 'user-123',
        userRole: 2 // SUPPORT
      });

      const response = await request(app).get('/api/email-domains/domain-123/dns-records');

      expect(response.status).toBe(403);
    });

    test('should return 404 if domain not found', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue(null);

      const response = await request(app).get('/api/email-domains/domain-123/dns-records');

      expect(response.status).toBe(404);
    });

    test('should return 400 if domain not linked to Resend', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        resendDomainId: null
      });

      const response = await request(app).get('/api/email-domains/domain-123/dns-records');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not linked to Resend');
    });

    test('should return 400 if getting DNS records fails', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        resendDomainId: 'resend-123'
      });

      mockGetDomain.mockRejectedValue(new Error('API error'));

      const response = await request(app).get('/api/email-domains/domain-123/dns-records');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Failed to get DNS records');
    });

    test('should get DNS records successfully', async () => {
      jest.spyOn(EmailDomain, 'findById').mockResolvedValue({
        id: 'domain-123',
        domainName: 'example.com',
        resendDomainId: 'resend-123'
      });
      jest.spyOn(EmailDomain, 'updateStatus').mockResolvedValue({});

      const mockRecords = [
        { type: 'TXT', name: '_resend', value: 'verification-token' },
        { type: 'CNAME', name: 'em', value: 'feedback.resend.com' }
      ];

      mockGetDomain.mockResolvedValue({
        status: 'verified',
        records: mockRecords
      });

      mockFormatDnsRecords.mockReturnValue(mockRecords);

      const response = await request(app).get('/api/email-domains/domain-123/dns-records');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.domainName).toBe('example.com');
      expect(response.body.data.status).toBe('verified');
      expect(response.body.data.records).toEqual(mockRecords);
      expect(EmailDomain.updateStatus).toHaveBeenCalledWith(
        'domain-123',
        'verified',
        mockRecords
      );
    });
  });
});
