import { supabase } from './supabase';
import type {
  FeedPalette,
  FeedType,
  FeedResponse,
  Comment,
  Profile,
  Palette,
  PaletteColor
} from '@/types';

// Database types for mapping
interface DbFeedPalette {
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
  palette_tags?: { tags: { id: string; name: string; category: string | null } }[];
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface DbComment {
  id: string;
  user_id: string;
  palette_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface DbProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

function mapDbToFeedPalette(db: DbFeedPalette, isLiked: boolean, commentsCount: number): FeedPalette {
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
    commentsCount,
  };
}

function mapDbToComment(db: DbComment): Comment {
  return {
    id: db.id,
    userId: db.user_id,
    paletteId: db.palette_id,
    content: db.content,
    createdAt: db.created_at,
    user: {
      username: db.profiles.username,
      displayName: db.profiles.display_name || undefined,
      avatarUrl: db.profiles.avatar_url || undefined,
    },
  };
}

function mapDbToProfile(db: DbProfile): Profile {
  return {
    id: db.id,
    username: db.username,
    displayName: db.display_name || undefined,
    avatarUrl: db.avatar_url || undefined,
    bio: db.bio || undefined,
    createdAt: db.created_at,
  };
}

export const communityService = {
  /**
   * Get community feed
   */
  async getFeed(type: FeedType, cursor?: string, limit: number = 20): Promise<FeedResponse> {
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        palette_tags (
          tags (id, name, category)
        ),
        profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('is_public', true)
      .limit(limit + 1);

    // Apply cursor for pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    // Apply ordering based on type
    if (type === 'trending') {
      query = query.order('likes_count', { ascending: false });
    } else if (type === 'following' && user) {
      // Get followed users first
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followedIds = following?.map((f) => f.following_id) || [];
      if (followedIds.length === 0) {
        return { palettes: [], hasMore: false };
      }
      query = query.in('user_id', followedIds);
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const hasMore = (data || []).length > limit;
    const palettes = hasMore ? data!.slice(0, limit) : (data || []);

    // Get like status for authenticated user
    let likedPaletteIds: string[] = [];
    if (user && palettes.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('palette_id')
        .eq('user_id', user.id)
        .in('palette_id', palettes.map((p: DbFeedPalette) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    // Get comment counts
    const paletteIds = palettes.map((p: DbFeedPalette) => p.id);
    const { data: comments } = await supabase
      .from('comments')
      .select('palette_id')
      .in('palette_id', paletteIds);

    const commentCountMap = (comments || []).reduce((acc: Record<string, number>, c) => {
      acc[c.palette_id] = (acc[c.palette_id] || 0) + 1;
      return acc;
    }, {});

    const feedPalettes = palettes.map((p: DbFeedPalette) =>
      mapDbToFeedPalette(p, likedPaletteIds.includes(p.id), commentCountMap[p.id] || 0)
    );

    return {
      palettes: feedPalettes,
      nextCursor: palettes.length > 0 ? palettes[palettes.length - 1].created_at : undefined,
      hasMore,
    };
  },

  /**
   * Search palettes
   */
  async searchPalettes(query: string, tag?: string, limit: number = 20): Promise<FeedPalette[]> {
    const { data: { user } } = await supabase.auth.getUser();

    // Check if query is a HEX color
    const hexMatch = query.match(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
    if (hexMatch) {
      return this.searchPalettesByColor(query, limit);
    }

    let dbQuery = supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('is_public', true)
      .limit(limit);

    if (query) {
      // Also search in username
      dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (tag) {
      const { data: taggedPalettes } = await supabase
        .from('palette_tags')
        .select('palette_id, tags!inner(name)')
        .eq('tags.name', tag.toLowerCase());

      const paletteIds = taggedPalettes?.map((p) => p.palette_id) || [];
      if (paletteIds.length === 0) return [];
      dbQuery = dbQuery.in('id', paletteIds);
    }

    dbQuery = dbQuery.order('likes_count', { ascending: false });

    const { data, error } = await dbQuery;

    if (error) throw new Error(error.message);

    // Get like status
    let likedPaletteIds: string[] = [];
    if (user && data && data.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('palette_id')
        .eq('user_id', user.id)
        .in('palette_id', data.map((p: DbFeedPalette) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    return (data || []).map((p: DbFeedPalette) =>
      mapDbToFeedPalette(p, likedPaletteIds.includes(p.id), 0)
    );
  },

  /**
   * Search palettes by color (HEX)
   * Finds palettes containing similar colors using color distance
   */
  async searchPalettesByColor(hexColor: string, limit: number = 20): Promise<FeedPalette[]> {
    const { data: { user } } = await supabase.auth.getUser();

    // Normalize HEX
    let hex = hexColor.replace('#', '').toUpperCase();
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    hex = `#${hex}`;

    // Convert to RGB for distance calculation
    const targetR = parseInt(hex.slice(1, 3), 16);
    const targetG = parseInt(hex.slice(3, 5), 16);
    const targetB = parseInt(hex.slice(5, 7), 16);

    // Get all palette colors (we'll filter by color distance)
    const { data: colorsData, error: colorsError } = await supabase
      .from('palette_colors')
      .select('palette_id, hex_code, rgb_r, rgb_g, rgb_b');

    if (colorsError) throw new Error(colorsError.message);

    // Calculate color distance and find matching palettes
    const matchingPaletteIds = new Map<string, number>();

    for (const color of colorsData || []) {
      const distance = Math.sqrt(
        Math.pow(color.rgb_r - targetR, 2) +
        Math.pow(color.rgb_g - targetG, 2) +
        Math.pow(color.rgb_b - targetB, 2)
      );

      // Threshold: 50 is a reasonable color distance for "similar" colors
      if (distance < 50) {
        const existing = matchingPaletteIds.get(color.palette_id) || Infinity;
        matchingPaletteIds.set(color.palette_id, Math.min(existing, distance));
      }
    }

    if (matchingPaletteIds.size === 0) {
      return [];
    }

    // Sort by color distance and take top matches
    const sortedIds = Array.from(matchingPaletteIds.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([id]) => id);

    // Fetch the palettes
    const { data, error } = await supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .in('id', sortedIds)
      .eq('is_public', true);

    if (error) throw new Error(error.message);

    // Get like status
    let likedPaletteIds: string[] = [];
    if (user && data && data.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('palette_id')
        .eq('user_id', user.id)
        .in('palette_id', data.map((p: DbFeedPalette) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    // Sort results by color distance
    const palettes = (data || []).map((p: DbFeedPalette) =>
      mapDbToFeedPalette(p, likedPaletteIds.includes(p.id), 0)
    );

    // Re-sort by the distance we calculated
    return palettes.sort((a, b) => {
      const distA = matchingPaletteIds.get(a.id) || Infinity;
      const distB = matchingPaletteIds.get(b.id) || Infinity;
      return distA - distB;
    });
  },

  /**
   * Like a palette
   */
  async likePalette(paletteId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('likes')
      .insert({ user_id: user.id, palette_id: paletteId });

    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }

    // Increment likes_count
    await supabase.rpc('increment_likes_count', { palette_id: paletteId });
  },

  /**
   * Unlike a palette
   */
  async unlikePalette(paletteId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('palette_id', paletteId);

    if (error) throw new Error(error.message);

    // Decrement likes_count
    await supabase.rpc('decrement_likes_count', { palette_id: paletteId });
  },

  /**
   * Get comments for a palette
   */
  async getComments(paletteId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles!comments_user_id_fkey (username, display_name, avatar_url)
      `)
      .eq('palette_id', paletteId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(mapDbToComment);
  },

  /**
   * Add a comment to a palette
   */
  async addComment(paletteId: string, content: string): Promise<Comment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (!content.trim() || content.length > 500) {
      throw new Error('Invalid comment content');
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        palette_id: paletteId,
        content: content.trim(),
      })
      .select(`
        *,
        profiles!comments_user_id_fkey (username, display_name, avatar_url)
      `)
      .single();

    if (error) throw new Error(error.message);

    return mapDbToComment(data);
  },

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Verify ownership
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (!comment || comment.user_id !== user.id) {
      throw new Error('Access denied');
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw new Error(error.message);
  },

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (userId === user.id) {
      throw new Error('Cannot follow yourself');
    }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: userId });

    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  },

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', userId);

    if (error) throw new Error(error.message);
  },

  /**
   * Check if current user follows a user
   */
  async isFollowing(userId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();

    return !!data;
  },

  /**
   * Get user profile by username
   */
  async getUserProfile(username: string): Promise<Profile & { stats: { palettesCount: number; followersCount: number; followingCount: number }; isFollowing: boolean }> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) throw new Error('User not found');

    // Get stats
    const [palettesResult, followersResult, followingResult] = await Promise.all([
      supabase
        .from('palettes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', data.id)
        .eq('is_public', true),
      supabase
        .from('follows')
        .select('follower_id', { count: 'exact', head: true })
        .eq('following_id', data.id),
      supabase
        .from('follows')
        .select('following_id', { count: 'exact', head: true })
        .eq('follower_id', data.id),
    ]);

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUser && currentUser.id !== data.id) {
      const { data: followData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', data.id)
        .single();
      isFollowing = !!followData;
    }

    return {
      ...mapDbToProfile(data),
      stats: {
        palettesCount: palettesResult.count || 0,
        followersCount: followersResult.count || 0,
        followingCount: followingResult.count || 0,
      },
      isFollowing,
    };
  },

  /**
   * Get user's public palettes
   */
  async getUserPalettes(userId: string): Promise<FeedPalette[]> {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('palettes')
      .select(`
        *,
        palette_colors (*),
        profiles!palettes_user_id_fkey (id, username, display_name, avatar_url)
      `)
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Get like status
    let likedPaletteIds: string[] = [];
    if (currentUser && data && data.length > 0) {
      const { data: likes } = await supabase
        .from('likes')
        .select('palette_id')
        .eq('user_id', currentUser.id)
        .in('palette_id', data.map((p: DbFeedPalette) => p.id));
      likedPaletteIds = likes?.map((l) => l.palette_id) || [];
    }

    return (data || []).map((p: DbFeedPalette) =>
      mapDbToFeedPalette(p, likedPaletteIds.includes(p.id), 0)
    );
  },

  /**
   * Get followers list
   */
  async getFollowers(userId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        profiles!follows_follower_id_fkey (id, username, display_name, avatar_url, bio, created_at)
      `)
      .eq('following_id', userId);

    if (error) throw new Error(error.message);

    return (data || [])
      .map((f: { profiles: DbProfile | DbProfile[] | null }) => {
        const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return profile ? mapDbToProfile(profile) : null;
      })
      .filter((p): p is Profile => p !== null);
  },

  /**
   * Get following list
   */
  async getFollowing(userId: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        profiles!follows_following_id_fkey (id, username, display_name, avatar_url, bio, created_at)
      `)
      .eq('follower_id', userId);

    if (error) throw new Error(error.message);

    return (data || [])
      .map((f: { profiles: DbProfile | DbProfile[] | null }) => {
        const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return profile ? mapDbToProfile(profile) : null;
      })
      .filter((p): p is Profile => p !== null);
  },
};
