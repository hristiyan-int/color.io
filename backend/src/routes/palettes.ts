import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../types/index.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../services/supabase.js';
import { AppError } from '../middleware/errorHandler.js';

export const palettesRouter = Router();

// Validation schemas
const paletteColorSchema = z.object({
  hex_code: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  rgb_r: z.number().min(0).max(255),
  rgb_g: z.number().min(0).max(255),
  rgb_b: z.number().min(0).max(255),
  hsl_h: z.number().min(0).max(360),
  hsl_s: z.number().min(0).max(100),
  hsl_l: z.number().min(0).max(100),
  position: z.number().min(0),
  name: z.string().optional(),
});

const createPaletteSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  colors: z.array(paletteColorSchema).min(3).max(8),
  source_image_url: z.string().url().optional(),
  is_public: z.boolean().default(false),
  tags: z.array(z.string()).max(5).optional(),
});

const updatePaletteSchema = createPaletteSchema.partial();

/**
 * GET /api/palettes
 * Get user's palettes
 */
palettesRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { data, error } = await supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch palettes', 500);
  }
});

/**
 * GET /api/palettes/:id
 * Get single palette
 */
palettesRouter.get('/:id', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        ),
        profiles (id, username, display_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) throw new AppError('Palette not found', 404);

    // Check access
    if (!data.is_public && data.user_id !== req.user?.id) {
      throw new AppError('Access denied', 403);
    }

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch palette', 500);
  }
});

/**
 * POST /api/palettes
 * Create new palette
 */
palettesRouter.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const validated = createPaletteSchema.parse(req.body);
    const { colors, tags, ...paletteData } = validated;

    // Create palette
    const { data: palette, error: paletteError } = await supabaseAdmin
      .from('palettes')
      .insert({
        ...paletteData,
        user_id: req.user.id,
      })
      .select()
      .single();

    if (paletteError) throw new AppError(paletteError.message, 400);

    // Create colors
    const colorsWithPaletteId = colors.map((color) => ({
      ...color,
      palette_id: palette.id,
    }));

    const { error: colorsError } = await supabaseAdmin
      .from('palette_colors')
      .insert(colorsWithPaletteId);

    if (colorsError) throw new AppError(colorsError.message, 400);

    // Add tags if provided
    if (tags && tags.length > 0) {
      // Get or create tags
      for (const tagName of tags) {
        const { data: existingTag } = await supabaseAdmin
          .from('tags')
          .select('id')
          .eq('name', tagName.toLowerCase())
          .single();

        const tagId = existingTag?.id || (await (async () => {
          const { data: newTag } = await supabaseAdmin
            .from('tags')
            .insert({ name: tagName.toLowerCase() })
            .select('id')
            .single();
          return newTag?.id;
        })());

        if (tagId) {
          await supabaseAdmin
            .from('palette_tags')
            .insert({ palette_id: palette.id, tag_id: tagId });
        }
      }
    }

    // Fetch complete palette
    const { data: completePalette } = await supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        )
      `)
      .eq('id', palette.id)
      .single();

    res.status(201).json({ data: completePalette });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to create palette', 500);
  }
});

/**
 * PATCH /api/palettes/:id
 * Update palette
 */
palettesRouter.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;
    const validated = updatePaletteSchema.parse(req.body);
    const { colors, tags, ...paletteData } = validated;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('palettes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    // Update palette
    if (Object.keys(paletteData).length > 0) {
      const { error } = await supabaseAdmin
        .from('palettes')
        .update(paletteData)
        .eq('id', id);

      if (error) throw new AppError(error.message, 400);
    }

    // Update colors if provided
    if (colors) {
      await supabaseAdmin.from('palette_colors').delete().eq('palette_id', id);

      const colorsWithPaletteId = colors.map((color) => ({
        ...color,
        palette_id: id,
      }));

      await supabaseAdmin.from('palette_colors').insert(colorsWithPaletteId);
    }

    // Fetch updated palette
    const { data: updated } = await supabaseAdmin
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        )
      `)
      .eq('id', id)
      .single();

    res.json({ data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to update palette', 500);
  }
});

/**
 * DELETE /api/palettes/:id
 * Delete palette
 */
palettesRouter.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('palettes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    const { error } = await supabaseAdmin
      .from('palettes')
      .delete()
      .eq('id', id);

    if (error) throw new AppError(error.message, 400);

    res.json({ message: 'Palette deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete palette', 500);
  }
});

/**
 * POST /api/palettes/:id/like
 * Like a palette
 */
palettesRouter.post('/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('likes')
      .insert({ user_id: req.user.id, palette_id: id });

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.json({ message: 'Already liked' });
      }
      throw new AppError(error.message, 400);
    }

    res.json({ message: 'Liked' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to like palette', 500);
  }
});

/**
 * DELETE /api/palettes/:id/like
 * Unlike a palette
 */
palettesRouter.delete('/:id/like', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    await supabaseAdmin
      .from('likes')
      .delete()
      .eq('user_id', req.user.id)
      .eq('palette_id', id);

    res.json({ message: 'Unliked' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to unlike palette', 500);
  }
});

/**
 * GET /api/palettes/:id/comments
 * Get palette comments
 */
palettesRouter.get('/:id/comments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        profiles (id, username, display_name, avatar_url)
      `)
      .eq('palette_id', id)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(error.message, 400);

    res.json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch comments', 500);
  }
});

/**
 * POST /api/palettes/:id/comments
 * Add comment to palette
 */
palettesRouter.post('/:id/comments', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.length > 500) {
      throw new AppError('Invalid comment content', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({
        user_id: req.user.id,
        palette_id: id,
        content: content.trim(),
      })
      .select(`
        *,
        profiles (id, username, display_name, avatar_url)
      `)
      .single();

    if (error) throw new AppError(error.message, 400);

    res.status(201).json({ data });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to add comment', 500);
  }
});

/**
 * DELETE /api/palettes/:id/comments/:commentId
 * Delete a comment
 */
palettesRouter.delete('/:id/comments/:commentId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!supabaseAdmin || !req.user) {
      throw new AppError('Server error', 500);
    }

    const { commentId } = req.params;

    // Verify ownership
    const { data: comment } = await supabaseAdmin
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    if (comment.user_id !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw new AppError(error.message, 400);

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to delete comment', 500);
  }
});
