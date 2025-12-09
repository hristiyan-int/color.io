import request from 'supertest';
import express from 'express';
import { authRouter } from '../../src/routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  describe('POST /api/auth/verify', () => {
    it('should return valid: true when token is provided', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: 'test-token' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true });
    });

    it('should return 400 when token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token required' });
    });

    it('should return 400 when token is null', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: null });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token required' });
    });

    it('should return 400 when token is empty string', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token required' });
    });

    it('should accept valid JWT format token', async () => {
      const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await request(app)
        .post('/api/auth/verify')
        .send({ token: jwtToken });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ valid: true });
    });
  });
});
