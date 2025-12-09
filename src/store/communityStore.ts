import { create } from 'zustand';
import { communityService } from '@/services/community';
import type { FeedPalette, FeedType, Comment, Profile } from '@/types';

interface CommunityState {
  // Feed state
  feedPalettes: FeedPalette[];
  feedType: FeedType;
  feedCursor: string | undefined;
  hasMoreFeed: boolean;
  isLoadingFeed: boolean;
  isRefreshing: boolean;

  // Search state
  searchQuery: string;
  searchResults: FeedPalette[];
  isSearching: boolean;

  // Comments state
  comments: Record<string, Comment[]>; // paletteId -> comments
  isLoadingComments: Record<string, boolean>;

  // Viewed profile state
  viewedProfile: (Profile & { stats: { palettesCount: number; followersCount: number; followingCount: number }; isFollowing: boolean }) | null;
  viewedProfilePalettes: FeedPalette[];
  isLoadingProfile: boolean;

  // Actions - Feed
  setFeedType: (type: FeedType) => void;
  fetchFeed: (refresh?: boolean) => Promise<void>;
  loadMoreFeed: () => Promise<void>;
  refreshFeed: () => Promise<void>;

  // Actions - Search
  setSearchQuery: (query: string) => void;
  searchPalettes: (query: string, tag?: string) => Promise<void>;
  clearSearch: () => void;

  // Actions - Likes
  likePalette: (paletteId: string) => Promise<void>;
  unlikePalette: (paletteId: string) => Promise<void>;
  toggleLike: (paletteId: string) => Promise<void>;

  // Actions - Comments
  fetchComments: (paletteId: string) => Promise<void>;
  addComment: (paletteId: string, content: string) => Promise<Comment>;
  deleteComment: (paletteId: string, commentId: string) => Promise<void>;

