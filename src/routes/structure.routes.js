/**
 * Structure API Routes
 * Endpoints for managing investment structures (Funds, SA/LLC, Fideicomiso, Private Debt)
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { catchAsync, validate } = require('../middleware/errorHandler');
const { Structure, StructureAdmin, User, Distribution } = require('../models/supabase');
const { getSupabase } = require('../config/database');
const {
  requireInvestmentManagerAccess,
  getUserContext,
  ROLES,
  canAccessStructure,
  canEditStructure,
  getUserStructureIds
} = require('../middleware/rbac');

const router = express.Router();

/**
 * @route   POST /api/structures
 * @desc    Create a new structure
 * @access  Private (requires authentication, Root/Admin only)
 */
router.post('/', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const userId = req.auth.userId || req.user.id;

  const {
    name,
    type,
    subtype,
    status,
    description,
    parentStructureId,
    totalCommitment,
    managementFee,
    carriedInterest,
    hurdleRate,
    waterfallType,
    inceptionDate,
    termYears,
    extensionYears,
    gp,
    fundAdmin,
    legalCounsel,
    auditor,
    taxAdvisor,
    bankAccounts,
    baseCurrency,
    taxJurisdiction,
    regulatoryStatus,
    investmentStrategy,
    targetReturns,
    riskProfile,
    stage
  } = req.body;

  // Validate required fields
  validate(name, 'Structure name is required');
  validate(type, 'Structure type is required');
  // validate(['Fund', 'SA/LLC', 'Fideicomiso', 'Private Debt'].includes(type), 'Invalid structure type');

  // Validate parent structure if provided
  if (parentStructureId) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    validate(uuidRegex.test(parentStructureId), 'Invalid parent structure ID format');

    const parentStructure = await Structure.findById(parentStructureId);
    validate(parentStructure, 'Parent structure not found');
    validate(parentStructure.createdBy === userId, 'Parent structure does not belong to user');
    validate(parentStructure.hierarchyLevel < 5, 'Maximum hierarchy level (5) reached');
  }

  // Create structure
  const structureData = {
    name: name.trim(),
    type,
    subtype: subtype?.trim() || '',
    description: description?.trim() || '',
    status: status || 'Active',
    parentStructureId: parentStructureId || null,
    hierarchyLevel: parentStructureId ? null : 1, // Will be calculated by DB trigger
    totalCommitment: totalCommitment || 0,
    totalCalled: 0,
    totalDistributed: 0,
    totalInvested: 0,
    managementFee: managementFee || 2.0,
    carriedInterest: carriedInterest || 20.0,
    hurdleRate: hurdleRate || 8.0,
    waterfallType: waterfallType || 'American',
    inceptionDate: inceptionDate || new Date().toISOString(),
    termYears: termYears || 10,
    extensionYears: extensionYears || 2,
    gp: gp?.trim() || '',
    fundAdmin: fundAdmin?.trim() || '',
    legalCounsel: legalCounsel?.trim() || '',
    auditor: auditor?.trim() || '',
    taxAdvisor: taxAdvisor?.trim() || '',
    bankAccounts: bankAccounts || {},
    baseCurrency: baseCurrency || 'USD',
    taxJurisdiction: taxJurisdiction?.trim() || '',
    regulatoryStatus: regulatoryStatus?.trim() || '',
    investmentStrategy: investmentStrategy?.trim() || '',
    targetReturns: targetReturns?.trim() || '',
    riskProfile: riskProfile?.trim() || '',
    stage: stage?.trim() || '',
    createdBy: userId
  };

  const structure = await Structure.create(structureData);

  res.status(201).json({
    success: true,
    message: 'Structure created successfully',
    data: structure
  });
}));

