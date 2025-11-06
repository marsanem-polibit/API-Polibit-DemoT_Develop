/**
 * Project API Routes
 * Endpoints for managing project information (CRUD operations)
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  catchAsync,
  validate
} = require('../middleware/errorHandler');
const Project = require('../models/project');
const { uploadProjectImage, deleteOldProjectImage } = require('../middleware/upload');
const { getFullImageUrl } = require('../utils/helpers');

const router = express.Router();

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private (requires authentication)
 * @body    {
 *            name: string,
 *            address: string,
 *            anualRate: number,
 *            estimateGain: number,
 *            minimumTicketUSD: number,
 *            minumumTicketMXN: number,
 *            available?: boolean,
 *            paused?: boolean
 *          }
 * @note    image is NOT set through this endpoint - use POST /api/projects/:id/image
 */
router.post('/', authenticate, catchAsync(async (req, res) => {
  const {
    name,
    address,
    anualRate,
    estimateGain,
    minimumTicketUSD,
    minumumTicketMXN,
    available,
    paused
  } = req.body;

  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Validate required fields
  validate(name, 'Project name is required');
  validate(address, 'Address is required');
  validate(anualRate !== undefined && anualRate !== null, 'Annual rate is required');
  validate(estimateGain !== undefined && estimateGain !== null, 'Estimate gain is required');
  validate(minimumTicketUSD !== undefined && minimumTicketUSD !== null, 'Minimum ticket USD is required');
  validate(minumumTicketMXN !== undefined && minumumTicketMXN !== null, 'Minimum ticket MXN is required');

  // Validate numeric fields
  validate(typeof anualRate === 'number' && anualRate >= 0 && anualRate <= 100, 'Annual rate must be between 0 and 100');
  validate(typeof estimateGain === 'number' && estimateGain >= 0, 'Estimate gain must be positive');
  validate(typeof minimumTicketUSD === 'number' && minimumTicketUSD >= 0, 'Minimum ticket USD must be positive');
  validate(typeof minumumTicketMXN === 'number' && minumumTicketMXN >= 0, 'Minimum ticket MXN must be positive');

  // Create new project
  const projectData = {
    name: name.trim(),
    address: address.trim(),
    anualRate,
    estimateGain,
    minimumTicketUSD,
    minumumTicketMXN,
    available: available !== undefined ? available : false,
    paused: paused !== undefined ? paused : false,
    userCreatorId: userId
  };

  const project = new Project(projectData);
  await project.save();

  // Transform project data to include full URL for image if needed
  const responseData = project.toObject();
  responseData.image = getFullImageUrl(responseData.image, req);

  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: responseData
  });
}));

/**
 * @route   POST /api/projects/:id/image
 * @desc    Upload project image
 * @access  Private (requires authentication)
 * @param   {string} id - Project MongoDB _id
 * @body    FormData with 'projectImage' file field
 */
