/**
 * Transaction API Routes
 * Endpoints for managing payment transactions and approvals
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { catchAsync, validate } = require('../middleware/errorHandler');
const Transaction = require('../models/supabase/transaction');
const { requireInvestmentManagerAccess, getUserContext, ROLES } = require('../middleware/rbac');

const router = express.Router();

/**
 * @route   POST /api/transactions
 * @desc    Create a new transaction (investor submits payment)
 * @access  Private (requires authentication)
 */
router.post('/', authenticate, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);

  const {
    investorId,
    structureId,
    investorEmail,
    investorName,
    structureName,
    ticketsPurchased,
    totalAmount,
    paymentMethod,
    receiptUrl,
    receiptFileName,
    walletAddress
  } = req.body;

  // Validate required fields
  validate(investorId, 'Investor ID is required');
  validate(structureId, 'Structure ID is required');
  validate(investorEmail, 'Investor email is required');
  validate(investorName, 'Investor name is required');
  validate(structureName, 'Structure name is required');
  validate(ticketsPurchased && ticketsPurchased > 0, 'Tickets purchased must be greater than 0');
  validate(totalAmount && totalAmount > 0, 'Total amount must be greater than 0');
  validate(paymentMethod, 'Payment method is required');
  validate(
    ['local-bank-transfer', 'international-bank-transfer', 'usdc'].includes(paymentMethod),
    'Invalid payment method'
  );

  // Validate USDC wallet address if payment method is USDC
  if (paymentMethod === 'usdc') {
    validate(walletAddress, 'Wallet address is required for USDC payments');
  }

  // Create transaction
  const transactionData = {
    investorId,
    structureId,
    investorEmail: investorEmail.trim(),
    investorName: investorName.trim(),
    structureName: structureName.trim(),
    ticketsPurchased: parseInt(ticketsPurchased),
    totalAmount: parseFloat(totalAmount),
    paymentMethod,
    receiptUrl: receiptUrl || null,
    receiptFileName: receiptFileName || null,
    walletAddress: walletAddress?.trim() || null,
    status: 'pending',
    submittedAt: new Date().toISOString()
  };

  const transaction = await Transaction.create(transactionData);

  res.status(201).json({
    success: true,
    message: 'Transaction submitted successfully',
    data: transaction
  });
}));

/**
 * @route   GET /api/transactions
 * @desc    Get all transactions (admin only, with optional filters)
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { status, investorId, structureId, paymentMethod, limit, offset } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (investorId) filter.investorId = investorId;
  if (structureId) filter.structureId = structureId;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (limit) filter.limit = parseInt(limit);
  if (offset) filter.offset = parseInt(offset);

  const transactions = await Transaction.findAll(filter);

  res.status(200).json({
    success: true,
    count: transactions.length,
    data: transactions
  });
}));

/**
 * @route   GET /api/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/stats', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const stats = await Transaction.getStats();

  res.status(200).json({
    success: true,
    data: stats
  });
}));

/**
 * @route   GET /api/transactions/:id
 * @desc    Get a single transaction by ID
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/:id', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const transaction = await Transaction.findById(id);
  validate(transaction, 'Transaction not found');

  res.status(200).json({
    success: true,
    data: transaction
  });
}));

/**
 * @route   PATCH /api/transactions/:id/approve
 * @desc    Approve a transaction
 * @access  Private (requires authentication, Root/Admin only)
 */
router.patch('/:id/approve', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;
  const { adminNotes } = req.body;

  const transaction = await Transaction.findById(id);
  validate(transaction, 'Transaction not found');
  validate(transaction.status === 'pending', 'Transaction has already been processed');

  const approvedTransaction = await Transaction.approve(id, userId, adminNotes);

  res.status(200).json({
    success: true,
    message: 'Transaction approved successfully',
    data: approvedTransaction
  });
}));

/**
 * @route   PATCH /api/transactions/:id/reject
 * @desc    Reject a transaction
 * @access  Private (requires authentication, Root/Admin only)
 */
router.patch('/:id/reject', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;
  const { adminNotes } = req.body;

  const transaction = await Transaction.findById(id);
  validate(transaction, 'Transaction not found');
  validate(transaction.status === 'pending', 'Transaction has already been processed');

  // Admin notes are recommended for rejection
  validate(adminNotes, 'Admin notes are required when rejecting a transaction');

  const rejectedTransaction = await Transaction.reject(id, userId, adminNotes);

  res.status(200).json({
    success: true,
    message: 'Transaction rejected successfully',
    data: rejectedTransaction
  });
}));

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Delete a transaction
 * @access  Private (requires authentication, Root/Admin only)
 */
router.delete('/:id', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const transaction = await Transaction.findById(id);
  validate(transaction, 'Transaction not found');

  await Transaction.delete(id);

  res.status(200).json({
    success: true,
    message: 'Transaction deleted successfully'
  });
}));

/**
 * @route   GET /api/transactions/health
 * @desc    Health check for Transaction API routes
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    service: 'Transaction API',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