/**
 * @route   GET /api/structures
 * @desc    Get all structures with optional filters
 * @access  Private (requires authentication)
 * @query   createdBy?: string - Filter by creator user ID
 * @query   type?: string - Filter by structure type
 * @query   status?: string - Filter by status
 * @query   parentId?: string - Filter by parent structure ID
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const { createdBy, type, status, parentId } = req.query;

  // Build filter object based on query parameters
  const filter = {};
  if (createdBy) filter.createdBy = createdBy;
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (parentId) filter.parentStructureId = parentId;

  // Get structures with filters
  const structures = await Structure.find(filter);

  res.status(200).json({
    success: true,
    count: structures.length,
    data: structures
  });
}));

/**
 * @route   GET /api/structures/root
 * @desc    Get all root structures (no parent) with role-based filtering
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/root', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);

  let structures;

  if (userRole === ROLES.ROOT) {
    // Root sees all root structures
    const allStructures = await Structure.find({ parentStructureId: null });
    structures = allStructures;
  } else {
    // Admin sees only their root structures
    structures = await Structure.findRootStructures(userId);
  }

  res.status(200).json({
    success: true,
    count: structures.length,
    data: structures
  });
}));

/**
 * @route   GET /api/structures/:id
 * @desc    Get a single structure by ID
 * @access  Private (requires authentication)
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const { id } = req.params;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  res.status(200).json({
    success: true,
    data: structure
  });
}));

/**
 * @route   GET /api/structures/:id/children
 * @desc    Get child structures
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/:id/children', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can access any structure, Admin can only access their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  const children = await Structure.findChildStructures(id);

  res.status(200).json({
    success: true,
    count: children.length,
    data: children
  });
}));

/**
 * @route   GET /api/structures/:id/with-investors
 * @desc    Get structure with all investors
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/:id/with-investors', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can access any structure, Admin can only access their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  const structureWithInvestors = await Structure.findWithInvestors(id);

  res.status(200).json({
    success: true,
    data: structureWithInvestors
  });
}));

/**
 * @route   PUT /api/structures/:id
 * @desc    Update a structure
 * @access  Private (Root/Admin only - Support cannot edit structures)
 */
router.put('/:id', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Check if user can edit this structure (Admin/Root only, Support cannot)
  const canEdit = await canEditStructure(structure, userRole, userId, StructureAdmin);
  validate(canEdit, 'Unauthorized: Only admins can edit structures');


  const updateData = {};
  const allowedFields = [
    'name', 'description', 'status', 'subtype', 'totalCommitment', 'managementFee',
    'carriedInterest', 'hurdleRate', 'waterfallType', 'termYears',
    'extensionYears', 'finalDate', 'gp', 'fundAdmin', 'legalCounsel',
    'auditor', 'taxAdvisor', 'bankAccounts', 'baseCurrency',
    'taxJurisdiction', 'regulatoryStatus', 'investmentStrategy',
    'targetReturns', 'riskProfile', 'stage'
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  validate(Object.keys(updateData).length > 0, 'No valid fields provided for update');

  const updatedStructure = await Structure.findByIdAndUpdate(id, updateData);

  res.status(200).json({
    success: true,
    message: 'Structure updated successfully',
    data: updatedStructure
  });
}));

/**
 * @route   PATCH /api/structures/:id/financials
 * @desc    Update structure financial totals
 * @access  Private (requires authentication, Root/Admin only)
 */
router.patch('/:id/financials', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;
  const { totalCalled, totalDistributed, totalInvested } = req.body;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can edit any structure, Admin can only edit their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  const financials = {};
  if (totalCalled !== undefined) financials.totalCalled = totalCalled;
  if (totalDistributed !== undefined) financials.totalDistributed = totalDistributed;
  if (totalInvested !== undefined) financials.totalInvested = totalInvested;

  validate(Object.keys(financials).length > 0, 'No financial data provided');

  const updatedStructure = await Structure.updateFinancials(id, financials);

  res.status(200).json({
    success: true,
    message: 'Structure financials updated successfully',
    data: updatedStructure
  });
}));

/**
 * @route   POST /api/structures/:id/admins
 * @desc    Add admin or support user to structure
 * @access  Private (requires authentication, Root/Admin only)
 */
router.post('/:id/admins', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;
  const { userId: targetUserId, role: targetRole, canEdit, canDelete, canManageInvestors, canManageDocuments } = req.body;

  // Validate required fields
  validate(targetUserId, 'User ID is required');
  validate(targetRole !== undefined, 'Role is required');
  validate([ROLES.ADMIN, ROLES.SUPPORT].includes(targetRole), 'Role must be 1 (admin) or 2 (support)');

  // Check if structure exists
  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can add to any structure, Admin can only add to their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  // Check if target user exists and has valid role
  const targetUser = await User.findById(targetUserId);
  validate(targetUser, 'Target user not found');
  validate(
    targetUser.role === ROLES.ADMIN || targetUser.role === ROLES.SUPPORT,
    'Target user must be an admin or support user'
  );

  // Check if user is already added to structure
  const existing = await StructureAdmin.hasAccess(id, targetUserId);
  validate(!existing, 'User is already assigned to this structure');

  // Create the relationship
  const structureAdmin = await StructureAdmin.create({
    structureId: id,
    userId: targetUserId,
    role: targetRole,
    canEdit: canEdit !== undefined ? canEdit : true,
    canDelete: canDelete !== undefined ? canDelete : false,
    canManageInvestors: canManageInvestors !== undefined ? canManageInvestors : true,
    canManageDocuments: canManageDocuments !== undefined ? canManageDocuments : true,
    addedBy: userId
  });

  res.status(201).json({
    success: true,
    message: 'User added to structure successfully',
    data: structureAdmin
  });
}));

