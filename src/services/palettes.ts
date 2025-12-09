import { supabase } from './supabase';
import { tagsService } from './tags';
import type { Palette, PaletteColor, PaletteCreate, PaletteUpdate, Tag, TagCategory } from '@/types';

export interface DbPalette {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_image_url: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  likes_count: number;
  created_at: string;
  updated_at: string;
  palette_colors: DbPaletteColor[];
  palette_tags?: { tags: DbTag }[];
  profiles?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface DbPaletteColor {
  id: string;
  palette_id: string;
  hex_code: string;
  rgb_r: number;
  rgb_g: number;
  rgb_b: number;
  hsl_h: number;
  hsl_s: number;
  hsl_l: number;
  position: number;
  name: string | null;
}

export interface DbTag {
  id: string;
  name: string;
  category: string | null;
}

function mapDbPaletteToPalette(dbPalette: DbPalette): Palette {
  const colors: PaletteColor[] = (dbPalette.palette_colors || [])
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      hex: c.hex_code,
      rgb: { r: c.rgb_r, g: c.rgb_g, b: c.rgb_b },
      hsl: { h: c.hsl_h, s: c.hsl_s, l: c.hsl_l },
      position: c.position,
      name: c.name || undefined,
    }));

  const tags: Tag[] | undefined = dbPalette.palette_tags?.map((pt) => ({
    id: pt.tags.id,
    name: pt.tags.name,
    category: pt.tags.category as TagCategory | undefined,
    usageCount: 0,
  }));

  return {
    id: dbPalette.id,
    userId: dbPalette.user_id,
    name: dbPalette.name,
    description: dbPalette.description || undefined,
    colors,
    tags,
    sourceImageUrl: dbPalette.source_image_url || undefined,
    thumbnailUrl: dbPalette.thumbnail_url || undefined,
    isPublic: dbPalette.is_public,
    likesCount: dbPalette.likes_count,
    createdAt: dbPalette.created_at,
    updatedAt: dbPalette.updated_at,
  };
}

export const paletteService = {
  /**
   * Get all palettes for the current user
   */
  async getUserPalettes(): Promise<Palette[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapDbPaletteToPalette);
  },

  /**
   * Get a single palette by ID
   */
  async getPalette(id: string): Promise<Palette | null> {
    const { data, error } = await supabase
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

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(error.message);
    }

    return mapDbPaletteToPalette(data);
  },

  /**
   * Create a new palette
   */
  async createPalette(palette: PaletteCreate): Promise<Palette> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create the palette
    const { data: createdPalette, error: paletteError } = await supabase
      .from('palettes')
      .insert({
        user_id: user.id,
        name: palette.name,
        description: palette.description || null,
        source_image_url: palette.sourceImageUrl || null,
        is_public: palette.isPublic || false,
      })
      .select()
      .single();

    if (paletteError) throw new Error(paletteError.message);

    // Create the colors
    const colorsToInsert = palette.colors.map((color, index) => ({
      palette_id: createdPalette.id,
      hex_code: color.hex,
      rgb_r: color.rgb.r,
      rgb_g: color.rgb.g,
      rgb_b: color.rgb.b,
      hsl_h: color.hsl.h,
      hsl_s: color.hsl.s,
      hsl_l: color.hsl.l,
      position: color.position ?? index,
      name: color.name || null,
    }));

    const { error: colorsError } = await supabase
      .from('palette_colors')
      .insert(colorsToInsert);

    if (colorsError) throw new Error(colorsError.message);

    // Add tags if provided
    if (palette.tagIds && palette.tagIds.length > 0) {
      await tagsService.addTagsToPalette(createdPalette.id, palette.tagIds);
    }

    // Fetch the complete palette
    const result = await this.getPalette(createdPalette.id);
    if (!result) throw new Error('Failed to fetch created palette');
    return result;
  },

  /**
   * Update an existing palette
   */
  async updatePalette(id: string, updates: PaletteUpdate): Promise<Palette> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership
    const { data: existing } = await supabase
      .from('palettes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Access denied');
    }

    // Update palette metadata
    const paletteUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) paletteUpdates.name = updates.name;
    if (updates.description !== undefined) paletteUpdates.description = updates.description;
    if (updates.isPublic !== undefined) paletteUpdates.is_public = updates.isPublic;

    if (Object.keys(paletteUpdates).length > 0) {
      const { error } = await supabase
        .from('palettes')
        .update(paletteUpdates)
        .eq('id', id);

      if (error) throw new Error(error.message);
    }

    // Update colors if provided
    if (updates.colors) {
      // Delete existing colors
      await supabase.from('palette_colors').delete().eq('palette_id', id);

      // Insert new colors
      const colorsToInsert = updates.colors.map((color, index) => ({
        palette_id: id,
        hex_code: color.hex,
        rgb_r: color.rgb.r,
        rgb_g: color.rgb.g,
        rgb_b: color.rgb.b,
        hsl_h: color.hsl.h,
        hsl_s: color.hsl.s,
        hsl_l: color.hsl.l,
        position: color.position ?? index,
        name: color.name || null,
      }));

      const { error } = await supabase.from('palette_colors').insert(colorsToInsert);
      if (error) throw new Error(error.message);
    }

    // Update tags if provided
    if (updates.tagIds !== undefined) {
      await tagsService.updatePaletteTags(id, updates.tagIds);
    }

    const result = await this.getPalette(id);
    if (!result) throw new Error('Failed to fetch updated palette');
    return result;
  },

  /**
   * Delete a palette
   */
  async deletePalette(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership
    const { data: existing } = await supabase
      .from('palettes')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Access denied');
    }

    const { error } = await supabase
      .from('palettes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  },

  /**
   * Like a palette
   */
  async likePalette(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('likes')
      .insert({ user_id: user.id, palette_id: id });

    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  },

  /**
   * Unlike a palette
   */
  async unlikePalette(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    await supabase
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('palette_id', id);
  },

  /**
   * Check if the current user has liked a palette
   */
  async isLiked(paletteId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('palette_id', paletteId)
      .single();

    return !!data;
  },

  /**
   * Get popular tags
   */
  async getTags(): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return (data || []).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category as Tag['category'],
      usageCount: t.usage_count,
    }));
  },
};
