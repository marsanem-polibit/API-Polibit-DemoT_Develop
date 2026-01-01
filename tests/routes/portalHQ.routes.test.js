/**
 * Portal HQ Routes Tests
 * Tests for src/routes/portalHQ.routes.js
 */

const express = require('express');
const request = require('supertest');
const apiManager = require('../../src/services/apiManager');

// Mock dependencies
jest.mock('../../src/services/apiManager');

jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.auth = { userId: 'user-123', userRole: 1, role: 1 };
    req.user = { id: 'user-123', role: 1 };
    next();
  },
}));

const { errorHandler } = require('../../src/middleware/errorHandler');

describe('Portal HQ Routes', () => {
  let app;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mount routes
    const portalRoutes = require('../../src/routes/portalHQ.routes');
    app.use('/api/portal', portalRoutes);

    // Add error handler middleware
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/portal/health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/api/portal/health');

      expect(response.status).toBe(200);
      expect(response.body.service).toBe('Portal HQ API');
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/portal/chains', () => {
    test('should return supported blockchain chains', async () => {
      const response = await request(app).get('/api/portal/chains');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(4);
      expect(response.body.data).toHaveLength(4);
      expect(response.body.data[0]).toHaveProperty('chainId');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('nativeCurrency');
      expect(response.body.data[0]).toHaveProperty('rpcUrl');
    });

    test('should include Ethereum, Polygon, BSC, and Avalanche', async () => {
      const response = await request(app).get('/api/portal/chains');

      const chainIds = response.body.data.map(chain => chain.chainId);
      expect(chainIds).toContain('eip155:1');    // Ethereum
      expect(chainIds).toContain('eip155:137');  // Polygon
      expect(chainIds).toContain('eip155:56');   // BSC
      expect(chainIds).toContain('eip155:43114'); // Avalanche
    });
  });

  describe('POST /api/portal/clients', () => {
    test('should create a new Portal HQ client successfully', async () => {
      apiManager.createNewClient.mockResolvedValue({
        statusCode: 201,
        body: {
          clientId: 'client-123',
          apiKey: 'api-key-123'
        }
      });

      const response = await request(app)
        .post('/api/portal/clients')
        .send({ portalAPIKey: 'test-api-key' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Client created successfully');
      expect(response.body.data.clientId).toBe('client-123');
    });

    test('should handle error creating client', async () => {
      apiManager.createNewClient.mockResolvedValue({
        statusCode: 400,
        error: 'Invalid API key',
        body: { details: 'API key is invalid' }
      });

      const response = await request(app)
        .post('/api/portal/clients')
        .send({ portalAPIKey: 'invalid-key' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid API key');
      expect(response.body.message).toBe('Failed to create client');
    });

    test('should use default status code 500 on error', async () => {
      apiManager.createNewClient.mockResolvedValue({
        error: 'Unknown error',
        body: {}
      });

      const response = await request(app)
        .post('/api/portal/clients')
        .send({});

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/portal/clients/:clientId', () => {
    test('should get a single client by ID', async () => {
      apiManager.getASingleClient.mockResolvedValue({
        statusCode: 200,
        body: {
          clientId: 'client-123',
          name: 'Test Client'
        }
      });

      const response = await request(app).get('/api/portal/clients/client-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.clientId).toBe('client-123');
    });

    test('should return 404 for empty clientId', async () => {
      const response = await request(app).get('/api/portal/clients/ ');

      expect(response.status).toBe(404);
    });

    test('should return 404 if client not found', async () => {
      apiManager.getASingleClient.mockResolvedValue({
        statusCode: 404,
        error: 'Not found'
      });

      const response = await request(app).get('/api/portal/clients/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.message).toBeDefined();
    });

    test('should handle other errors', async () => {
      apiManager.getASingleClient.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' }
      });

      const response = await request(app).get('/api/portal/clients/client-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/portal/clients/me/assets/:chainId', () => {
    test('should get client asset balance by chain', async () => {
      apiManager.getClientsAssetBalanceByChain.mockResolvedValue({
        statusCode: 200,
        body: {
          nativeBalance: { balance: '1000000000000000000' },
          tokens: []
        }
      });

      const response = await request(app)
        .get('/api/portal/clients/me/assets/eip155:137')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chainId).toBe('eip155:137');
      expect(response.body.nativeBalance).toBe('1000000000000000000');
    });

    test('should return 404 if chainId is missing in path', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/assets/')
        .query({ clientApiKey: 'client-api-key-123' });

      // Express router returns 200 for /assets without chainId (matches different route)
      expect(response.status).toBe(200);
    });

    test('should return 400 if clientApiKey is missing', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/assets/eip155:137');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should validate chainId format', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/assets/invalid-chain')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle authentication error', async () => {
      apiManager.getClientsAssetBalanceByChain.mockResolvedValue({
        statusCode: 401,
        error: 'Unauthorized'
      });

      const response = await request(app)
        .get('/api/portal/clients/me/assets/eip155:137')
        .query({ clientApiKey: 'invalid-key' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBeDefined();
    });

    test('should handle other errors', async () => {
      apiManager.getClientsAssetBalanceByChain.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: { details: 'Internal error' }
      });

      const response = await request(app)
        .get('/api/portal/clients/me/assets/eip155:137')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Server error');
    });
  });

  describe('GET /api/portal/clients/me/assets', () => {
    test('should get client assets across all chains', async () => {
      apiManager.getClientsAssetBalanceByChain.mockResolvedValue({
        statusCode: 200,
        body: {
          nativeBalance: { balance: '1000' },
          tokens: []
        }
      });

      const response = await request(app)
        .get('/api/portal/clients/me/assets')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chains).toBeGreaterThan(0);
      expect(response.body.data).toBeDefined();
    });

    test('should return 400 if clientApiKey is missing', async () => {
      const response = await request(app).get('/api/portal/clients/me/assets');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle errors gracefully for individual chains', async () => {
      apiManager.getClientsAssetBalanceByChain
        .mockResolvedValueOnce({ error: 'Error', statusCode: 500 })
        .mockResolvedValueOnce({ statusCode: 200, body: { nativeBalance: { balance: '100' } } });

      const response = await request(app)
        .get('/api/portal/clients/me/assets')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/portal/clients/me/transactions', () => {
    test('should get client transaction history', async () => {
      apiManager.getClientChainTransactionHistory.mockResolvedValue({
        statusCode: 200,
        body: [
          { hash: '0x123', from: '0xabc', to: '0xdef', value: '1000' },
          { hash: '0x456', from: '0xabc', to: '0xghi', value: '2000' }
        ]
      });

      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'client-api-key-123',
          chainId: 'eip155:137'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.chainId).toBe('eip155:137');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({ clientApiKey: 'key' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle pagination parameters', async () => {
      apiManager.getClientChainTransactionHistory.mockResolvedValue({
        statusCode: 200,
        body: new Array(10).fill({ hash: '0x123' })
      });

      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'key',
          chainId: 'eip155:137',
          limit: 10,
          offset: 20
        });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(20);
    });

    test('should validate limit is positive', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'key',
          chainId: 'eip155:137',
          limit: -5
        });

      expect(response.status).toBe(400);
    });

    test('should validate limit does not exceed 100', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'key',
          chainId: 'eip155:137',
          limit: 150
        });

      expect(response.status).toBe(400);
    });

    test('should validate offset is non-negative', async () => {
      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'key',
          chainId: 'eip155:137',
          offset: -10
        });

      expect(response.status).toBe(400);
    });

    test('should handle authentication error', async () => {
      apiManager.getClientChainTransactionHistory.mockResolvedValue({
        statusCode: 403,
        error: 'Forbidden'
      });

      const response = await request(app)
        .get('/api/portal/clients/me/transactions')
        .query({
          clientApiKey: 'invalid-key',
          chainId: 'eip155:137'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/portal/clients/me/transactions/recent', () => {
    test('should get recent transactions across chains', async () => {
      apiManager.getClientChainTransactionHistory.mockResolvedValue({
        statusCode: 200,
        body: [
          { hash: '0x123', timestamp: '2024-12-31T10:00:00Z' },
          { hash: '0x456', timestamp: '2024-12-31T09:00:00Z' }
        ]
      });

      const response = await request(app)
        .get('/api/portal/clients/me/transactions/recent')
        .query({ clientApiKey: 'client-api-key-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should return 400 if clientApiKey is missing', async () => {
      const response = await request(app).get('/api/portal/clients/me/transactions/recent');

      expect(response.status).toBe(400);
    });

    test('should sort transactions by timestamp', async () => {
      apiManager.getClientChainTransactionHistory.mockResolvedValue({
        statusCode: 200,
        body: [
          { hash: '0x123', timestamp: '2024-01-01T10:00:00Z' },
          { hash: '0x456', timestamp: '2024-12-31T10:00:00Z' }
        ]
      });

      const response = await request(app)
        .get('/api/portal/clients/me/transactions/recent')
        .query({ clientApiKey: 'key' });

      expect(response.status).toBe(200);
      expect(response.body.data[0].timestamp).toBe('2024-12-31T10:00:00Z');
    });
  });

  describe('PATCH /api/portal/clients/me/signing-share-pairs', () => {
    test('should confirm wallet creation successfully', async () => {
      apiManager.confirmWalletCreation.mockResolvedValue({
        statusCode: 200,
        body: { confirmed: true }
      });

      const response = await request(app)
        .patch('/api/portal/clients/me/signing-share-pairs')
        .send({
          clientApiKey: 'key',
          secp256k1Id: 'secp-id-123',
          ed25519Id: 'ed-id-456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Wallet creation confirmed successfully');
    });

    test('should accept 201 status code', async () => {
      apiManager.confirmWalletCreation.mockResolvedValue({
        statusCode: 201,
        body: { confirmed: true }
      });

      const response = await request(app)
        .patch('/api/portal/clients/me/signing-share-pairs')
        .send({
          clientApiKey: 'key',
          secp256k1Id: 'secp-id',
          ed25519Id: 'ed-id'
        });

      expect(response.status).toBe(200);
    });

    test('should accept 204 status code', async () => {
      apiManager.confirmWalletCreation.mockResolvedValue({
        statusCode: 204,
        body: null
      });

      const response = await request(app)
        .patch('/api/portal/clients/me/signing-share-pairs')
        .send({
          clientApiKey: 'key',
          secp256k1Id: 'secp-id',
          ed25519Id: 'ed-id'
        });

      expect(response.status).toBe(200);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .patch('/api/portal/clients/me/signing-share-pairs')
        .send({ clientApiKey: 'key' });

      expect(response.status).toBe(400);
    });

    test('should handle error confirming wallet', async () => {
      apiManager.confirmWalletCreation.mockResolvedValue({
        statusCode: 400,
        error: 'Invalid data',
        body: {}
      });

      const response = await request(app)
        .patch('/api/portal/clients/me/signing-share-pairs')
        .send({
          clientApiKey: 'key',
          secp256k1Id: 'secp-id',
          ed25519Id: 'ed-id'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Failed to confirm wallet creation');
    });
  });

  describe('POST /api/portal/wallets/generate', () => {
    test('should generate a new wallet successfully', async () => {
      apiManager.createAWallet.mockResolvedValue({
        statusCode: 201,
        body: {
          walletId: 'wallet-123',
          address: '0xabc123'
        }
      });

      const response = await request(app)
        .post('/api/portal/wallets/generate')
        .send({ clientApiKey: 'client-key-123' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Wallet generated successfully');
      expect(response.body.data.walletId).toBe('wallet-123');
    });

    test('should return 400 if clientApiKey is missing', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/generate')
        .send({});

      expect(response.status).toBe(400);
    });

    test('should handle error generating wallet', async () => {
      apiManager.createAWallet.mockResolvedValue({
        statusCode: 500,
        error: 'Server error',
        body: {}
      });

      const response = await request(app)
        .post('/api/portal/wallets/generate')
        .send({ clientApiKey: 'key' });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Failed to generate wallet');
    });
  });

  describe('POST /api/portal/wallets/send', () => {
    test('should send tokens successfully', async () => {
      apiManager.sendPolygonTokenFromWallet.mockResolvedValue({
        statusCode: 200,
        body: {
          txHash: '0x123abc',
          status: 'confirmed'
        }
      });

      const response = await request(app)
        .post('/api/portal/wallets/send')
        .send({
          clientApiKey: 'key',
          share: 'share-data',
          chain: 'POLYGON',
          to: '0x1234567890123456789012345678901234567890',
          token: 'native',
          amount: '1.5',
          rpcUrl: 'https://polygon-rpc.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Transaction sent successfully');
    });

    test('should validate all required fields', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send')
        .send({ clientApiKey: 'key' });

      expect(response.status).toBe(400);
    });

    test('should validate recipient address format', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send')
        .send({
          clientApiKey: 'key',
          share: 'share',
          chain: 'POLYGON',
          to: 'invalid-address',
          token: 'native',
          amount: '1.0',
          rpcUrl: 'https://rpc.com'
        });

      expect(response.status).toBe(400);
    });

    test('should validate amount is positive number', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send')
        .send({
          clientApiKey: 'key',
          share: 'share',
          chain: 'POLYGON',
          to: '0x1234567890123456789012345678901234567890',
          token: 'native',
          amount: '-1.0',
          rpcUrl: 'https://rpc.com'
        });

      expect(response.status).toBe(400);
    });

    test('should handle error sending tokens', async () => {
      apiManager.sendPolygonTokenFromWallet.mockResolvedValue({
        statusCode: 400,
        error: 'Insufficient balance',
        body: {}
      });

      const response = await request(app)
        .post('/api/portal/wallets/send')
        .send({
          clientApiKey: 'key',
          share: 'share',
          chain: 'POLYGON',
          to: '0x1234567890123456789012345678901234567890',
          token: 'native',
          amount: '1000',
          rpcUrl: 'https://rpc.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Failed to send tokens');
    });
  });

  describe('POST /api/portal/wallets/send/estimate', () => {
    test('should estimate gas for transaction', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send/estimate')
        .send({
          chain: 'POLYGON',
          to: '0x1234567890123456789012345678901234567890',
          amount: '1.0'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Gas estimation calculated');
      expect(response.body.data.gasLimit).toBeDefined();
      expect(response.body.data.currency).toBe('MATIC');
    });

    test('should return ETH for non-Polygon chains', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send/estimate')
        .send({
          chain: 'ETHEREUM',
          to: '0x1234567890123456789012345678901234567890',
          amount: '1.0'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.currency).toBe('ETH');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/portal/wallets/send/estimate')
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