/**
 * @route   GET /api/structures/:id/admins
 * @desc    Get all admins and support users for a structure
 * @access  Private (requires authentication, Root/Admin only)
 */
router.get('/:id/admins', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  // Check if structure exists
  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can view any structure, Admin can only view their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  // Get all admins/support for this structure
  const admins = await StructureAdmin.findByStructureId(id);

  res.status(200).json({
    success: true,
    count: admins.length,
    data: admins
  });
}));

/**
 * @route   DELETE /api/structures/:id/admins/:targetUserId
 * @desc    Remove admin or support user from structure
 * @access  Private (requires authentication, Root/Admin only)
 */
router.delete('/:id/admins/:targetUserId', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id, targetUserId } = req.params;

  // Check if structure exists
  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can remove from any structure, Admin can only remove from their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  // Check if relationship exists
  const hasAccess = await StructureAdmin.hasAccess(id, targetUserId);
  validate(hasAccess, 'User is not assigned to this structure');

  // Remove the relationship
  await StructureAdmin.delete(id, targetUserId);

  res.status(200).json({
    success: true,
    message: 'User removed from structure successfully'
  });
}));

/**
 * @route   DELETE /api/structures/:id
 * @desc    Delete a structure
 * @access  Private (requires authentication, Root/Admin only)
 */
router.delete('/:id', authenticate, requireInvestmentManagerAccess, catchAsync(async (req, res) => {
  const { userId, userRole } = getUserContext(req);
  const { id } = req.params;

  const structure = await Structure.findById(id);
  validate(structure, 'Structure not found');

  // Root can delete any structure, Admin can only delete their own
  if (userRole === ROLES.ADMIN) {
    validate(structure.createdBy === userId, 'Unauthorized access to structure');
  }

  await Structure.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'Structure deleted successfully'
  });
}));

/**
 * @route   GET /api/investors/me/dashboard
 * @desc    Get investor dashboard data with structures, summary, and distributions
 * @access  Private (requires authentication, Investor role)
 *
 * @success {200} Success Response
 * {
 *   "success": true,
 *   "data": {
 *     "investor": {
 *       "id": "investor-uuid",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "email": "john@example.com"
 *     },
 *     "structures": [
 *       {
 *         "id": "structure-uuid",
 *         "name": "Real Estate Fund I",
 *         "type": "Fund",
 *         "commitment": 500000,
 *         "calledCapital": 300000,
 *         "currentValue": 350000,
 *         "unrealizedGain": 50000
 *       }
 *     ],
 *     "summary": {
 *       "totalCommitment": 500000,
 *       "totalCalledCapital": 300000,
 *       "totalCurrentValue": 350000,
 *       "totalDistributed": 25000,
 *       "totalReturn": 75000,
 *       "totalReturnPercent": 25.0
 *     },
 *     "distributions": [
 *       {
 *         "id": "dist-uuid",
 *         "structureId": "structure-uuid",
 *         "structureName": "Real Estate Fund I",
 *         "amount": 25000,
 *         "date": "2024-01-15",
 *         "type": "Return of Capital",
 *         "status": "Paid"
 *       }
 *     ]
 *   }
 * }
 *
 * @error {401} Unauthorized - No authentication token
 * {
 *   "success": false,
 *   "message": "Authentication required"
 * }
 *
 * @error {403} Forbidden - Not an investor
 * {
 *   "success": false,
 *   "message": "Access denied. Investor role required."
 * }
 */
