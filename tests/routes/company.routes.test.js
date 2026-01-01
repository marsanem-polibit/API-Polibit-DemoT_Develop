/**
 * Company Routes Tests
 * Tests for src/routes/company.routes.js
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
    req.user = { id: 'user-123' };
    next();
  },
}));

jest.mock('../../src/middleware/upload', () => ({
  uploadCompanyLogo: {
    single: (fieldName) => (req, res, next) => {
      if (req.method === 'POST' && req.path.includes('/logo')) {
        req.file = {
          buffer: Buffer.from('mock file content'),
          originalname: 'logo.png',
          filename: 'company-logo-123.png',
          mimetype: 'image/png',
          size: 2048
        };
      }
      next();
    },
  },
  deleteOldCompanyLogo: jest.fn(),
}));

jest.mock('../../src/utils/helpers', () => ({
  getFullImageUrl: jest.fn((path, req) => {
    if (!path) return null;
    return `http://localhost:5000${path}`;
  }),
}));

const { getSupabase } = require('../../src/config/database');
const { deleteOldCompanyLogo } = require('../../src/middleware/upload');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { Company } = require('../../src/models/supabase');

describe('Company Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Add mock auth middleware
    app.use((req, res, next) => {
      req.auth = { userId: 'user-123', userRole: 1 };
      req.user = { id: 'user-123' };
      next();
    });

    // Mount routes
    const companyRoutes = require('../../src/routes/company.routes');
    app.use('/api/company', companyRoutes);

    // Add error handler middleware
    app.use(errorHandler);
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();
  });

  describe('GET /api/company/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/company/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Company API');
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/company', () => {
    test('should get existing company information', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmName: 'Acme Corp',
        firmEmail: 'info@acme.com',
        firmPhone: '+1234567890',
        websiteURL: 'https://acme.com',
        address: '123 Main St',
        description: 'A great company',
        firmLogo: '/uploads/company-logos/logo.png',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await request(app).get('/api/company');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firmName).toBe('Acme Corp');
      expect(response.body.data.firmEmail).toBe('info@acme.com');
    });

    test('should create new company with empty fields if not exists', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue(null);

      jest.spyOn(Company, 'create').mockResolvedValue({
        id: 'company-new',
        userId: 'user-123',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: '',
        firmLogo: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await request(app).get('/api/company');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firmName).toBe('');
      expect(Company.create).toHaveBeenCalledWith({
        userId: 'user-123',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: ''
      });
    });
  });

  describe('PUT /api/company', () => {
    test('should update company information successfully', async () => {
      const updateData = {
        firmName: 'Updated Corp',
        firmEmail: 'contact@updated.com',
        firmPhone: '+9876543210',
        websiteURL: 'https://updated.com',
        address: '456 Oak Ave',
        description: 'Updated description'
      };

      const now = new Date().toISOString();
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        ...updateData,
        firmLogo: null,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: now
      });

      const response = await request(app)
        .put('/api/company')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company updated successfully');
      expect(response.body.data.firmName).toBe('Updated Corp');
    });

    test('should create company if it does not exist (upsert)', async () => {
      const companyData = {
        firmName: 'New Company',
        firmEmail: 'info@newcompany.com'
      };

      const now = new Date().toISOString();
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-new',
        userId: 'user-123',
        firmName: 'New Company',
        firmEmail: 'info@newcompany.com',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: '',
        firmLogo: null,
        createdAt: now,
        updatedAt: now
      });

      const response = await request(app)
        .put('/api/company')
        .send(companyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company created successfully');
    });

    test('should return 400 if no valid fields provided', async () => {
      const response = await request(app)
        .put('/api/company')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No valid fields provided for update');
    });

    test('should return 400 if firmName is empty', async () => {
      const response = await request(app)
        .put('/api/company')
        .send({ firmName: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if firmEmail is invalid', async () => {
      const response = await request(app)
        .put('/api/company')
        .send({ firmEmail: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if firmEmail is empty', async () => {
      const response = await request(app)
        .put('/api/company')
        .send({ firmEmail: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 400 if websiteURL is invalid', async () => {
      const response = await request(app)
        .put('/api/company')
        .send({ websiteURL: 'not a valid url!!!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should accept valid websiteURL formats', async () => {
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        websiteURL: 'https://example.com',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        address: '',
        description: '',
        firmLogo: null,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      const validURLs = [
        'https://example.com',
        'http://example.com',
        'https://subdomain.example.com',
        'https://example.com/path',
        'http://localhost:3000',
        'https://192.168.1.1'
      ];

      for (const url of validURLs) {
        const response = await request(app)
          .put('/api/company')
          .send({ websiteURL: url });

        expect(response.status).toBe(200);
      }
    });

    test('should lowercase firmEmail', async () => {
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmEmail: 'info@company.com',
        firmName: '',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: '',
        firmLogo: null,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await request(app)
        .put('/api/company')
        .send({ firmEmail: 'INFO@COMPANY.COM' });

      expect(response.status).toBe(200);
      expect(Company.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-123' },
        expect.objectContaining({ firmEmail: 'info@company.com' }),
        { upsert: true }
      );
    });

    test('should trim whitespace from fields', async () => {
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmName: 'Trimmed Corp',
        firmPhone: '123456',
        address: '123 Main St',
        description: 'Description',
        firmEmail: '',
        websiteURL: '',
        firmLogo: null,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await request(app)
        .put('/api/company')
        .send({
          firmName: '  Trimmed Corp  ',
          firmPhone: '  123456  ',
          address: '  123 Main St  ',
          description: '  Description  '
        });

      expect(response.status).toBe(200);
      expect(Company.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: 'user-123' },
        expect.objectContaining({
          firmName: 'Trimmed Corp',
          firmPhone: '123456',
          address: '123 Main St',
          description: 'Description'
        }),
        { upsert: true }
      );
    });

    test('should allow empty websiteURL', async () => {
      jest.spyOn(Company, 'findOneAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        websiteURL: '',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        address: '',
        description: '',
        firmLogo: null,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      });

      const response = await request(app)
        .put('/api/company')
        .send({ websiteURL: '   ' });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/company/logo', () => {
    test('should upload company logo successfully', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: '/uploads/company-logos/old-logo.png'
      });

      jest.spyOn(Company, 'findByIdAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: '/uploads/company-logos/company-logo-123.png'
      });

      const response = await request(app)
        .post('/api/company/logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company logo uploaded successfully');
      expect(response.body.data.filename).toBe('company-logo-123.png');
      expect(deleteOldCompanyLogo).toHaveBeenCalledWith('/uploads/company-logos/old-logo.png');
    });

    test('should create company if it does not exist when uploading logo', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue(null);

      jest.spyOn(Company, 'create').mockResolvedValue({
        id: 'company-new',
        userId: 'user-123',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: '',
        firmLogo: null
      });

      jest.spyOn(Company, 'findByIdAndUpdate').mockResolvedValue({
        id: 'company-new',
        userId: 'user-123',
        firmLogo: '/uploads/company-logos/company-logo-123.png'
      });

      const response = await request(app)
        .post('/api/company/logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Company.create).toHaveBeenCalledWith({
        userId: 'user-123',
        firmName: '',
        firmEmail: '',
        firmPhone: '',
        websiteURL: '',
        address: '',
        description: ''
      });
    });

    test('should not delete old logo if company has no logo', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: null
      });

      jest.spyOn(Company, 'findByIdAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: '/uploads/company-logos/company-logo-123.png'
      });

      const response = await request(app)
        .post('/api/company/logo');

      expect(response.status).toBe(200);
      expect(deleteOldCompanyLogo).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/company/logo', () => {
    test('should delete company logo successfully', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: '/uploads/company-logos/logo.png'
      });

      jest.spyOn(Company, 'findByIdAndUpdate').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: null
      });

      const response = await request(app).delete('/api/company/logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Company logo deleted successfully');
      expect(deleteOldCompanyLogo).toHaveBeenCalledWith('/uploads/company-logos/logo.png');
      expect(Company.findByIdAndUpdate).toHaveBeenCalledWith('company-123', {
        firmLogo: null
      });
    });

    test('should return 404 if company not found', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue(null);

      const response = await request(app).delete('/api/company/logo');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Company not found');
    });

    test('should return 404 if no company logo exists', async () => {
      jest.spyOn(Company, 'findByUserId').mockResolvedValue({
        id: 'company-123',
        userId: 'user-123',
        firmLogo: null
      });

      const response = await request(app).delete('/api/company/logo');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No company logo to delete');
    });
  });
});
