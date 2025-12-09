import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { requestLogger } from '../../src/middleware/requestLogger.js';

// Create test app without rate limiting for testing
export function createTestApp() {
  const app = express();

  // Security middleware (minimal for tests)
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

// Helper to generate auth header
export function authHeader(token: string = 'valid-test-token') {
  return { Authorization: `Bearer ${token}` };
}

// Valid test colors for palette creation
export const validPaletteColors = [
  { hex_code: '#FF6B6B', rgb_r: 255, rgb_g: 107, rgb_b: 107, hsl_h: 0, hsl_s: 100, hsl_l: 71, position: 0 },
  { hex_code: '#4ECDC4', rgb_r: 78, rgb_g: 205, rgb_b: 196, hsl_h: 174, hsl_s: 58, hsl_l: 55, position: 1 },
  { hex_code: '#45B7D1', rgb_r: 69, rgb_g: 183, rgb_b: 209, hsl_h: 191, hsl_s: 59, hsl_l: 55, position: 2 },
];

// Valid palette creation payload
export const validPalettePayload = {
  name: 'My Test Palette',
  description: 'A beautiful test palette',
  colors: validPaletteColors,
  is_public: false,
};
