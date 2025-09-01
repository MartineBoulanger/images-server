import express from 'express';
import { upload, uploadMultiple } from '../config/multer.js';
import { readDB, writeDB } from '../config/database.js';
import { normalizeTags, parseCustomData } from '../utils/helpers.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { randomUUID } from 'crypto';
import cloudinary from '../config/cloudinary.js'; // Add this import

const router = express.Router();
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true'; // Add this

// Upload image
router.post('/', upload.single('image'), async (req, res) => {
  console.log('Cloudinary upload started');

  try {
    // Basic validation
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname, req.file.size);

    const {
      width = 0,
      height = 0,
      alt = '',
      tags = [],
      custom = {},
      title = '',
    } = req.body;

    // Upload to Cloudinary
    console.log('Uploading to Cloudinary...');
    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'pml-images'
    );

    console.log('Cloudinary upload successful:', cloudinaryResult.public_id);

    // Create database record
    const record = {
      id: randomUUID(),
      filename: req.file.originalname,
      url: cloudinaryResult.secure_url,
      storage: {
        provider: 'cloudinary',
        public_id: cloudinaryResult.public_id,
        version: cloudinaryResult.version,
        signature: cloudinaryResult.signature,
      },
      title: title || req.file.originalname.split('.')[0],
      alt: String(alt),
      tags: normalizeTags(tags),
      custom: parseCustomData(custom),
      size: req.file.size,
      width: parseInt(width) || cloudinaryResult.width || 0,
      height: parseInt(height) || cloudinaryResult.height || 0,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to database
    try {
      const db = await readDB();
      db.push(record);
      await writeDB(db);
      console.log('Record saved to database');
    } catch (dbError) {
      console.warn('Database save failed (continuing anyway):', dbError);
    }

    res.status(201).json(record);
    console.log('Upload completed successfully');
  } catch (error) {
    console.error('UPLOAD ERROR:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message,
    });
  }
});

// Upload multiple images - SIMPLIFY THIS or remove for now
router.post('/bulk', uploadMultiple.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        // Create simple form data for each file
        const formData = new FormData();
        formData.append('image', file);
        formData.append('title', file.originalname.split('.')[0]);
        formData.append('alt', `Image: ${file.originalname}`);

        if (req.body.tags) {
          formData.append('tags', req.body.tags);
        }

        // Use the single upload endpoint for each file
        const uploadResponse = await fetch(
          `${process.env.BASE_URL || 'http://localhost:3001'}/api/images`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          results.push(result);
        } else {
          throw new Error(`Upload failed: ${uploadResponse.status}`);
        }
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
router.get('/', async (req, res) => {
  try {
    const { search = '', tag = '', page = '1', limit = '20' } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, Math.max(1, parseInt(limit)));

    const db = await readDB();
    let items = db;

    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.alt?.toLowerCase().includes(q) ||
          r.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (tag) {
      const t = String(tag).toLowerCase();
      items = items.filter((r) =>
        r.tags?.map((x) => x.toLowerCase()).includes(t)
      );
    }

    const total = items.length;
    const start = (p - 1) * l;
    const paged = items.slice(start, start + l);

    res.json({ items: paged, total, page: p, limit: l });
  } catch (error) {
    console.error('List images error:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Get single image
router.get('/:id', async (req, res) => {
  try {
    const db = await readDB();
    const item = db.find((r) => r.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Failed to get image' });
  }
});

// Update image
router.patch('/:id', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Update image error:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Delete image - FIX THIS for Cloudinary
router.delete('/:id', async (req, res) => {
  try {
    const db = await readDB();
    const idx = db.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const [removed] = db.splice(idx, 1);
    await writeDB(db);

    // Delete from Cloudinary
    if (
      removed.storage?.provider === 'cloudinary' &&
      removed.storage.public_id
    ) {
      try {
        await cloudinary.uploader.destroy(removed.storage.public_id);
        console.log('Deleted from Cloudinary:', removed.storage.public_id);
      } catch (error) {
        console.error('Cloudinary deletion error:', error);
        // Continue even if deletion fails
      }
    }

    res.json({ ok: true, id: removed.id });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;
