/**
 * File Upload Middleware
 * Handles file uploads using multer
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const profilesDir = path.join(uploadDir, 'profiles');
const companyLogosDir = path.join(uploadDir, 'company-logos');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

if (!fs.existsSync(companyLogosDir)) {
  fs.mkdirSync(companyLogosDir, { recursive: true });
}

// Configure storage for profile images
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profilesDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.auth?.userId || req.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `profile_${userId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// File filter to accept only images
const imageFilter = (req, file, cb) => {
  // Accept only image files
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer for profile image upload
const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Configure storage for company logos
const companyLogoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, companyLogosDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.auth?.userId || req.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `company_logo_${userId}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

// Configure multer for company logo upload
const uploadCompanyLogo = multer({
  storage: companyLogoStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});

// Helper function to delete old profile image
const deleteOldProfileImage = (imagePath) => {
  if (!imagePath) return;

  const fullPath = path.join(__dirname, '../..', imagePath);

  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log('Old profile image deleted:', fullPath);
    } catch (error) {
      console.error('Error deleting old profile image:', error);
    }
  }
};

// Helper function to delete old company logo
const deleteOldCompanyLogo = (logoPath) => {
  if (!logoPath) return;

  const fullPath = path.join(__dirname, '../..', logoPath);

  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      console.log('Old company logo deleted:', fullPath);
    } catch (error) {
      console.error('Error deleting old company logo:', error);
    }
  }
};

module.exports = {
  uploadProfileImage,
  deleteOldProfileImage,
  uploadCompanyLogo,
  deleteOldCompanyLogo
};
