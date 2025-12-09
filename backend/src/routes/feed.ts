import { Router } from 'express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const feedRouter = Router();

/**
 * GET /api/feed
 * Get community feed
 * Query params: type (trending|recent|following), cursor, limit
 */
feedRouter.get('/', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { type = 'trending', cursor, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    let query = supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        ),
        profiles (id, username, display_name, avatar_url)
      `)
      .eq('is_public', true)
      .limit(limitNum + 1); // +1 to check if there are more

    // Apply cursor for pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    // Apply ordering based on type
    switch (type) {
      case 'trending':
        // Trending: order by likes in last 7 days
        query = query.order('likes_count', { ascending: false });
        break;
      case 'recent':
        query = query.order('created_at', { ascending: false });
        break;
      case 'following':
        if (!req.user) {
          throw new AppError('Authentication required for following feed', 401);
        }
        // Get followed users
        const { data: following } = await supabaseAdmin
          .from('follows')
          .select('following_id')
          .eq('follower_id', req.user.id);

        const followedIds = following?.map((f) => f.following_id) || [];
        if (followedIds.length === 0) {
          return res.json({ data: [], hasMore: false });
        }
        query = query.in('user_id', followedIds);
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 400);

    // Check if there are more results
    const hasMore = data.length > limitNum;
    const palettes = hasMore ? data.slice(0, limitNum) : data;

    // Get like status for authenticated user
    let likedPaletteIds: string[] = [];
    if (req.user && palettes.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from('likes')
        .select('palette_id')
        .eq('user_id', req.user.id)
        .in('palette_id', palettes.map((p: any) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    // Get comment counts
    const paletteIds = palettes.map((p: any) => p.id);
    const { data: commentCounts } = await supabaseAdmin
      .from('comments')
      .select('palette_id')
      .in('palette_id', paletteIds);

    const commentCountMap = (commentCounts || []).reduce((acc: Record<string, number>, c) => {
      acc[c.palette_id] = (acc[c.palette_id] || 0) + 1;
      return acc;
    }, {});

    // Enrich palettes with like status and comment count
    const enrichedPalettes = palettes.map((palette: any) => ({
      ...palette,
      is_liked: likedPaletteIds.includes(palette.id),
      comments_count: commentCountMap[palette.id] || 0,
    }));

    res.json({
      data: enrichedPalettes,
      cursor: palettes.length > 0 ? palettes[palettes.length - 1].created_at : null,
      hasMore,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch feed', 500);
  }
});

/**
 * GET /api/feed/search
 * Search palettes
 */
feedRouter.get('/search', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { q, tag, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    if (!q && !tag) {
      throw new AppError('Search query or tag required', 400);
    }

    let query = supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        ),
        profiles (id, username, display_name, avatar_url)
      `)
      .eq('is_public', true)
      .limit(limitNum);

    // Search by name/description
    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    // Filter by tag
    if (tag) {
      // Get palettes with this tag
      const { data: taggedPalettes } = await supabaseAdmin
        .from('palette_tags')
        .select('palette_id, tags!inner(name)')
        .eq('tags.name', (tag as string).toLowerCase());

      const paletteIds = taggedPalettes?.map((p) => p.palette_id) || [];
      if (paletteIds.length === 0) {
        return res.json({ data: [] });
      }
      query = query.in('id', paletteIds);
    }

    query = query.order('likes_count', { ascending: false });

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to search', 500);
  }
});
