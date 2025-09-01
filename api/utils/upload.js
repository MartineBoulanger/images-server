import { uploadToCloudinary } from '../config/cloudinary.js';
import { generateSafeFilename } from './helpers.js';
import cloudinary from '../config/cloudinary.js'; // Add this import

const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';

export async function uploadFile(buffer, originalName, mimetype) {
  const filename = generateSafeFilename(originalName);

  if (USE_CLOUDINARY) {
    try {
      console.log('Uploading to Cloudinary:', filename);
      const result = await uploadToCloudinary(buffer, filename);
      return {
        url: result.secure_url,
        provider: 'cloudinary',
        providerData: {
          public_id: result.public_id,
          version: result.version,
          signature: result.signature,
        },
      };
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
  } else {
    throw new Error('No storage provider configured');
  }
}

export async function deleteFile(fileRecord) {
  if (!fileRecord?.storage) return;

  try {
    if (
      fileRecord.storage.provider === 'cloudinary' &&
      fileRecord.storage.public_id
    ) {
      // Actually delete from Cloudinary
      console.log('Deleting from Cloudinary:', fileRecord.storage.public_id);
      await cloudinary.uploader.destroy(fileRecord.storage.public_id);
      console.log('Successfully deleted from Cloudinary');
    }
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    // Don't throw - we want to continue even if deletion fails
  }
}

export function validateFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml',
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error(`Unsupported file type: ${file.mimetype}`);
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File size exceeds 20MB limit');
  }

  return true;
}
