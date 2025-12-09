import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const profilesRouter = Router();

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

/**
 * GET /api/profiles/me
 * Get current user's profile
 */
profilesRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw new AppError('Profile not found', 404);

    // Get stats
    const [palettesResult, followersResult, followingResult] = await Promise.all([
      supabaseAdmin
        .from('palettes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id),
      supabaseAdmin
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', req.user.id),
      supabaseAdmin
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', req.user.id),
    ]);

    res.json({
      data: {
        ...data,
        stats: {
          palettes_count: palettesResult.count || 0,
          followers_count: followersResult.count || 0,
          following_count: followingResult.count || 0,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch profile', 500);
  }
});

/**
 * PATCH /api/profiles/me
 * Update current user's profile
 */
profilesRouter.patch('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const validated = updateProfileSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(validated)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update profile', 500);
  }
});

/**
 * GET /api/profiles/:username
 * Get user profile by username
 */
profilesRouter.get('/:username', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { username } = req.params;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) throw new AppError('User not found', 404);

    // Get stats
    const [palettesResult, followersResult, followingResult] = await Promise.all([
      supabaseAdmin
        .from('palettes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', data.id)
        .eq('is_public', true),
      supabaseAdmin
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', data.id),
      supabaseAdmin
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', data.id),
    ]);

    // Check if current user follows this profile
    let isFollowing = false;
    if (req.user) {
      const { data: followData } = await supabaseAdmin
        .from('follows')
        .select('follower_id')
        .eq('follower_id', req.user.id)
        .eq('following_id', data.id)
        .single();
      isFollowing = !!followData;
    }

    res.json({
      data: {
        ...data,
        stats: {
          palettes_count: palettesResult.count || 0,
          followers_count: followersResult.count || 0,
          following_count: followingResult.count || 0,
        },
        is_following: isFollowing,
      },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch profile', 500);
  }
});

/**
 * POST /api/profiles/:id/follow
 * Follow a user
 */
profilesRouter.post('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    if (id === req.user.id) {
      throw new AppError('Cannot follow yourself', 400);
    }

    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: req.user.id, following_id: id });

    if (error) {
      if (error.code === '23505') {
        return res.json({ message: 'Already following' });
      }
      throw new AppError(error.message, 400);
    }

    res.json({ message: 'Following' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to follow user', 500);
  }
});

/**
 * DELETE /api/profiles/:id/follow
 * Unfollow a user
 */
profilesRouter.delete('/:id/follow', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', req.user.id)
      .eq('following_id', id);

    res.json({ message: 'Unfollowed' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to unfollow user', 500);
  }
});

/**
 * GET /api/profiles/:id/followers
 * Get user's followers
 */
profilesRouter.get('/:id/followers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('follows')
      .select(`
        profiles!follows_follower_id_fkey (
          id, username, display_name, avatar_url
        )
      `)
      .eq('following_id', id);

    if (error) throw new AppError(error.message, 400);

    res.json({ data: data.map((f: any) => f.profiles) });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch followers', 500);
  }
});

/**
 * GET /api/profiles/:id/following
 * Get users that this user follows
 */
profilesRouter.get('/:id/following', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('follows')
      .select(`
        profiles!follows_following_id_fkey (
          id, username, display_name, avatar_url
        )
      `)
      .eq('follower_id', id);

    if (error) throw new AppError(error.message, 400);

    res.json({ data: data.map((f: any) => f.profiles) });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch following', 500);
  }
});