router.post('/:id/image', authenticate, uploadProjectImage.single('projectImage'), catchAsync(async (req, res) => {
  const { id } = req.params;

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please provide a projectImage file.'
    });
  }

  // Find project by ID
  const project = await Project.findById(id);

  if (!project) {
    // Delete uploaded file since project doesn't exist
    deleteOldProjectImage(`/uploads/project-images/${req.file.filename}`);
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  // Delete old image if exists
  if (project.image) {
    deleteOldProjectImage(project.image);
  }

  // Save new image path (relative path)
  const imagePath = `/uploads/project-images/${req.file.filename}`;
  project.image = imagePath;

  await project.save();

  res.status(200).json({
    success: true,
    message: 'Project image uploaded successfully',
    data: {
      image: getFullImageUrl(project.image, req),
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
}));

/**
 * @route   DELETE /api/projects/:id/image
 * @desc    Delete project image
 * @access  Private (requires authentication)
 * @param   {string} id - Project MongoDB _id
 */
router.delete('/:id/image', authenticate, catchAsync(async (req, res) => {
  const { id } = req.params;

  // Find project by ID
  const project = await Project.findById(id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  if (!project.image) {
    return res.status(404).json({
      success: false,
      message: 'No project image to delete'
    });
  }

  // Delete the image file
  deleteOldProjectImage(project.image);

  // Remove from database
  project.image = null;
  await project.save();

  res.status(200).json({
    success: true,
    message: 'Project image deleted successfully'
  });
}));

/**
 * @route   GET /api/projects
 * @desc    Get all projects created by the authenticated user (with optional filters)
 * @access  Private (requires authentication)
 * @query   {
 *            available?: boolean,
 *            paused?: boolean,
 *            minUSD?: number,
 *            maxUSD?: number
 *          }
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  const { available, paused, minUSD, maxUSD } = req.query;

  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Always filter by user creator ID
  let query = {
    userCreatorId: userId
  };

  // Filter by availability
  if (available !== undefined) {
    query.available = available === 'true';
  }

  // Filter by paused status
  if (paused !== undefined) {
    query.paused = paused === 'true';
  }

  // Filter by ticket range
  if (minUSD !== undefined || maxUSD !== undefined) {
    query.minimumTicketUSD = {};
    if (minUSD !== undefined) {
      query.minimumTicketUSD.$gte = parseFloat(minUSD);
    }
    if (maxUSD !== undefined) {
      query.minimumTicketUSD.$lte = parseFloat(maxUSD);
    }
  }

  const projects = await Project.find(query).sort({ anualRate: -1 });

  // Transform image URLs
  const projectsData = projects.map(project => {
    const projectData = project.toObject();
    projectData.image = getFullImageUrl(projectData.image, req);
    return projectData;
  });

  res.status(200).json({
    success: true,
    count: projectsData.length,
    data: projectsData
  });
}));

/**
 * @route   GET /api/projects/:id
 * @desc    Get a single project by ID
 * @access  Private (requires authentication)
 * @param   {string} id - Project MongoDB _id
 */
router.get('/:id', authenticate, catchAsync(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findById(id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  // Transform project data
  const projectData = project.toObject();
  projectData.image = getFullImageUrl(projectData.image, req);

  res.status(200).json({
    success: true,
    data: projectData
  });
}));

/**
 * @route   PUT /api/projects/:id
 * @desc    Update a project by ID
 * @access  Private (requires authentication)
 * @param   {string} id - Project MongoDB _id
 * @body    {
 *            name?: string,
 *            address?: string,
 *            anualRate?: number,
 *            estimateGain?: number,
 *            minimumTicketUSD?: number,
 *            minumumTicketMXN?: number,
 *            available?: boolean,
 *            paused?: boolean
 *          }
 * @note    image is NOT updated through this endpoint - use POST /api/projects/:id/image
 */
router.put('/:id', authenticate, catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    address,
    anualRate,
    estimateGain,
    minimumTicketUSD,
    minumumTicketMXN,
    available,
    paused
  } = req.body;

  // Find project
  const project = await Project.findById(id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  // Build update object
  const updateData = {};

  if (name !== undefined) {
    validate(name.trim().length > 0, 'Name cannot be empty');
    updateData.name = name.trim();
  }

  if (address !== undefined) {
    validate(address.trim().length > 0, 'Address cannot be empty');
    updateData.address = address.trim();
  }

  if (anualRate !== undefined) {
    validate(typeof anualRate === 'number' && anualRate >= 0 && anualRate <= 100, 'Annual rate must be between 0 and 100');
    updateData.anualRate = anualRate;
  }

  if (estimateGain !== undefined) {
    validate(typeof estimateGain === 'number' && estimateGain >= 0, 'Estimate gain must be positive');
    updateData.estimateGain = estimateGain;
  }

  if (minimumTicketUSD !== undefined) {
    validate(typeof minimumTicketUSD === 'number' && minimumTicketUSD >= 0, 'Minimum ticket USD must be positive');
    updateData.minimumTicketUSD = minimumTicketUSD;
  }

  if (minumumTicketMXN !== undefined) {
    validate(typeof minumumTicketMXN === 'number' && minumumTicketMXN >= 0, 'Minimum ticket MXN must be positive');
    updateData.minumumTicketMXN = minumumTicketMXN;
  }

  if (available !== undefined) {
    updateData.available = available;
  }

  if (paused !== undefined) {
    updateData.paused = paused;
  }

  // Check if any fields are being updated
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields provided for update'
    });
  }

  // Update project
  Object.assign(project, updateData);
  await project.save();

  // Transform response data
  const projectData = project.toObject();
  projectData.image = getFullImageUrl(projectData.image, req);

  res.status(200).json({
    success: true,
    message: 'Project updated successfully',
    data: projectData
  });
}));

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete a project by ID
 * @access  Private (requires authentication)
 * @param   {string} id - Project MongoDB _id
 */
router.delete('/:id', authenticate, catchAsync(async (req, res) => {
  const { id } = req.params;

  const project = await Project.findById(id);

  if (!project) {
    return res.status(404).json({
      success: false,
      message: 'Project not found'
    });
  }

  await project.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Project deleted successfully'
  });
}));

/**
 * @route   GET /api/projects/available/list
 * @desc    Get all available (not paused) projects
 * @access  Private (requires authentication)
 */
router.get('/available/list', authenticate, catchAsync(async (req, res) => {
  const projects = await Project.findAvailable();

  // Transform image URLs
  const projectsData = projects.map(project => {
    const projectData = project.toObject();
    projectData.image = getFullImageUrl(projectData.image, req);
    return projectData;
  });

  res.status(200).json({
    success: true,
    count: projectsData.length,
    data: projectsData
  });
}));

/**
 * @route   GET /api/projects/health
 * @desc    Health check for Project API routes
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    service: 'Project API',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
