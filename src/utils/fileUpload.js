/**
 * File Upload Utility
 * Handles file uploads to Supabase Storage
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

// Create admin client for storage operations (bypasses RLS)
const getStorageClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials for storage operations');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

/**
 * Upload file to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} originalName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder path in storage (e.g., 'documents', 'invoices')
 * @param {string} bucket - Bucket name (e.g., 'documents', 'structure-banners')
 * @returns {Object} - Upload result with public URL
 */
async function uploadToSupabase(fileBuffer, originalName, mimeType, folder = 'documents', bucket = 'documents') {
  const supabase = getStorageClient();

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `${sanitizedBaseName}_${timestamp}${ext}`;
  const filePath = `${folder}/${fileName}`;

  // Upload file to Supabase Storage
  const { error } = await supabase.storage
    .from(bucket) // Use dynamic bucket name
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false
    });

  if (error) {
    throw new Error(`Error uploading file to storage: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl,
    fileName,
    size: fileBuffer.length
  };
}

/**
 * Delete file from Supabase Storage
 * @param {string} filePath - File path in storage
 * @returns {boolean} - Success status
 */
async function deleteFromSupabase(filePath) {
  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath]);

  if (error) {
    throw new Error(`Error deleting file from storage: ${error.message}`);
  }

  return true;
}

/**
 * Get file public URL
 * @param {string} filePath - File path in storage
 * @returns {string} - Public URL
 */
function getFilePublicUrl(filePath) {
  const supabase = getStorageClient();

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(filePath);

  return publicUrl;
}

module.exports = {
  uploadToSupabase,
  deleteFromSupabase,
  getFilePublicUrl
};
