import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRouter } from './routes/auth.js';
import { palettesRouter } from './routes/palettes.js';
import { profilesRouter } from './routes/profiles.js';
import { feedRouter } from './routes/feed.js';
import { tagsRouter } from './routes/tags.js';
import { colorsRouter } from './routes/colors.js';
import { supabaseAdmin } from './services/supabase.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS - support multiple origins (comma-separated in env)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8081').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting - general API
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter rate limiting for auth routes (brute force protection)
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'), // 5 attempts per minute
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Request logging with correlation IDs
app.use(requestLogger);

// Health check - basic
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Health check - with DB connectivity (for monitoring)
app.get('/health/ready', async (_req, res) => {
  const health: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    checks: { database: { status: string; latency?: number; error?: string } };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'unknown' },
    },
  };

  // Check database connectivity
  try {
    const start = Date.now();
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
      health.checks.database = {
        status: error ? 'error' : 'ok',
        latency: Date.now() - start,
        ...(error && { error: error.message }),
      };
    } else {
      health.checks.database = { status: 'not_configured' };
    }
  } catch (err) {
    health.checks.database = {
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }

  // Determine overall status
  const hasError = health.checks.database.status === 'error';
  const hasDegraded = health.checks.database.status === 'not_configured';
  health.status = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok';

  res.status(health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503).json(health);
});

// API Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/palettes', palettesRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/feed', feedRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/colors', colorsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🎨 Color.io API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
