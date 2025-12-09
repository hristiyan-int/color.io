import { supabase } from './supabase';
import type { Tag, TagCategory, FeedPalette, PaletteColor } from '@/types';

interface DbTag {
  id: string;
  name: string;
  category: string | null;
  usage_count: number;
  created_at: string;
}

interface DbPalette {
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
  palette_colors: {
    id: string;
    hex_code: string;
    rgb_r: number;
    rgb_g: number;
    rgb_b: number;
    hsl_h: number;
    hsl_s: number;
    hsl_l: number;
    position: number;
    name: string | null;
  }[];
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

function mapDbToTag(db: DbTag): Tag {
  return {
    id: db.id,
    name: db.name,
    category: db.category as TagCategory | undefined,
    usageCount: db.usage_count,
  };
}

function mapDbToFeedPalette(db: DbPalette, isLiked: boolean): FeedPalette {
  const colors: PaletteColor[] = (db.palette_colors || [])
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      hex: c.hex_code,
      rgb: { r: c.rgb_r, g: c.rgb_g, b: c.rgb_b },
      hsl: { h: c.hsl_h, s: c.hsl_s, l: c.hsl_l },
      position: c.position,
      name: c.name || undefined,
    }));

  return {
    id: db.id,
    userId: db.user_id,
    name: db.name,
    description: db.description || undefined,
    colors,
    sourceImageUrl: db.source_image_url || undefined,
    thumbnailUrl: db.thumbnail_url || undefined,
    isPublic: db.is_public,
    likesCount: db.likes_count,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    user: {
      id: db.profiles.id,
      username: db.profiles.username,
      displayName: db.profiles.display_name || undefined,
      avatarUrl: db.profiles.avatar_url || undefined,
    },
    isLiked,
    commentsCount: 0,
  };
}

export const tagsService = {
  /**
   * Get all tags, optionally filtered by category
   */
  async getTags(category?: TagCategory, limit: number = 50): Promise<Tag[]> {
    let query = supabase
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(mapDbToTag);
  },

  /**
   * Get popular tags (top by usage count)
   */
  async getPopularTags(limit: number = 20): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(mapDbToTag);
  },

  /**
   * Get tags grouped by category
   */
  async getTagsByCategory(): Promise<Record<TagCategory, Tag[]>> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false });

    if (error) throw new Error(error.message);

    const grouped: Record<TagCategory, Tag[]> = {
      mood: [],
      style: [],
      season: [],
      purpose: [],
    };

    (data || []).forEach((t: DbTag) => {
      const tag = mapDbToTag(t);
      if (tag.category && grouped[tag.category]) {
        grouped[tag.category].push(tag);
      }
    });

    return grouped;
  },

  /**
   * Search tags by name
   */
  async searchTags(query: string, limit: number = 20): Promise<Tag[]> {
    if (!query.trim()) return [];

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query.trim()}%`)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data || []).map(mapDbToTag);
  },

  /**
   * Get or create a tag by name
   */
  async getOrCreateTag(name: string, category?: TagCategory): Promise<Tag> {
    const normalizedName = name.toLowerCase().trim();

    // Try to find existing tag
    const { data: existing } = await supabase
      .from('tags')
      .select('*')
      .eq('name', normalizedName)
      .single();

    if (existing) {
      return mapDbToTag(existing);
    }

    // Create new tag
    const { data: created, error } = await supabase
      .from('tags')
      .insert({ name: normalizedName, category: category || null })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapDbToTag(created);
  },

  /**
   * Add tags to a palette
   */
  async addTagsToPalette(paletteId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    const inserts = tagIds.map((tagId) => ({
      palette_id: paletteId,
      tag_id: tagId,
    }));

    const { error } = await supabase.from('palette_tags').insert(inserts);

    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  },

  /**
   * Remove all tags from a palette
   */
  async removeTagsFromPalette(paletteId: string): Promise<void> {
    const { error } = await supabase
      .from('palette_tags')
      .delete()
      .eq('palette_id', paletteId);

    if (error) throw new Error(error.message);
  },

  /**
   * Update tags for a palette (replace all)
   */
  async updatePaletteTags(paletteId: string, tagIds: string[]): Promise<void> {
    await this.removeTagsFromPalette(paletteId);
    await this.addTagsToPalette(paletteId, tagIds);
  },

  /**
   * Get tags for a palette
   */
  async getPaletteTags(paletteId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('palette_tags')
      .select('tags (*)')
      .eq('palette_id', paletteId);

    if (error) throw new Error(error.message);

    return (data || [])
      .map((pt: { tags: DbTag | DbTag[] | null }) => {
        const tag = Array.isArray(pt.tags) ? pt.tags[0] : pt.tags;
        return tag ? mapDbToTag(tag) : null;
      })
      .filter((t): t is Tag => t !== null);
  },

  /**
   * Get palettes by tag name
   */
  async getPalettesByTag(
    tagName: string,
    cursor?: string,
    limit: number = 20
  ): Promise<{ palettes: FeedPalette[]; nextCursor?: string; hasMore: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();

    // First get the tag
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('name', tagName.toLowerCase())
      .single();

    if (!tag) {
      return { palettes: [], hasMore: false };
    }

    // Get palette IDs with this tag
    const { data: paletteTags } = await supabase
      .from('palette_tags')
      .select('palette_id')
      .eq('tag_id', tag.id);

    const paletteIds = paletteTags?.map((pt) => pt.palette_id) || [];

    if (paletteIds.length === 0) {
      return { palettes: [], hasMore: false };
    }

    // Get palettes
    let query = supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .in('id', paletteIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const hasMore = (data || []).length > limit;
    const palettes = hasMore ? data!.slice(0, limit) : (data || []);

    // Get like status
    let likedPaletteIds: string[] = [];
    if (user && palettes.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('palette_id')
        .eq('user_id', user.id)
        .in('palette_id', palettes.map((p: DbPalette) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    const feedPalettes = palettes.map((p: DbPalette) =>
      mapDbToFeedPalette(p, likedPaletteIds.includes(p.id))
    );

    return {
      palettes: feedPalettes,
      nextCursor: palettes.length > 0 ? palettes[palettes.length - 1].created_at : undefined,
      hasMore,
    };
  },
};
