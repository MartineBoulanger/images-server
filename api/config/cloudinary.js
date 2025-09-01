import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

export default cloudinary;

export async function uploadToCloudinary(
  buffer,
  filename,
  folder = 'pml-images'
) {
  return new Promise((resolve, reject) => {
    // Convert buffer to data URI for Cloudinary
    const dataUri = `data:image/${filename
      .split('.')
      .pop()};base64,${buffer.toString('base64')}`;

    cloudinary.uploader.upload(
      dataUri,
      {
        folder: folder,
        public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension
        resource_type: 'auto',
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          console.log('Cloudinary upload success:', result.public_id);
          resolve(result);
        }
      }
    );
  });
}
