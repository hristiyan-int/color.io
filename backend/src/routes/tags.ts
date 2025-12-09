import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const tagsRouter = Router();

/**
 * GET /api/tags
 * Get all tags, optionally filtered by category
 */
tagsRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { category, limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    let query = supabaseAdmin
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limitNum);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch tags', 500);
  }
});

/**
 * GET /api/tags/search
 * Search tags by name
 */
tagsRouter.get('/search', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      throw new AppError('Search query required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('tags')
      .select('*')
      .ilike('name', `%${q}%`)
      .order('usage_count', { ascending: false })
      .limit(20);

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to search tags', 500);
  }
});

/**
 * GET /api/tags/:name/palettes
 * Get palettes with a specific tag
 */
tagsRouter.get('/:name/palettes', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { name } = req.params;
    const { limit = '20', cursor } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    // First get the tag
    const { data: tag } = await supabaseAdmin
      .from('tags')
      .select('id')
      .eq('name', name.toLowerCase())
      .single();

    if (!tag) {
      throw new AppError('Tag not found', 404);
    }

    // Get palette IDs with this tag
    const { data: paletteTags } = await supabaseAdmin
      .from('palette_tags')
      .select('palette_id')
      .eq('tag_id', tag.id);

    const paletteIds = paletteTags?.map((pt) => pt.palette_id) || [];

    if (paletteIds.length === 0) {
      return res.json({ data: [], hasMore: false });
    }

    // Get palettes
    let query = supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        profiles (id, username, display_name, avatar_url)
      `)
      .in('id', paletteIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limitNum + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 400);

    const hasMore = data.length > limitNum;
    const palettes = hasMore ? data.slice(0, limitNum) : data;

    res.json({
      data: palettes,
      cursor: palettes.length > 0 ? palettes[palettes.length - 1].created_at : null,
      hasMore,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch palettes by tag', 500);
  }
});
