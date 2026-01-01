/**
 * Vudy Routes Tests
 * Tests for src/routes/vudy.routes.js
 */

const express = require('express');
const request = require('supertest');

// Mock apiManager
const mockApiManager = {
  createRequest: jest.fn(),
  getSingleRequest: jest.fn(),
  getMultipleRequests: jest.fn(),
};

jest.mock('../../src/services/apiManager', () => mockApiManager);

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.auth = { userId: 'user-123', userRole: 1 };
    req.user = { id: 'user-123', role: 1 };
    next();
  },
}));

const { errorHandler } = require('../../src/middleware/errorHandler');

describe('Vudy Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const vudyRoutes = require('../../src/routes/vudy.routes');
    app.use('/api/vudy', vudyRoutes);

    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/vudy/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/vudy/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Vudy API');
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/vudy/requests', () => {
    test('should create a new payment request successfully', async () => {
      const requestData = {
        amountInUsd: 100.50,
        note: 'Payment for services',
        receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
        vendorId: 'vendor-123',
        generatedId: 'gen-456',
      };

      mockApiManager.createRequest.mockResolvedValue({
        statusCode: 201,
        body: {
          id: 'request-123',
          ...requestData,
          status: 'pending',
        },
      });

      const response = await request(app)
        .post('/api/vudy/requests')
        .send(requestData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment request created successfully');
      expect(response.body.data.id).toBe('request-123');
      expect(mockApiManager.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Object) }),
        requestData
      );
    });

    test('should return 400 if amountInUsd is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('amountInUsd is required');
    });

    test('should return 400 if amountInUsd is not greater than 0', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: -5,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('amountInUsd must be greater than 0');
    });

    test('should return 400 if note is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('note is required');
    });

    test('should return 400 if receiverWalletAddress is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('receiverWalletAddress is required');
    });

    test('should return 400 if vendorId is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('vendorId is required');
    });

    test('should return 400 if generatedId is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          vendorId: 'vendor-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('generatedId is required');
    });

    test('should return 400 if receiverWalletAddress has invalid format', async () => {
      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: 'invalid-address',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid receiverWalletAddress format');
    });

    test('should validate wallet address with correct format', async () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';

      mockApiManager.createRequest.mockResolvedValue({
        statusCode: 201,
        body: { id: 'request-123' },
      });

      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: validAddress,
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(201);
    });

    test('should handle error from apiManager', async () => {
      mockApiManager.createRequest.mockResolvedValue({
        statusCode: 500,
        error: 'Internal server error',
        body: { details: 'API error' },
      });

      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Failed to create payment request');
    });

    test('should use default status code 500 when error has no statusCode', async () => {
      mockApiManager.createRequest.mockResolvedValue({
        error: 'Unknown error',
        body: {},
      });

      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(500);
    });

    test('should use default status code 201 on success without statusCode', async () => {
      mockApiManager.createRequest.mockResolvedValue({
        body: { id: 'request-123' },
      });

      const response = await request(app)
        .post('/api/vudy/requests')
        .send({
          amountInUsd: 100,
          note: 'Payment for services',
          receiverWalletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
          vendorId: 'vendor-123',
          generatedId: 'gen-456',
        });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/vudy/requests/:requestId', () => {
    test('should get a single payment request by ID', async () => {
      const mockRequest = {
        id: 'request-123',
        amountInUsd: 100,
        note: 'Payment for services',
        status: 'pending',
      };

      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 200,
        body: mockRequest,
      });

      const response = await request(app).get('/api/vudy/requests/request-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('request-123');
      expect(mockApiManager.getSingleRequest).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Object) }),
        expect.objectContaining({ requestID: 'request-123' })
      );
    });

    test('should return 400 if requestId is empty', async () => {
      const response = await request(app).get('/api/vudy/requests/ ');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should return 404 if request not found', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 404,
        error: 'Not found',
      });

      const response = await request(app).get('/api/vudy/requests/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.message).toBeDefined();
    });

    test('should handle other errors from apiManager', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' },
      });

      const response = await request(app).get('/api/vudy/requests/request-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
      expect(response.body.message).toBe('Failed to fetch payment request');
    });

    test('should use default status code 500 on error without statusCode', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        error: 'Unknown error',
      });

      const response = await request(app).get('/api/vudy/requests/request-123');

      expect(response.status).toBe(500);
    });

    test('should use default status code 200 on success without statusCode', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        body: { id: 'request-123' },
      });

      const response = await request(app).get('/api/vudy/requests/request-123');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/vudy/requests', () => {
    test('should get multiple requests by IDs', async () => {
      const mockRequests = [
        { id: 'request-1', amountInUsd: 100 },
        { id: 'request-2', amountInUsd: 200 },
      ];

      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: mockRequests,
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1,request-2' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toEqual(mockRequests);
    });

    test('should get multiple requests by vendorIDs', async () => {
      const mockRequests = [
        { id: 'request-1', vendorId: 'vendor-123' },
        { id: 'request-2', vendorId: 'vendor-123' },
      ];

      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: mockRequests,
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ vendorIDs: 'vendor-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
    });

    test('should return 400 if no filters provided', async () => {
      const response = await request(app).get('/api/vudy/requests');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Please provide at least one filter');
    });

    test('should handle error from apiManager', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' },
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
      expect(response.body.message).toBe('Failed to fetch payment requests');
    });

    test('should return count 0 for empty array response', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: [],
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'nonexistent' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });

    test('should handle null body response', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: null,
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });

    test('should handle non-array body response', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: { notAnArray: true },
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1' });

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
    });

    test('should use default status code 500 on error', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        error: 'Unknown error',
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1' });

      expect(response.status).toBe(500);
    });

    test('should use default status code 200 on success', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        body: [],
      });

      const response = await request(app)
        .get('/api/vudy/requests')
        .query({ ids: 'request-1' });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/vudy/requests/vendor/:vendorId', () => {
    test('should get all requests for a specific vendor', async () => {
      const mockRequests = [
        { id: 'request-1', vendorId: 'vendor-123' },
        { id: 'request-2', vendorId: 'vendor-123' },
      ];

      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: mockRequests,
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.vendorId).toBe('vendor-123');
      expect(response.body.count).toBe(2);
      expect(response.body.data).toEqual(mockRequests);
      expect(mockApiManager.getMultipleRequests).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Object) }),
        expect.objectContaining({ vendorIDs: 'vendor-123' })
      );
    });

    test('should return 500 if vendorId is empty string', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 500,
        error: 'Invalid vendorId',
      });

      const response = await request(app).get('/api/vudy/requests/vendor/ ');

      expect(response.status).toBe(500);
    });

    test('should handle error from apiManager', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' },
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
      expect(response.body.message).toContain('Failed to fetch requests for vendor vendor-123');
    });

    test('should return count 0 for vendor with no requests', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: [],
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-empty');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
    });

    test('should handle null body response', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: null,
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-123');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });

    test('should use default status code 500 on error', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        error: 'Unknown error',
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-123');

      expect(response.status).toBe(500);
    });

    test('should use default status code 200 on success', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        body: [],
      });

      const response = await request(app).get('/api/vudy/requests/vendor/vendor-123');

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/vudy/requests/batch', () => {
    test('should get multiple requests by IDs in batch', async () => {
      const mockRequests = [
        { id: 'request-1', amountInUsd: 100 },
        { id: 'request-2', amountInUsd: 200 },
        { id: 'request-3', amountInUsd: 300 },
      ];

      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: mockRequests,
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1', 'request-2', 'request-3'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.requested).toBe(3);
      expect(response.body.found).toBe(3);
      expect(response.body.data).toEqual(mockRequests);
      expect(mockApiManager.getMultipleRequests).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.any(Object) }),
        expect.objectContaining({ ids: 'request-1,request-2,request-3' })
      );
    });

    test('should return 400 if ids is missing', async () => {
      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ids array is required');
    });

    test('should return 400 if ids is not an array', async () => {
      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ids must be an array');
    });

    test('should return 400 if ids array is empty', async () => {
      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: [] });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ids array cannot be empty');
    });

    test('should return 400 if ids array exceeds 100 items', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) => `request-${i}`);

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: tooManyIds });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 100 IDs allowed per batch');
    });

    test('should handle error from apiManager', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' },
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1'] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
      expect(response.body.message).toBe('Failed to fetch batch requests');
    });

    test('should show requested vs found count', async () => {
      // Requesting 3 IDs but only 2 found
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: [
          { id: 'request-1' },
          { id: 'request-2' },
        ],
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1', 'request-2', 'request-3'] });

      expect(response.status).toBe(200);
      expect(response.body.requested).toBe(3);
      expect(response.body.found).toBe(2);
    });

    test('should handle null body response', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        statusCode: 200,
        body: null,
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1'] });

      expect(response.status).toBe(200);
      expect(response.body.found).toBe(0);
      expect(response.body.data).toEqual([]);
    });

    test('should use default status code 500 on error', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        error: 'Unknown error',
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1'] });

      expect(response.status).toBe(500);
    });

    test('should use default status code 200 on success', async () => {
      mockApiManager.getMultipleRequests.mockResolvedValue({
        body: [],
      });

      const response = await request(app)
        .post('/api/vudy/requests/batch')
        .send({ ids: ['request-1'] });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/vudy/requests/:requestId/status', () => {
    test('should get payment request status', async () => {
      const mockRequest = {
        id: 'request-123',
        status: 'completed',
        amountInUsd: 100,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        isPaid: true,
      };

      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 200,
        body: mockRequest,
      });

      const response = await request(app).get('/api/vudy/requests/request-123/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBe('request-123');
      expect(response.body.data.status).toBe('completed');
      expect(response.body.data.amountInUsd).toBe(100);
      expect(response.body.data.isPaid).toBe(true);
      expect(response.body.data.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(response.body.data.updatedAt).toBe('2024-01-02T00:00:00Z');
    });

    test('should return 500 if requestId is empty string', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 500,
        error: 'Invalid requestId',
      });

      const response = await request(app).get('/api/vudy/requests/ /status');

      expect(response.status).toBe(500);
    });

    test('should return 404 if request not found', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 404,
        error: 'Not found',
      });

      const response = await request(app).get('/api/vudy/requests/nonexistent/status');

      expect(response.status).toBe(404);
      expect(response.body.message).toBeDefined();
    });

    test('should handle other errors from apiManager', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
      });

      const response = await request(app).get('/api/vudy/requests/request-123/status');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
      expect(response.body.message).toBe('Failed to fetch request status');
    });

    test('should use default values for missing status fields', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 200,
        body: {
          amountInUsd: 100,
        },
      });

      const response = await request(app).get('/api/vudy/requests/request-123/status');

      expect(response.status).toBe(200);
      expect(response.body.data.requestId).toBe('request-123');
      expect(response.body.data.status).toBe('unknown');
      expect(response.body.data.isPaid).toBe(false);
    });

    test('should use request data id if present', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        statusCode: 200,
        body: {
          id: 'actual-id-456',
          status: 'pending',
          amountInUsd: 100,
        },
      });

      const response = await request(app).get('/api/vudy/requests/request-123/status');

      expect(response.status).toBe(200);
      expect(response.body.data.requestId).toBe('actual-id-456');
    });

    test('should use default status code 500 on error without statusCode', async () => {
      mockApiManager.getSingleRequest.mockResolvedValue({
        error: 'Unknown error',
      });

      const response = await request(app).get('/api/vudy/requests/request-123/status');

      expect(response.status).toBe(500);
    });
  });
});
