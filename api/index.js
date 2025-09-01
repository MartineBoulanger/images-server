import express from 'express';
import cors from 'cors';
import imagesRouter from './routes/images.js';
import healthRouter from './routes/health.js';
import batchRouter from './routes/batch.js';
import debugRouter from './routes/debug.js';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(corsMiddleware);
app.use(authMiddleware);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/images', imagesRouter);
app.use('/api/images/batch', batchRouter);
app.use('/api/debug', debugRouter);

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://www.petmastersleague.com',
      'https://pet-tourneys.vercel.app',
    ],
    credentials: true,
  })
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