  // Actions - Profile
  fetchUserProfile: (username: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  unfollowUser: (userId: string) => Promise<void>;
  clearViewedProfile: () => void;

  // Actions - Reset
  reset: () => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  // Initial state
  feedPalettes: [],
  feedType: 'trending',
  feedCursor: undefined,
  hasMoreFeed: true,
  isLoadingFeed: false,
  isRefreshing: false,

  searchQuery: '',
  searchResults: [],
  isSearching: false,

  comments: {},
  isLoadingComments: {},

  viewedProfile: null,
  viewedProfilePalettes: [],
  isLoadingProfile: false,

  // Feed actions
  setFeedType: (type) => {
    set({ feedType: type, feedPalettes: [], feedCursor: undefined, hasMoreFeed: true });
    get().fetchFeed();
  },

  fetchFeed: async (refresh = false) => {
    const { feedType, isLoadingFeed, isRefreshing } = get();
    if (isLoadingFeed || isRefreshing) return;

    try {
      set(refresh ? { isRefreshing: true } : { isLoadingFeed: true });

      const response = await communityService.getFeed(feedType, undefined, 20);

      set({
        feedPalettes: response.palettes,
        feedCursor: response.nextCursor,
        hasMoreFeed: response.hasMore,
      });
    } catch (error) {
      console.error('Failed to fetch feed:', error);
    } finally {
      set({ isLoadingFeed: false, isRefreshing: false });
    }
  },

  loadMoreFeed: async () => {
    const { feedType, feedCursor, hasMoreFeed, isLoadingFeed, feedPalettes } = get();
    if (isLoadingFeed || !hasMoreFeed || !feedCursor) return;

    try {
      set({ isLoadingFeed: true });

      const response = await communityService.getFeed(feedType, feedCursor, 20);

      set({
        feedPalettes: [...feedPalettes, ...response.palettes],
        feedCursor: response.nextCursor,
        hasMoreFeed: response.hasMore,
      });
    } catch (error) {
      console.error('Failed to load more feed:', error);
    } finally {
      set({ isLoadingFeed: false });
    }
  },

  refreshFeed: async () => {
    set({ feedCursor: undefined, hasMoreFeed: true });
    await get().fetchFeed(true);
  },

  // Search actions
  setSearchQuery: (query) => set({ searchQuery: query }),

  searchPalettes: async (query, tag) => {
    try {
      set({ isSearching: true, searchQuery: query });
      const results = await communityService.searchPalettes(query, tag);
      set({ searchResults: results });
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchQuery: '', searchResults: [], isSearching: false }),

  // Like actions
  likePalette: async (paletteId) => {
    try {
      // Optimistic update
      set((state) => ({
        feedPalettes: state.feedPalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
        searchResults: state.searchResults.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
        viewedProfilePalettes: state.viewedProfilePalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
      }));

      await communityService.likePalette(paletteId);
    } catch (error) {
      // Revert on failure
      set((state) => ({
        feedPalettes: state.feedPalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: p.likesCount - 1 } : p
        ),
        searchResults: state.searchResults.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: p.likesCount - 1 } : p
        ),
        viewedProfilePalettes: state.viewedProfilePalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: p.likesCount - 1 } : p
        ),
      }));
      throw error;
    }
  },

  unlikePalette: async (paletteId) => {
    try {
      // Optimistic update
      set((state) => ({
        feedPalettes: state.feedPalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: Math.max(0, p.likesCount - 1) } : p
        ),
        searchResults: state.searchResults.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: Math.max(0, p.likesCount - 1) } : p
        ),
        viewedProfilePalettes: state.viewedProfilePalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: false, likesCount: Math.max(0, p.likesCount - 1) } : p
        ),
      }));

      await communityService.unlikePalette(paletteId);
    } catch (error) {
      // Revert on failure
      set((state) => ({
        feedPalettes: state.feedPalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
        searchResults: state.searchResults.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
        viewedProfilePalettes: state.viewedProfilePalettes.map((p) =>
          p.id === paletteId ? { ...p, isLiked: true, likesCount: p.likesCount + 1 } : p
        ),
      }));
      throw error;
    }
  },

  toggleLike: async (paletteId) => {
    const { feedPalettes, searchResults, viewedProfilePalettes } = get();
    const palette =
      feedPalettes.find((p) => p.id === paletteId) ||
      searchResults.find((p) => p.id === paletteId) ||
      viewedProfilePalettes.find((p) => p.id === paletteId);

    if (!palette) return;

    if (palette.isLiked) {
      await get().unlikePalette(paletteId);
    } else {
      await get().likePalette(paletteId);
    }
  },

  // Comment actions
  fetchComments: async (paletteId) => {
    try {
      set((state) => ({
        isLoadingComments: { ...state.isLoadingComments, [paletteId]: true },
      }));

      const comments = await communityService.getComments(paletteId);

      set((state) => ({
        comments: { ...state.comments, [paletteId]: comments },
        isLoadingComments: { ...state.isLoadingComments, [paletteId]: false },
      }));
    } catch (error) {
      set((state) => ({
        isLoadingComments: { ...state.isLoadingComments, [paletteId]: false },
      }));
      throw error;
    }
  },

  addComment: async (paletteId, content) => {
    const comment = await communityService.addComment(paletteId, content);

    set((state) => ({
      comments: {
        ...state.comments,
        [paletteId]: [comment, ...(state.comments[paletteId] || [])],
      },
      feedPalettes: state.feedPalettes.map((p) =>
        p.id === paletteId ? { ...p, commentsCount: p.commentsCount + 1 } : p
      ),
    }));

    return comment;
  },

  deleteComment: async (paletteId, commentId) => {
    await communityService.deleteComment(commentId);

    set((state) => ({
      comments: {
        ...state.comments,
        [paletteId]: (state.comments[paletteId] || []).filter((c) => c.id !== commentId),
      },
      feedPalettes: state.feedPalettes.map((p) =>
        p.id === paletteId ? { ...p, commentsCount: Math.max(0, p.commentsCount - 1) } : p
      ),
    }));
  },

  // Profile actions
  fetchUserProfile: async (username) => {
    try {
      set({ isLoadingProfile: true, viewedProfile: null, viewedProfilePalettes: [] });

      const profile = await communityService.getUserProfile(username);
      const palettes = await communityService.getUserPalettes(profile.id);

      set({
        viewedProfile: profile,
        viewedProfilePalettes: palettes,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  followUser: async (userId) => {
    try {
      // Optimistic update
      set((state) => ({
        viewedProfile: state.viewedProfile
          ? {
              ...state.viewedProfile,
              isFollowing: true,
              stats: {
                ...state.viewedProfile.stats,
                followersCount: state.viewedProfile.stats.followersCount + 1,
              },
            }
          : null,
      }));

      await communityService.followUser(userId);
    } catch (error) {
      // Revert on failure
      set((state) => ({
        viewedProfile: state.viewedProfile
          ? {
              ...state.viewedProfile,
              isFollowing: false,
              stats: {
                ...state.viewedProfile.stats,
                followersCount: Math.max(0, state.viewedProfile.stats.followersCount - 1),
              },
            }
          : null,
      }));
      throw error;
    }
  },

  unfollowUser: async (userId) => {
    try {
      // Optimistic update
      set((state) => ({
        viewedProfile: state.viewedProfile
          ? {
              ...state.viewedProfile,
              isFollowing: false,
              stats: {
                ...state.viewedProfile.stats,
                followersCount: Math.max(0, state.viewedProfile.stats.followersCount - 1),
              },
            }
          : null,
      }));

      await communityService.unfollowUser(userId);
    } catch (error) {
      // Revert on failure
      set((state) => ({
        viewedProfile: state.viewedProfile
          ? {
              ...state.viewedProfile,
              isFollowing: true,
              stats: {
                ...state.viewedProfile.stats,
                followersCount: state.viewedProfile.stats.followersCount + 1,
              },
            }
          : null,
      }));
      throw error;
    }
  },

  clearViewedProfile: () => set({ viewedProfile: null, viewedProfilePalettes: [] }),

  // Reset
  reset: () => {
    set({
      feedPalettes: [],
      feedType: 'trending',
      feedCursor: undefined,
      hasMoreFeed: true,
      isLoadingFeed: false,
      isRefreshing: false,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      comments: {},
      isLoadingComments: {},
      viewedProfile: null,
      viewedProfilePalettes: [],
      isLoadingProfile: false,
    });
  },
}));
