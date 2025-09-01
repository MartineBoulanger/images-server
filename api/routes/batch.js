import express from 'express';
import { readDB } from '../config/database.js';

const router = express.Router();

// Get multiple images by IDs
router.post('/', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'IDs array is required and must not be empty',
      });
    }

    if (ids.length > 50) {
      return res.status(400).json({
        error: 'Too many IDs',
        message: 'Maximum 50 IDs allowed per request',
      });
    }

    const db = await readDB();

    // Filter for valid IDs and remove duplicates
    const validIds = [
      ...new Set(
        ids.filter((id) => id && typeof id === 'string' && id.trim() !== '')
      ),
    ];

    const images = validIds
      .map((id) => {
        const image = db.find((r) => r.id === id);
        return image || null;
      })
      .filter(Boolean);

    res.json(images);
  } catch (error) {
    console.error('Batch images fetch failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch batch images',
    });
  }
});

// Get image counts by tags
router.get('/stats', async (req, res) => {
  try {
    const db = await readDB();

    const stats = {
      total: db.length,
      byFormat: {},
      byTag: {},
      totalSize: 0,
    };

    db.forEach((image) => {
      // Count by format
      const format = image.mimetype?.split('/')[1] || 'unknown';
      stats.byFormat[format] = (stats.byFormat[format] || 0) + 1;

      // Count by tags
      if (image.tags && Array.isArray(image.tags)) {
        image.tags.forEach((tag) => {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        });
      }

      // Total size
      stats.totalSize += image.size || 0;
    });

    res.json(stats);
  } catch (error) {
    console.error('Batch stats failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate statistics',
    });
  }
});

export default router;
