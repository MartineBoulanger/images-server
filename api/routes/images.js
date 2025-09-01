import express from 'express';
import { upload } from '../config/multer.js';
import { readDB, writeDB } from '../config/database.js';
import { normalizeTags, parseCustomData } from '../utils/helpers.js';
import { del } from '@vercel/blob';
import { randomUUID } from 'crypto';

const router = express.Router();

// Upload image
// router.post('/', upload.single('image'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: 'No file uploaded' });
//     }

//     validateFile(req.file);

//     const {
//       width = 0,
//       height = 0,
//       alt = '',
//       tags = [],
//       custom = {},
//     } = req.body;

//     // Upload to storage (Cloudinary or Vercel Blob)
//     const uploadResult = await uploadFile(
//       req.file.buffer,
//       req.file.originalname,
//       req.file.mimetype
//     );

//     const record = {
//       id: randomUUID(),
//       filename: req.file.originalname,
//       url: uploadResult.url,
//       storage: {
//         provider: uploadResult.provider,
//         ...uploadResult.providerData,
//       },
//       title: req.body.title || req.file.originalname.split('.')[0],
//       alt: String(alt),
//       tags: normalizeTags(tags),
//       custom: parseCustomData(custom),
//       size: req.file.size,
//       width: parseInt(width) || 0,
//       height: parseInt(height) || 0,
//       mimetype: req.file.mimetype,
//       uploadedAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//     };

//     const db = await readDB();
//     db.push(record);
//     await writeDB(db);

//     res.status(201).json(record);
//   } catch (err) {
//     console.error('Upload error:', err);
//     res.status(400).json({
//       error: 'Upload failed',
//       message: err.message,
//     });
//   }
// });
// In your upload route - add detailed logging
router.post('/', upload.single('image'), async (req, res) => {
  console.log('Upload request received');

  try {
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File details:', {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });

    const {
      width = 0,
      height = 0,
      alt = '',
      tags = [],
      custom = {},
    } = req.body;
    console.log('Body data:', { width, height, alt, tags, custom });

    const filename = generateSafeFilename(req.file.originalname);
    console.log('Generated filename:', filename);

    let fileUrl;
    let storageInfo = {};

    if (USE_CLOUDINARY) {
      console.log('Using Cloudinary upload');
      const result = await uploadToCloudinary(req.file.buffer, filename);
      fileUrl = result.secure_url;
      storageInfo = { provider: 'cloudinary', public_id: result.public_id };
    } else {
      console.log('Using Vercel Blob upload');
      const blob = await put(filename, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
      });
      fileUrl = blob.url;
      storageInfo = { provider: 'vercel-blob', blobUrl: blob.url };
    }

    console.log('File uploaded successfully:', fileUrl);

    // ... rest of your code
  } catch (err) {
    console.error('UPLOAD ERROR DETAILS:', err);
    res.status(400).json({
      error: 'Upload failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Upload multiple images
router.post('/bulk', uploadMultiple.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        validateFile(file);

        const uploadResult = await uploadFile(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const record = {
          id: randomUUID(),
          filename: file.originalname,
          url: uploadResult.url,
          storage: {
            provider: uploadResult.provider,
            ...uploadResult.providerData,
          },
          title: file.originalname.split('.')[0],
          alt: `Image: ${file.originalname}`,
          tags: normalizeTags(req.body.tags),
          custom: {},
          size: file.size,
          width: 0,
          height: 0,
          mimetype: file.mimetype,
          uploadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const db = await readDB();
        db.push(record);
        await writeDB(db);

        results.push(record);
      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(400).json({
      error: 'Bulk upload failed',
      message: err.message,
    });
  }
});

// Get all images
// router.get('/', async (req, res) => {
//   const { search = '', tag = '', page = '1', limit = '20' } = req.query;
//   const p = Math.max(1, parseInt(page));
//   const l = Math.min(100, Math.max(1, parseInt(limit)));

//   const db = await readDB();
//   let items = db;

//   if (search) {
//     const q = String(search).toLowerCase();
//     items = items.filter(
//       (r) =>
//         r.title?.toLowerCase().includes(q) ||
//         r.alt?.toLowerCase().includes(q) ||
//         r.tags?.some((t) => t.toLowerCase().includes(q))
//     );
//   }

//   if (tag) {
//     const t = String(tag).toLowerCase();
//     items = items.filter((r) =>
//       r.tags?.map((x) => x.toLowerCase()).includes(t)
//     );
//   }

//   const total = items.length;
//   const start = (p - 1) * l;
//   const paged = items.slice(start, start + l);

//   res.json({ items: paged, total, page: p, limit: l });
// });
router.get('/', async (req, res) => {
  try {
    console.log('List images request:', req.query);

    const { search = '', tag = '', page = '1', limit = '20' } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, Math.max(1, parseInt(limit)));

    console.log('Reading database...');
    const db = await readDB();
    console.log(`Found ${db.length} images in database`);

    let items = db;

    // Filter by search
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.alt?.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q))
      );
      console.log(`After search filter: ${items.length} images`);
    }

    // Filter by tag
    if (tag) {
      const t = String(tag).toLowerCase();
      items = items.filter((r) =>
        r.tags?.map((x) => x.toLowerCase()).includes(t)
      );
      console.log(`After tag filter: ${items.length} images`);
    }

    // Pagination
    const total = items.length;
    const start = (p - 1) * l;
    const paged = items.slice(start, start + l);

    console.log(`Returning page ${p} of ${Math.ceil(total / l)}`);

    res.json({
      items: paged,
      total,
      page: p,
      limit: l,
    });
  } catch (error) {
    console.error('LIST IMAGES ERROR:', error);
    res.status(500).json({
      error: 'Failed to list images',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
});

// Get single image
router.get('/:id', async (req, res) => {
  const db = await readDB();
  const item = db.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// Update image
router.patch('/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const body = req.body || {};
  const curr = db[idx];
  const next = {
    ...curr,
    title: body.title !== undefined ? String(body.title) : curr.title,
    alt: body.alt !== undefined ? String(body.alt) : curr.alt,
    tags: body.tags !== undefined ? normalizeTags(body.tags) : curr.tags,
    custom: body.custom !== undefined ? body.custom : curr.custom,
    updatedAt: new Date().toISOString(),
  };

  db[idx] = next;
  await writeDB(db);
  res.json(next);
});

// Delete image
router.delete('/:id', async (req, res) => {
  try {
    const db = await readDB();
    const idx = db.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const [removed] = db.splice(idx, 1);
    await writeDB(db);

    // Delete from storage if using Vercel Blob
    if (!USE_CLOUDINARY && removed.storage?.blobUrl) {
      try {
        await del(removed.storage.blobUrl);
      } catch (error) {
        console.error('Error deleting blob:', error);
      }
    }

    // TODO: Add Cloudinary deletion if needed

    res.json({ ok: true, id: removed.id });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
