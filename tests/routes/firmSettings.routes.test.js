/**
 * Firm Settings Routes Tests
 * Tests for src/routes/firmSettings.routes.js
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
const mockCanCreate = jest.fn();

jest.mock('../../src/middleware/rbac', () => ({
  getUserContext: mockGetUserContext,
  canCreate: mockCanCreate,
  ROLES: {
    ROOT: 0,
    ADMIN: 1,
    SUPPORT: 2,
    INVESTOR: 3,
    GUEST: 4
  }
}));

jest.mock('../../src/middleware/upload', () => ({
  handleFirmLogoUpload: (req, res, next) => {
    // Simulate file upload middleware - no file by default
    next();
  },
}));

const mockUploadToSupabase = jest.fn();

jest.mock('../../src/utils/fileUpload', () => ({
  uploadToSupabase: mockUploadToSupabase
}));

const { getSupabase } = require('../../src/config/database');
const FirmSettings = require('../../src/models/supabase/firmSettings');

describe('Firm Settings Routes', () => {
  let app;
  let mockSupabase;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/firm-settings', require('../../src/routes/firmSettings.routes'));
  });

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    getSupabase.mockReturnValue(mockSupabase);
    jest.clearAllMocks();

    // Default to ROOT role with create permissions
    mockGetUserContext.mockReturnValue({
      userId: 'user-123',
      userRole: 0 // ROOT
    });
    mockCanCreate.mockReturnValue(true);
  });

  describe('GET /api/firm-settings/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/firm-settings/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Firm Settings API');
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/firm-settings/logo', () => {
    test('should return default values when no settings exist', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);

      const response = await request(app).get('/api/firm-settings/logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firmLogo).toBeNull();
      expect(response.body.data.firmName).toBe('PoliBit');
    });

    test('should return firm logo and name when settings exist', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmLogo: 'https://example.com/logo.png',
        firmName: 'Acme Corp'
      });

      const response = await request(app).get('/api/firm-settings/logo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firmLogo).toBe('https://example.com/logo.png');
      expect(response.body.data.firmName).toBe('Acme Corp');
    });
  });

  describe('GET /api/firm-settings', () => {
    test('should return 404 if no settings exist', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);

      const response = await request(app).get('/api/firm-settings');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No firm settings found');
    });

    test('should return firm settings', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp',
        firmLogo: 'https://example.com/logo.png',
        firmDescription: 'A great company',
        firmWebsite: 'https://acme.com'
      });

      const response = await request(app).get('/api/firm-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firmName).toBe('Acme Corp');
    });
  });

  describe('POST /api/firm-settings', () => {
    test('should return 403 if user cannot create', async () => {
      mockCanCreate.mockReturnValue(false);

      const response = await request(app)
        .post('/api/firm-settings')
        .send({ firmName: 'Test Corp' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only Root and Admin');
    });

    test('should return 400 if settings already exist', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'existing-settings',
        firmName: 'Existing Corp'
      });

      const response = await request(app)
        .post('/api/firm-settings')
        .send({ firmName: 'Test Corp' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exist');
    });

    test('should create settings with minimal data', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);
      jest.spyOn(FirmSettings, 'create').mockResolvedValue({
        id: 'settings-123',
        firmName: 'My Firm',
        userId: 'user-123'
      });

      const response = await request(app)
        .post('/api/firm-settings')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created successfully');
      expect(FirmSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firmName: 'My Firm',
          userId: 'user-123'
        })
      );
    });

    test('should create settings with all fields', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);
      jest.spyOn(FirmSettings, 'create').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp',
        firmLogo: 'https://example.com/logo.png',
        firmDescription: 'A great company',
        firmWebsite: 'https://acme.com',
        firmAddress: '123 Main St',
        firmPhone: '555-1234',
        firmEmail: 'info@acme.com',
        userId: 'user-123'
      });

      const response = await request(app)
        .post('/api/firm-settings')
        .send({
          firmName: 'Acme Corp',
          firmLogo: 'https://example.com/logo.png',
          firmDescription: 'A great company',
          firmWebsite: 'https://acme.com',
          firmAddress: '123 Main St',
          firmPhone: '555-1234',
          firmEmail: 'info@acme.com'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.firmName).toBe('Acme Corp');
      expect(response.body.data.firmEmail).toBe('info@acme.com');
    });

    test('should trim string fields', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);
      jest.spyOn(FirmSettings, 'create').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });

      const response = await request(app)
        .post('/api/firm-settings')
        .send({
          firmName: '  Acme Corp  ',
          firmDescription: '  Description  '
        });

      expect(response.status).toBe(201);
      expect(FirmSettings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firmName: 'Acme Corp',
          firmDescription: 'Description'
        })
      );
    });
  });

  describe('PUT /api/firm-settings', () => {
    test('should return 403 if user cannot create', async () => {
      mockCanCreate.mockReturnValue(false);

      const response = await request(app)
        .put('/api/firm-settings')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only Root and Admin');
    });

    test('should return 404 if no settings exist', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);

      const response = await request(app)
        .put('/api/firm-settings')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No firm settings found');
    });

    test('should return 400 if no valid fields provided', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });

      const response = await request(app)
        .put('/api/firm-settings')
        .send({ invalidField: 'value' });

      expect(response.status).toBe(400);
    });

    test('should update settings without file upload', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndUpdate').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Updated Corp',
        firmWebsite: 'https://updated.com'
      });

      const response = await request(app)
        .put('/api/firm-settings')
        .send({
          firmName: 'Updated Corp',
          firmWebsite: 'https://updated.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      expect(FirmSettings.findByIdAndUpdate).toHaveBeenCalledWith(
        'settings-123',
        expect.objectContaining({
          firmName: 'Updated Corp',
          firmWebsite: 'https://updated.com',
          userId: 'user-123'
        })
      );
    });

    test('should handle file upload', async () => {
      // Create a special app instance with file upload simulation
      const fileApp = express();
      fileApp.use(express.json());
      fileApp.use('/api/firm-settings', (req, res, next) => {
        if (req.method === 'PUT') {
          // Simulate file upload
          req.file = {
            buffer: Buffer.from('fake-image-data'),
            originalname: 'logo.png',
            mimetype: 'image/png',
            size: 1024
          };
        }
        next();
      }, require('../../src/routes/firmSettings.routes'));

      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndUpdate').mockResolvedValue({
        id: 'settings-123',
        firmLogo: 'https://storage.supabase.co/logo.png'
      });

      mockUploadToSupabase.mockResolvedValue({
        publicUrl: 'https://storage.supabase.co/logo.png',
        path: 'firm-logos/logo.png'
      });

      const response = await request(fileApp)
        .put('/api/firm-settings')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(200);
      expect(mockUploadToSupabase).toHaveBeenCalledWith(
        expect.any(Buffer),
        'logo.png',
        'image/png',
        'firm-logos',
        'firm-logos'
      );
    });

    test('should return 500 if file upload fails', async () => {
      const fileApp = express();
      fileApp.use(express.json());
      fileApp.use('/api/firm-settings', (req, res, next) => {
        if (req.method === 'PUT') {
          req.file = {
            buffer: Buffer.from('fake-image-data'),
            originalname: 'logo.png',
            mimetype: 'image/png'
          };
        }
        next();
      }, require('../../src/routes/firmSettings.routes'));

      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });

      mockUploadToSupabase.mockRejectedValue(new Error('Upload failed'));

      const response = await request(fileApp)
        .put('/api/firm-settings')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Error uploading firm logo');
    });

    test('should handle non-string field values', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndUpdate').mockResolvedValue({
        id: 'settings-123'
      });

      const response = await request(app)
        .put('/api/firm-settings')
        .send({
          firmName: 123 // Non-string value
        });

      expect(response.status).toBe(200);
      expect(FirmSettings.findByIdAndUpdate).toHaveBeenCalledWith(
        'settings-123',
        expect.objectContaining({
          firmName: 123
        })
      );
    });
  });

  describe('PUT /api/firm-settings/:id', () => {
    test('should return 403 if user cannot create', async () => {
      mockCanCreate.mockReturnValue(false);

      const response = await request(app)
        .put('/api/firm-settings/settings-123')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(403);
    });

    test('should return 400 if settings not found', async () => {
      jest.spyOn(FirmSettings, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .put('/api/firm-settings/settings-123')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(400);
    });

    test('should return 400 if no valid fields provided', async () => {
      jest.spyOn(FirmSettings, 'findById').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });

      const response = await request(app)
        .put('/api/firm-settings/settings-123')
        .send({ invalidField: 'value' });

      expect(response.status).toBe(400);
    });

    test('should update settings by ID', async () => {
      jest.spyOn(FirmSettings, 'findById').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndUpdate').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Updated Corp'
      });

      const response = await request(app)
        .put('/api/firm-settings/settings-123')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(FirmSettings.findByIdAndUpdate).toHaveBeenCalledWith(
        'settings-123',
        expect.objectContaining({
          firmName: 'Updated Corp',
          userId: 'user-123'
        })
      );
    });

    test('should handle file upload with ID', async () => {
      const fileApp = express();
      fileApp.use(express.json());
      fileApp.use('/api/firm-settings', (req, res, next) => {
        if (req.method === 'PUT' && req.url.startsWith('/settings-123')) {
          req.file = {
            buffer: Buffer.from('fake-image-data'),
            originalname: 'logo.png',
            mimetype: 'image/png'
          };
        }
        next();
      }, require('../../src/routes/firmSettings.routes'));

      jest.spyOn(FirmSettings, 'findById').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndUpdate').mockResolvedValue({
        id: 'settings-123',
        firmLogo: 'https://storage.supabase.co/logo.png'
      });

      mockUploadToSupabase.mockResolvedValue({
        publicUrl: 'https://storage.supabase.co/logo.png',
        path: 'firm-logos/logo.png'
      });

      const response = await request(fileApp)
        .put('/api/firm-settings/settings-123')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(200);
      expect(mockUploadToSupabase).toHaveBeenCalled();
    });

    test('should return 500 if file upload fails with ID', async () => {
      const fileApp = express();
      fileApp.use(express.json());
      fileApp.use('/api/firm-settings', (req, res, next) => {
        if (req.method === 'PUT' && req.url.startsWith('/settings-123')) {
          req.file = {
            buffer: Buffer.from('fake-image-data'),
            originalname: 'logo.png',
            mimetype: 'image/png'
          };
        }
        next();
      }, require('../../src/routes/firmSettings.routes'));

      jest.spyOn(FirmSettings, 'findById').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });

      mockUploadToSupabase.mockRejectedValue(new Error('Upload failed'));

      const response = await request(fileApp)
        .put('/api/firm-settings/settings-123')
        .send({ firmName: 'Updated Corp' });

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Error uploading firm logo');
    });
  });

  describe('DELETE /api/firm-settings', () => {
    test('should return 403 if user cannot create', async () => {
      mockCanCreate.mockReturnValue(false);

      const response = await request(app).delete('/api/firm-settings');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Only Root and Admin');
    });

    test('should return 400 if no settings found', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue(null);

      const response = await request(app).delete('/api/firm-settings');

      expect(response.status).toBe(400);
    });

    test('should delete firm settings successfully', async () => {
      jest.spyOn(FirmSettings, 'get').mockResolvedValue({
        id: 'settings-123',
        firmName: 'Acme Corp'
      });
      jest.spyOn(FirmSettings, 'findByIdAndDelete').mockResolvedValue(true);

      const response = await request(app).delete('/api/firm-settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
      expect(FirmSettings.findByIdAndDelete).toHaveBeenCalledWith('settings-123');
    });
  });
});
