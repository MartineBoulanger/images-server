import { put, del } from '@vercel/blob';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { generateSafeFilename } from './helpers.js';

const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';

export async function uploadFile(buffer, originalName, mimetype) {
  const filename = generateSafeFilename(originalName);

  if (USE_CLOUDINARY) {
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
  } else {
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimetype,
    });
    return {
      url: blob.url,
      provider: 'vercel-blob',
      providerData: {
        blobUrl: blob.url,
        pathname: blob.pathname,
      },
    };
  }
}

export async function deleteFile(fileRecord) {
  if (!fileRecord?.storage) return;

  try {
    if (
      fileRecord.storage.provider === 'vercel-blob' &&
      fileRecord.storage.blobUrl
    ) {
      await del(fileRecord.storage.blobUrl);
    } else if (
      fileRecord.storage.provider === 'cloudinary' &&
      fileRecord.storage.public_id
    ) {
      // Cloudinary deletion would require additional setup
      console.log(
        'Cloudinary deletion would happen here for:',
        fileRecord.storage.public_id
      );
    }
  } catch (error) {
    console.error('Error deleting file from storage:', error);
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
