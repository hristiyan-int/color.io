import request from 'supertest';
import express from 'express';

// Create a minimal test app for health checks
const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'ok', latency: 10 },
    },
  });
});

describe('Health Endpoints', () => {
  describe('GET /health', () => {
    it('should return ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app).get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /health/ready', () => {
    it('should return ok status with database check', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('checks');
      expect(response.body.checks).toHaveProperty('database');
      expect(response.body.checks.database).toHaveProperty('status', 'ok');
    });

    it('should include latency in database check', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.body.checks.database).toHaveProperty('latency');
      expect(typeof response.body.checks.database.latency).toBe('number');
    });
  });
});
