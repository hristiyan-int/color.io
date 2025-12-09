import { Router } from 'express';
import type { Request, Response } from 'express';

export const authRouter = Router();

// Note: Most auth is handled client-side with Supabase
// These endpoints are for any server-side auth needs

/**
 * POST /api/auth/verify
 * Verify a JWT token
 */
authRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    // Token verification is handled by Supabase
    // This endpoint can be used to verify tokens server-side if needed
    res.json({ valid: true });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
