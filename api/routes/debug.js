import express from 'express';
import { readDB } from '../config/database.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/db-status', async (req, res) => {
  try {
    const dbPath = path.join(process.cwd(), 'api', 'data', 'images.json');
    const dbExists = fs.existsSync(dbPath);

    const stats = dbExists ? fs.statSync(dbPath) : null;
    const db = await readDB();

    res.json({
      dbExists,
      dbPath,
      dbSize: stats?.size || 0,
      dbModified: stats?.mtime || null,
      recordCount: db.length,
      records: process.env.NODE_ENV === 'development' ? db : undefined,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
});

export default router;
