import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

// ===== Config =====
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data'); // For metadata only
const DATA_IMAGES_FILE = path.join(DATA_DIR, 'images.json');
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS || 'http://localhost:3000'
).split(',');
const API_KEY = process.env.API_KEY || '';

// ===== Bootstrapping =====
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Initialize metadata storage only
ensureDirSync(DATA_DIR);
if (!fs.existsSync(DATA_IMAGES_FILE))
  fs.writeFileSync(DATA_IMAGES_FILE, '[]', 'utf-8');

async function readDB() {
  try {
    const raw = await fsp.readFile(DATA_IMAGES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    // If file doesn't exist, return empty array
    return [];
  }
}

async function writeDB(data) {
  const tmp = DATA_IMAGES_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, DATA_IMAGES_FILE);
}

// ===== Express app =====
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = CORS_ORIGINS.includes(origin);
      cb(ok ? null : new Error('CORS blocked'), ok);
    },
    credentials: false,
  })
);

// API key middleware
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.header('x-api-key');
  if (key && key === API_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
});

// ===== Multer (upload) =====
const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
]);

// Use memory storage since we'll upload directly to Vercel Blob
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB (Vercel Blob supports larger files)
});

// ===== Helpers =====
function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags))
    return tags
      .map(String)
      .map((t) => t.trim())
      .filter(Boolean);
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
}

function generateSafeFilename(originalName) {
  const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const timestamp = Date.now();
  const uuid = randomUUID().slice(0, 8);
  return `${timestamp}_${uuid}_${safeName}`;
}

// ===== Routes =====
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/images', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const {
      width = 0,
      height = 0,
      alt = '',
      tags = [],
      custom = {},
    } = req.body;

    // Generate a safe filename for Vercel Blob
    const filename = generateSafeFilename(req.file.originalname);

    // Upload to Vercel Blob
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    const record = {
      id: randomUUID(),
      filename: filename,
      url: blob.url,
      blobUrl: blob.url, // Store the blob URL for potential deletion
      title: req.file.originalname.split('.')[0],
      alt: String(alt),
      tags: normalizeTags(tags),
      custom: (() => {
        try {
          return typeof custom === 'string' ? JSON.parse(custom) : custom;
        } catch {
          return {};
        }
      })(),
      size: req.file.size,
      width: String(width),
      height: String(height),
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    const db = await readDB();
    db.push(record);
    await writeDB(db);

    res.status(201).json(record);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(400).json({ error: err?.message || 'Upload failed' });
  }
});

app.get('/api/images', async (req, res) => {
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
});

app.post('/api/images/batch', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }

    if (ids.length > 50) {
      return res.status(400).json({ error: 'Too many IDs requested' });
    }

    const db = await readDB();
    const images = await Promise.all(
      ids.map(async (id) => {
        try {
          const image = await db.find((r) => r.id === id);
          return image;
        } catch (error) {
          console.error(`Failed to fetch image ${id}:`, error);
          return null;
        }
      })
    );

    const validImages = images.filter(Boolean);
    res.json(validImages);
  } catch (error) {
    console.error('Batch images fetch failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/images/:id', async (req, res) => {
  const db = await readDB();
  const item = db.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.patch('/api/images/:id', async (req, res) => {
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

app.post('/api/images/:id/file', upload.single('image'), async (req, res) => {
  try {
    const db = await readDB();
    const idx = db.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const prev = db[idx];

    // Delete old blob if it exists
    if (prev.blobUrl) {
      try {
        await del(prev.blobUrl);
      } catch (error) {
        console.error('Error deleting old blob:', error);
      }
    }

    // Upload new file to Vercel Blob
    const filename = generateSafeFilename(req.file.originalname);
    const blob = await put(filename, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    // Update record
    prev.filename = filename;
    prev.url = blob.url;
    prev.blobUrl = blob.url;
    prev.size = req.file.size;
    prev.mimetype = req.file.mimetype;
    prev.updatedAt = new Date().toISOString();

    db[idx] = prev;
    await writeDB(db);
    res.json(prev);
  } catch (err) {
    console.error('File replacement error:', err);
    res.status(400).json({ error: err?.message || 'File replacement failed' });
  }
});

app.delete('/api/images/:id', async (req, res) => {
  try {
    const db = await readDB();
    const idx = db.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const [removed] = db.splice(idx, 1);
    await writeDB(db);

    // Delete from Vercel Blob
    if (removed.blobUrl) {
      try {
        await del(removed.blobUrl);
      } catch (error) {
        console.error('Error deleting blob:', error);
        // Continue even if blob deletion fails
      }
    }

    res.json({ ok: true, id: removed.id });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Export the app for Vercel
export default app;
