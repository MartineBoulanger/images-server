const CORS_ORIGINS = (
  process.env.CORS_ORIGINS || 'http://localhost:3000'
).split(',');

export const corsMiddleware = cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return cb(null, true);

    // Check if origin is in allowed list
    const ok = CORS_ORIGINS.includes(origin);
    cb(ok ? null : new Error('CORS blocked'), ok);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
});