router.get('/investors/me/dashboard', authenticate, catchAsync(async (req, res) => {
  const userId = req.auth.userId || req.user.id;
  const supabase = getSupabase();

  // Get user details
  const user = await User.findById(userId);
  validate(user, 'User not found');

  // Optional: Validate user is an investor (role 3)
  // validate(user.role === ROLES.INVESTOR, 'Access denied. Investor role required.');

  // Get all structure_investors records for this user
  const { data: structureInvestors, error: siError } = await supabase
    .from('structure_investors')
    .select(`
      *,
      structure:structures (
        id,
        name,
        type,
        status,
        base_currency,
        current_nav
      )
    `)
    .eq('user_id', userId);

  if (siError) {
    throw new Error(`Error fetching structures: ${siError.message}`);
  }

  // Get all capital call allocations for this user
  const { data: capitalCallAllocations, error: ccError } = await supabase
    .from('capital_call_allocations')
    .select(`
      *,
      capital_call:capital_calls (
        structure_id
      )
    `)
    .eq('user_id', userId);

  if (ccError) {
    throw new Error(`Error fetching capital calls: ${ccError.message}`);
  }

  // Get all distribution allocations for this user
  const { data: distributionAllocations, error: distError } = await supabase
    .from('distribution_allocations')
    .select(`
      *,
      distribution:distributions (
        id,
        structure_id,
        distribution_date,
        source,
        status
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (distError) {
    throw new Error(`Error fetching distributions: ${distError.message}`);
  }

  // Build structures array with calculations
  const structures = (structureInvestors || [])
    .filter(si => si.structure)
    .map(si => {
      const commitment = parseFloat(si.commitment_amount) || 0;

      // Calculate called capital for this structure
      const structureCalls = (capitalCallAllocations || []).filter(
        alloc => alloc.capital_call?.structure_id === si.structure_id
      );
      const calledCapital = structureCalls.reduce(
        (sum, alloc) => sum + (parseFloat(alloc.allocated_amount) || 0),
        0
      );

      // Use structure's current_nav or calculate based on called capital
      // For now, we'll use a simple calculation: called capital + some growth
      // In production, this should come from the structure's NAV
      const currentValue = parseFloat(si.structure.current_nav) || calledCapital;

      // Calculate unrealized gain
      const unrealizedGain = currentValue - calledCapital;

      return {
        id: si.structure.id,
        name: si.structure.name,
        type: si.structure.type,
        status: si.structure.status,
        commitment: commitment,
        calledCapital: calledCapital,
        currentValue: currentValue,
        unrealizedGain: unrealizedGain,
        currency: si.structure.base_currency || 'USD',
        ownershipPercent: parseFloat(si.ownership_percent) || 0
      };
    });

  // Build distributions array
  const distributions = (distributionAllocations || [])
    .filter(alloc => alloc.distribution)
    .map(alloc => {
      // Find the structure name
      const structure = structures.find(s => s.id === alloc.distribution.structure_id);

      return {
        id: alloc.distribution.id,
        structureId: alloc.distribution.structure_id,
        structureName: structure?.name || 'Unknown Structure',
        amount: parseFloat(alloc.allocated_amount) || 0,
        date: alloc.distribution.distribution_date,
        type: alloc.distribution.source || 'Distribution',
        status: alloc.status || alloc.distribution.status
      };
    });

  // Calculate summary metrics
  const totalCommitment = structures.reduce((sum, s) => sum + s.commitment, 0);
  const totalCalledCapital = structures.reduce((sum, s) => sum + s.calledCapital, 0);
  const totalCurrentValue = structures.reduce((sum, s) => sum + s.currentValue, 0);
  const totalDistributed = distributions
    .filter(d => d.status === 'Paid')
    .reduce((sum, d) => sum + d.amount, 0);

  // Total Return = (Distributions + Current Value) - Called Capital
  const totalReturn = (totalDistributed + totalCurrentValue) - totalCalledCapital;
  const totalReturnPercent = totalCalledCapital > 0
    ? (totalReturn / totalCalledCapital) * 100
    : 0;

  res.status(200).json({
    success: true,
    data: {
      investor: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        profileImage: user.profileImage
      },
      structures,
      summary: {
        totalCommitment: parseFloat(totalCommitment.toFixed(2)),
        totalCalledCapital: parseFloat(totalCalledCapital.toFixed(2)),
        totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
        totalDistributed: parseFloat(totalDistributed.toFixed(2)),
        totalReturn: parseFloat(totalReturn.toFixed(2)),
        totalReturnPercent: parseFloat(totalReturnPercent.toFixed(2))
      },
      distributions
    }
  });
}));

/**
 * @route   GET /api/structures/health
 * @desc    Health check for Structure API routes
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    service: 'Structure API',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
