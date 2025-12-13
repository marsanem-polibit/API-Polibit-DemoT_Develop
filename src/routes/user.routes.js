/**
 * User API Routes
 * Endpoints for managing users
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { catchAsync, validate } = require('../middleware/errorHandler');
const { User } = require('../models/supabase');
const { requireInvestmentManagerAccess, ROLES } = require('../middleware/rbac');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users (name and UUID)
 * @access  Private (requires authentication)
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  // Get all users
  const users = await User.find({});

  // Map to return only id, firstName, lastName, and email
  const usersList = users.map(user => ({
    id: user.id,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email
  }));

  res.status(200).json({
    success: true,
    count: usersList.length,
    data: usersList
  });
}));

/**
 * @route   GET /api/users/filter
 * @desc    Filter users by one or more roles
 * @access  Private (requires authentication, Root/Admin/Support only)
 * @query   role - Single role number (0-3) or comma-separated roles (e.g., ?role=0,1,2)
 */
router.get('/filter', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { role } = req.query;

  validate(role !== undefined, 'Role parameter is required');

  // Parse role parameter - can be single value or comma-separated
  let roles = [];
  if (typeof role === 'string') {
    // Handle comma-separated roles like "0,1,2" or single role "3"
    roles = role.split(',').map(r => parseInt(r.trim(), 10));
  } else if (Array.isArray(role)) {
    // Handle array of roles from query like ?role=0&role=1
    roles = role.map(r => parseInt(r, 10));
  } else {
    roles = [parseInt(role, 10)];
  }

  // Validate all roles are valid numbers 0-3
  const validRoles = roles.every(r => !isNaN(r) && r >= 0 && r <= 3);
  validate(validRoles, 'Invalid role value(s). Role must be between 0-3 (0=Root, 1=Admin, 2=Support, 3=Investor)');

  // Get all users
  const allUsers = await User.find({});

  // Filter users by the specified roles
  const filteredUsers = allUsers.filter(user => roles.includes(user.role));

  // Map to return user details
  const usersList = filteredUsers.map(user => ({
    id: user.id,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    roleName: user.role === 0 ? 'Root' : user.role === 1 ? 'Admin' : user.role === 2 ? 'Support' : 'Investor'
  }));

  res.status(200).json({
    success: true,
    count: usersList.length,
    roles: roles,
    data: usersList
  });
}));

/**
 * @route   GET /api/users/health
 * @desc    Health check for User API routes
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    service: 'User API',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
