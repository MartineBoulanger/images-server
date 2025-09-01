import multer from 'multer';

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
});

export const uploadMultiple = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10,
  },
});
