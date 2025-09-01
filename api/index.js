import express from 'express';
import imagesRouter from './routes/images.js';
import healthRouter from './routes/health.js';
import batchRouter from './routes/batch.js';
import { authMiddleware } from './middleware/auth.js';
import { corsMiddleware } from './middleware/cors.js';

const app = express();

// Middleware
app.use(express.json());
app.use(corsMiddleware);
app.use(authMiddleware);

// Routes
app.use('/api/health', healthRouter);
app.use('/api/images', imagesRouter);
app.use('/api/images/batch', batchRouter);

// Export the app for Vercel
export default app;
