import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    service: 'PML Images Server',
    version: '1.0.0',
  });
});

// Health check with detailed system info
router.get('/detailed', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
  });
});

export default router;
