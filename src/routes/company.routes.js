/**
 * Company API Routes
 * Endpoints for managing company information
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  catchAsync,
  validate
} = require('../middleware/errorHandler');
const Company = require('../models/company');
const { uploadCompanyLogo, deleteOldCompanyLogo } = require('../middleware/upload');
const { getFullImageUrl } = require('../utils/helpers');

const router = express.Router();

/**
 * @route   PUT /api/company
 * @desc    Update or create company information
 * @access  Private (requires authentication)
 * @body    {
 *            firmName?: string,
 *            firmEmail?: string,
 *            firmPhone?: string,
 *            websiteURL?: string,
 *            address?: string,
 *            description?: string
 *          }
 * @note    firmLogo is NOT updated through this endpoint
 */
router.put('/', authenticate, catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Extract fields from request body (excluding firmLogo)
  const { firmName, firmEmail, firmPhone, websiteURL, address, description } = req.body;

  // Build update object with only provided fields
  const updateData = {};

  // Validate and add firmName if provided
  if (firmName !== undefined) {
    const trimmedName = firmName.trim();
    validate(trimmedName.length > 0, 'firmName cannot be empty');
    updateData.firmName = trimmedName;
  }

  // Validate and add firmEmail if provided
  if (firmEmail !== undefined) {
    const trimmedEmail = firmEmail.trim();
    validate(trimmedEmail.length > 0, 'firmEmail cannot be empty');

    const emailRegex = /^\S+@\S+\.\S+$/;
    validate(emailRegex.test(trimmedEmail), 'Please provide a valid email for firmEmail');

    updateData.firmEmail = trimmedEmail.toLowerCase();
  }

  // Add firmPhone if provided
  if (firmPhone !== undefined) {
    updateData.firmPhone = firmPhone.trim();
  }

  // Validate and add websiteURL if provided
  if (websiteURL !== undefined) {
    const trimmedURL = websiteURL.trim();

    if (trimmedURL.length > 0) {
      // More permissive URL validation that allows localhost, IPs, and various paths
      const urlRegex = /^(https?:\/\/)?([\w.-]+(:\d+)?)(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
      validate(urlRegex.test(trimmedURL), 'Please provide a valid URL for websiteURL');
    }

    updateData.websiteURL = trimmedURL;
  }

  // Add address if provided
  if (address !== undefined) {
    updateData.address = address.trim();
  }

  // Add description if provided
  if (description !== undefined) {
    updateData.description = description.trim();
  }

  // Check if any fields are being updated
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields provided for update'
    });
  }

  // Set userId for the query
  updateData.userId = userId;

  // Use findOneAndUpdate with upsert to create or update
  const company = await Company.findOneAndUpdate(
    { userId }, // Find by userId
    { $set: updateData }, // Update these fields
    {
      new: true, // Return the updated document
      upsert: true, // Create if doesn't exist
      runValidators: true, // Run model validators
      setDefaultsOnInsert: true // Set default values on insert
    }
  );

  // Transform company data to include full URL for firmLogo
  const companyData = company.toObject();
  companyData.firmLogo = getFullImageUrl(companyData.firmLogo, req);

  res.status(200).json({
    success: true,
    message: company.createdAt === company.updatedAt ? 'Company created successfully' : 'Company updated successfully',
    data: companyData
  });
}));

/**
 * @route   POST /api/company/logo
 * @desc    Upload company logo
 * @access  Private (requires authentication)
 * @body    FormData with 'firmLogo' file field
 */
router.post('/logo', authenticate, uploadCompanyLogo.single('firmLogo'), catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please provide a firmLogo file.'
    });
  }

  // Find or create company by userId
  let company = await Company.findByUserId(userId);

  if (!company) {
    // Create new company with empty fields if doesn't exist
    company = new Company({
      userId,
      firmName: '',
      firmEmail: '',
      firmPhone: '',
      websiteURL: '',
      address: '',
      description: ''
    });
  }

  // Delete old logo if exists
  if (company.firmLogo) {
    deleteOldCompanyLogo(company.firmLogo);
  }

  // Save new logo path (relative path)
  const logoPath = `/uploads/company-logos/${req.file.filename}`;
  company.firmLogo = logoPath;

  await company.save();

  res.status(200).json({
    success: true,
    message: 'Company logo uploaded successfully',
    data: {
      firmLogo: getFullImageUrl(company.firmLogo, req),
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
}));

/**
 * @route   DELETE /api/company/logo
 * @desc    Delete company logo
 * @access  Private (requires authentication)
 */
router.delete('/logo', authenticate, catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Find company by userId
  const company = await Company.findByUserId(userId);

  if (!company) {
    return res.status(404).json({
      success: false,
      message: 'Company not found'
    });
  }

  if (!company.firmLogo) {
    return res.status(404).json({
      success: false,
      message: 'No company logo to delete'
    });
  }

  // Delete the logo file
  deleteOldCompanyLogo(company.firmLogo);

  // Remove from database
  company.firmLogo = null;
  await company.save();

  res.status(200).json({
    success: true,
    message: 'Company logo deleted successfully'
  });
}));

/**
 * @route   GET /api/company
 * @desc    Get company information for authenticated user
 * @access  Private (requires authentication)
 * @note    Creates a new company with empty fields if it doesn't exist
 */
router.get('/', authenticate, catchAsync(async (req, res) => {
  // Get user ID from authenticated token
  const userId = req.auth.userId || req.user.id;

  // Find or create company by userId
  let company = await Company.findByUserId(userId);

  if (!company) {
    // Create new company with empty fields
    company = new Company({
      userId,
      firmName: '',
      firmEmail: '',
      firmPhone: '',
      websiteURL: '',
      address: '',
      description: ''
    });
    await company.save();
  }

  // Transform company data to include full URL for firmLogo
  const companyData = company.toObject();
  companyData.firmLogo = getFullImageUrl(companyData.firmLogo, req);

  res.status(200).json({
    success: true,
    data: companyData
  });
}));

/**
 * @route   GET /api/company/health
 * @desc    Health check for Company API routes
 * @access  Public
 */
router.get('/health', (_req, res) => {
  res.json({
    service: 'Company API',
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
