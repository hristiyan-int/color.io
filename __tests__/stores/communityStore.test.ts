import { act } from '@testing-library/react-native';
import { useCommunityStore } from '../../src/store/communityStore';
import { communityService } from '../../src/services/community';
import type { FeedPalette, Comment, Profile } from '../../src/types';

// Mock the community service
jest.mock('../../src/services/community', () => ({
  communityService: {
    getFeed: jest.fn(),
    searchPalettes: jest.fn(),
    likePalette: jest.fn(),
    unlikePalette: jest.fn(),
    getComments: jest.fn(),
    addComment: jest.fn(),
    deleteComment: jest.fn(),
    getUserProfile: jest.fn(),
    getUserPalettes: jest.fn(),
    followUser: jest.fn(),
    unfollowUser: jest.fn(),
  },
}));

const mockCommunityService = communityService as jest.Mocked<typeof communityService>;

// Mock data
const mockFeedPalette: FeedPalette = {
  id: 'palette-1',
  userId: 'user-1',
  name: 'Test Palette',
  colors: [
    { id: 'c1', hex: '#FF6B6B', rgb: { r: 255, g: 107, b: 107 }, hsl: { h: 0, s: 100, l: 71 }, position: 0 },
  ],
  isPublic: true,
  likesCount: 10,
  commentsCount: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isLiked: false,
  user: {
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  },
};

const mockComment: Comment = {
  id: 'comment-1',
  paletteId: 'palette-1',
  userId: 'user-2',
  content: 'Nice palette!',
  createdAt: new Date().toISOString(),
  user: {
    id: 'user-2',
    username: 'commenter',
    displayName: 'Commenter',
    avatarUrl: null,
  },
};

const mockProfile = {
  id: 'user-1',
  username: 'testuser',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  createdAt: new Date().toISOString(),
  stats: {
    palettesCount: 10,
    followersCount: 100,
    followingCount: 50,
  },
  isFollowing: false,
};

// Helper to reset store between tests
const resetStore = () => {
  act(() => {
    useCommunityStore.getState().reset();
  });
};

describe('Community Store', () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useCommunityStore.getState();

      expect(state.feedPalettes).toEqual([]);
      expect(state.feedType).toBe('trending');
      expect(state.feedCursor).toBeUndefined();
      expect(state.hasMoreFeed).toBe(true);
      expect(state.isLoadingFeed).toBe(false);
      expect(state.isRefreshing).toBe(false);
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.isSearching).toBe(false);
      expect(state.comments).toEqual({});
      expect(state.isLoadingComments).toEqual({});
      expect(state.viewedProfile).toBeNull();
      expect(state.viewedProfilePalettes).toEqual([]);
      expect(state.isLoadingProfile).toBe(false);
    });
  });

  describe('Feed Actions', () => {
    describe('setFeedType', () => {
      it('should change feed type and trigger fetch', async () => {
        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [mockFeedPalette],
          nextCursor: 'cursor-1',
          hasMore: true,
        });

        await act(async () => {
          useCommunityStore.getState().setFeedType('recent');
        });

        expect(useCommunityStore.getState().feedType).toBe('recent');
        expect(mockCommunityService.getFeed).toHaveBeenCalledWith('recent', undefined, 20);
      });

      it('should reset feed state when changing type', async () => {
        // Set initial state with palettes
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [mockFeedPalette],
            feedCursor: 'old-cursor',
            hasMoreFeed: false,
          });
        });

        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [],
          nextCursor: undefined,
          hasMore: false,
        });

        await act(async () => {
          useCommunityStore.getState().setFeedType('following');
        });

        const state = useCommunityStore.getState();
        expect(state.feedCursor).toBeUndefined();
        expect(state.hasMoreFeed).toBe(false);
      });
    });

    describe('fetchFeed', () => {
      it('should fetch feed successfully', async () => {
        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [mockFeedPalette],
          nextCursor: 'cursor-1',
          hasMore: true,
        });

        await act(async () => {
          await useCommunityStore.getState().fetchFeed();
        });

        const state = useCommunityStore.getState();
        expect(state.feedPalettes).toHaveLength(1);
        expect(state.feedCursor).toBe('cursor-1');
        expect(state.hasMoreFeed).toBe(true);
        expect(state.isLoadingFeed).toBe(false);
      });

      it('should not fetch when already loading', async () => {
        act(() => {
          useCommunityStore.setState({ isLoadingFeed: true });
        });

        await act(async () => {
          await useCommunityStore.getState().fetchFeed();
        });

        expect(mockCommunityService.getFeed).not.toHaveBeenCalled();
      });

      it('should not fetch when refreshing', async () => {
        act(() => {
          useCommunityStore.setState({ isRefreshing: true });
        });

        await act(async () => {
          await useCommunityStore.getState().fetchFeed();
        });

        expect(mockCommunityService.getFeed).not.toHaveBeenCalled();
      });

      it('should handle fetch error gracefully', async () => {
        mockCommunityService.getFeed.mockRejectedValue(new Error('Network error'));

        await act(async () => {
          await useCommunityStore.getState().fetchFeed();
        });

        expect(useCommunityStore.getState().isLoadingFeed).toBe(false);
      });

      it('should set isRefreshing when refresh is true', async () => {
        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [],
          nextCursor: undefined,
          hasMore: false,
        });

        const fetchPromise = useCommunityStore.getState().fetchFeed(true);

        expect(useCommunityStore.getState().isRefreshing).toBe(true);

        await act(async () => {
          await fetchPromise;
        });

        expect(useCommunityStore.getState().isRefreshing).toBe(false);
      });
    });

    describe('loadMoreFeed', () => {
      it('should load more palettes', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [mockFeedPalette],
            feedCursor: 'cursor-1',
            hasMoreFeed: true,
          });
        });

        const newPalette = { ...mockFeedPalette, id: 'palette-2' };
        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [newPalette],
          nextCursor: 'cursor-2',
          hasMore: true,
        });

        await act(async () => {
          await useCommunityStore.getState().loadMoreFeed();
        });

        const state = useCommunityStore.getState();
        expect(state.feedPalettes).toHaveLength(2);
        expect(state.feedCursor).toBe('cursor-2');
      });

      it('should not load more when no cursor', async () => {
        act(() => {
          useCommunityStore.setState({
            feedCursor: undefined,
            hasMoreFeed: true,
          });
        });

        await act(async () => {
          await useCommunityStore.getState().loadMoreFeed();
        });

        expect(mockCommunityService.getFeed).not.toHaveBeenCalled();
      });

      it('should not load more when hasMoreFeed is false', async () => {
        act(() => {
          useCommunityStore.setState({
            feedCursor: 'cursor-1',
            hasMoreFeed: false,
          });
        });

        await act(async () => {
          await useCommunityStore.getState().loadMoreFeed();
        });

        expect(mockCommunityService.getFeed).not.toHaveBeenCalled();
      });

      it('should not load more when already loading', async () => {
        act(() => {
          useCommunityStore.setState({
            feedCursor: 'cursor-1',
            hasMoreFeed: true,
            isLoadingFeed: true,
          });
        });

        await act(async () => {
          await useCommunityStore.getState().loadMoreFeed();
        });

        expect(mockCommunityService.getFeed).not.toHaveBeenCalled();
      });
    });

    describe('refreshFeed', () => {
      it('should refresh feed', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [mockFeedPalette],
            feedCursor: 'old-cursor',
          });
        });

        mockCommunityService.getFeed.mockResolvedValue({
          palettes: [{ ...mockFeedPalette, id: 'refreshed-palette' }],
          nextCursor: 'new-cursor',
          hasMore: true,
        });

        await act(async () => {
          await useCommunityStore.getState().refreshFeed();
        });

        const state = useCommunityStore.getState();
        expect(state.feedPalettes[0].id).toBe('refreshed-palette');
      });
    });
  });

  describe('Search Actions', () => {
    describe('setSearchQuery', () => {
      it('should set search query', () => {
        act(() => {
          useCommunityStore.getState().setSearchQuery('sunset colors');
        });

        expect(useCommunityStore.getState().searchQuery).toBe('sunset colors');
      });
    });

    describe('searchPalettes', () => {
      it('should search palettes successfully', async () => {
        mockCommunityService.searchPalettes.mockResolvedValue([mockFeedPalette]);

        await act(async () => {
          await useCommunityStore.getState().searchPalettes('sunset');
        });

        const state = useCommunityStore.getState();
        expect(state.searchResults).toHaveLength(1);
        expect(state.searchQuery).toBe('sunset');
        expect(state.isSearching).toBe(false);
      });

      it('should search with tag', async () => {
        mockCommunityService.searchPalettes.mockResolvedValue([]);

        await act(async () => {
          await useCommunityStore.getState().searchPalettes('', 'nature');
        });

        expect(mockCommunityService.searchPalettes).toHaveBeenCalledWith('', 'nature');
      });

      it('should handle search error gracefully', async () => {
        mockCommunityService.searchPalettes.mockRejectedValue(new Error('Search failed'));

        await act(async () => {
          await useCommunityStore.getState().searchPalettes('test');
        });

        expect(useCommunityStore.getState().isSearching).toBe(false);
      });
    });

    describe('clearSearch', () => {
      it('should clear search state', () => {
        act(() => {
          useCommunityStore.setState({
            searchQuery: 'test',
            searchResults: [mockFeedPalette],
            isSearching: true,
          });
        });

        act(() => {
          useCommunityStore.getState().clearSearch();
        });

        const state = useCommunityStore.getState();
        expect(state.searchQuery).toBe('');
        expect(state.searchResults).toEqual([]);
        expect(state.isSearching).toBe(false);
      });
    });
  });

  describe('Like Actions', () => {
    beforeEach(() => {
      act(() => {
        useCommunityStore.setState({
          feedPalettes: [{ ...mockFeedPalette, isLiked: false, likesCount: 10 }],
        });
      });
    });

    describe('likePalette', () => {
      it('should like palette with optimistic update', async () => {
        mockCommunityService.likePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().likePalette('palette-1');
        });

        const palette = useCommunityStore.getState().feedPalettes[0];
        expect(palette.isLiked).toBe(true);
        expect(palette.likesCount).toBe(11);
      });

      it('should revert on like error', async () => {
        mockCommunityService.likePalette.mockRejectedValue(new Error('Like failed'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().likePalette('palette-1');
          })
        ).rejects.toThrow('Like failed');

        const palette = useCommunityStore.getState().feedPalettes[0];
        expect(palette.isLiked).toBe(false);
        expect(palette.likesCount).toBe(10);
      });

      it('should update in search results too', async () => {
        act(() => {
          useCommunityStore.setState({
            searchResults: [{ ...mockFeedPalette, isLiked: false, likesCount: 10 }],
          });
        });

        mockCommunityService.likePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().likePalette('palette-1');
        });

        const searchPalette = useCommunityStore.getState().searchResults[0];
        expect(searchPalette.isLiked).toBe(true);
      });
    });

    describe('unlikePalette', () => {
      beforeEach(() => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, isLiked: true, likesCount: 10 }],
          });
        });
      });

      it('should unlike palette with optimistic update', async () => {
        mockCommunityService.unlikePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().unlikePalette('palette-1');
        });

        const palette = useCommunityStore.getState().feedPalettes[0];
        expect(palette.isLiked).toBe(false);
        expect(palette.likesCount).toBe(9);
      });

      it('should not go below 0 likes', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, isLiked: true, likesCount: 0 }],
          });
        });

        mockCommunityService.unlikePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().unlikePalette('palette-1');
        });

        expect(useCommunityStore.getState().feedPalettes[0].likesCount).toBe(0);
      });

      it('should revert on unlike error', async () => {
        mockCommunityService.unlikePalette.mockRejectedValue(new Error('Unlike failed'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().unlikePalette('palette-1');
          })
        ).rejects.toThrow('Unlike failed');

        const palette = useCommunityStore.getState().feedPalettes[0];
        expect(palette.isLiked).toBe(true);
        expect(palette.likesCount).toBe(10);
      });
    });

    describe('toggleLike', () => {
      it('should like when not liked', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, isLiked: false }],
          });
        });

        mockCommunityService.likePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().toggleLike('palette-1');
        });

        expect(mockCommunityService.likePalette).toHaveBeenCalledWith('palette-1');
      });

      it('should unlike when liked', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, isLiked: true }],
          });
        });

        mockCommunityService.unlikePalette.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().toggleLike('palette-1');
        });

        expect(mockCommunityService.unlikePalette).toHaveBeenCalledWith('palette-1');
      });

      it('should do nothing for non-existent palette', async () => {
        await act(async () => {
          await useCommunityStore.getState().toggleLike('non-existent');
        });

        expect(mockCommunityService.likePalette).not.toHaveBeenCalled();
        expect(mockCommunityService.unlikePalette).not.toHaveBeenCalled();
      });
    });
  });

  describe('Comment Actions', () => {
    describe('fetchComments', () => {
      it('should fetch comments successfully', async () => {
        mockCommunityService.getComments.mockResolvedValue([mockComment]);

        await act(async () => {
          await useCommunityStore.getState().fetchComments('palette-1');
        });

        const state = useCommunityStore.getState();
        expect(state.comments['palette-1']).toHaveLength(1);
        expect(state.isLoadingComments['palette-1']).toBe(false);
      });

      it('should handle fetch comments error', async () => {
        mockCommunityService.getComments.mockRejectedValue(new Error('Failed'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().fetchComments('palette-1');
          })
        ).rejects.toThrow('Failed');

        expect(useCommunityStore.getState().isLoadingComments['palette-1']).toBe(false);
      });
    });

    describe('addComment', () => {
      it('should add comment and increment count', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, commentsCount: 5 }],
            comments: { 'palette-1': [] },
          });
        });

        mockCommunityService.addComment.mockResolvedValue(mockComment);

        await act(async () => {
          await useCommunityStore.getState().addComment('palette-1', 'Great palette!');
        });

        const state = useCommunityStore.getState();
        expect(state.comments['palette-1']).toHaveLength(1);
        expect(state.feedPalettes[0].commentsCount).toBe(6);
      });
    });

    describe('deleteComment', () => {
      it('should delete comment and decrement count', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, commentsCount: 5 }],
            comments: { 'palette-1': [mockComment] },
          });
        });

        mockCommunityService.deleteComment.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().deleteComment('palette-1', 'comment-1');
        });

        const state = useCommunityStore.getState();
        expect(state.comments['palette-1']).toHaveLength(0);
        expect(state.feedPalettes[0].commentsCount).toBe(4);
      });

      it('should not go below 0 comments', async () => {
        act(() => {
          useCommunityStore.setState({
            feedPalettes: [{ ...mockFeedPalette, commentsCount: 0 }],
            comments: { 'palette-1': [mockComment] },
          });
        });

        mockCommunityService.deleteComment.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().deleteComment('palette-1', 'comment-1');
        });

        expect(useCommunityStore.getState().feedPalettes[0].commentsCount).toBe(0);
      });
    });
  });

  describe('Profile Actions', () => {
    describe('fetchUserProfile', () => {
      it('should fetch user profile and palettes', async () => {
        mockCommunityService.getUserProfile.mockResolvedValue(mockProfile);
        mockCommunityService.getUserPalettes.mockResolvedValue([mockFeedPalette]);

        await act(async () => {
          await useCommunityStore.getState().fetchUserProfile('testuser');
        });

        const state = useCommunityStore.getState();
        expect(state.viewedProfile).toEqual(mockProfile);
        expect(state.viewedProfilePalettes).toHaveLength(1);
        expect(state.isLoadingProfile).toBe(false);
      });

      it('should handle fetch profile error', async () => {
        mockCommunityService.getUserProfile.mockRejectedValue(new Error('User not found'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().fetchUserProfile('unknown');
          })
        ).rejects.toThrow('User not found');

        expect(useCommunityStore.getState().isLoadingProfile).toBe(false);
      });

      it('should clear previous profile on new fetch', async () => {
        act(() => {
          useCommunityStore.setState({
            viewedProfile: mockProfile,
            viewedProfilePalettes: [mockFeedPalette],
          });
        });

        mockCommunityService.getUserProfile.mockResolvedValue({ ...mockProfile, username: 'newuser' });
        mockCommunityService.getUserPalettes.mockResolvedValue([]);

        await act(async () => {
          await useCommunityStore.getState().fetchUserProfile('newuser');
        });

        expect(useCommunityStore.getState().viewedProfile?.username).toBe('newuser');
      });
    });

    describe('followUser', () => {
      beforeEach(() => {
        act(() => {
          useCommunityStore.setState({ viewedProfile: mockProfile });
        });
      });

      it('should follow user with optimistic update', async () => {
        mockCommunityService.followUser.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().followUser('user-1');
        });

        const profile = useCommunityStore.getState().viewedProfile;
        expect(profile?.isFollowing).toBe(true);
        expect(profile?.stats.followersCount).toBe(101);
      });

      it('should revert on follow error', async () => {
        mockCommunityService.followUser.mockRejectedValue(new Error('Follow failed'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().followUser('user-1');
          })
        ).rejects.toThrow('Follow failed');

        const profile = useCommunityStore.getState().viewedProfile;
        expect(profile?.isFollowing).toBe(false);
        expect(profile?.stats.followersCount).toBe(100);
      });
    });

    describe('unfollowUser', () => {
      beforeEach(() => {
        act(() => {
          useCommunityStore.setState({
            viewedProfile: { ...mockProfile, isFollowing: true },
          });
        });
      });

      it('should unfollow user with optimistic update', async () => {
        mockCommunityService.unfollowUser.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().unfollowUser('user-1');
        });

        const profile = useCommunityStore.getState().viewedProfile;
        expect(profile?.isFollowing).toBe(false);
        expect(profile?.stats.followersCount).toBe(99);
      });

      it('should not go below 0 followers', async () => {
        act(() => {
          useCommunityStore.setState({
            viewedProfile: { ...mockProfile, isFollowing: true, stats: { ...mockProfile.stats, followersCount: 0 } },
          });
        });

        mockCommunityService.unfollowUser.mockResolvedValue(undefined);

        await act(async () => {
          await useCommunityStore.getState().unfollowUser('user-1');
        });

        expect(useCommunityStore.getState().viewedProfile?.stats.followersCount).toBe(0);
      });

      it('should revert on unfollow error', async () => {
        mockCommunityService.unfollowUser.mockRejectedValue(new Error('Unfollow failed'));

        await expect(
          act(async () => {
            await useCommunityStore.getState().unfollowUser('user-1');
          })
        ).rejects.toThrow('Unfollow failed');

        const profile = useCommunityStore.getState().viewedProfile;
        expect(profile?.isFollowing).toBe(true);
        expect(profile?.stats.followersCount).toBe(100);
      });
    });

    describe('clearViewedProfile', () => {
      it('should clear viewed profile', () => {
        act(() => {
          useCommunityStore.setState({
            viewedProfile: mockProfile,
            viewedProfilePalettes: [mockFeedPalette],
          });
        });

        act(() => {
          useCommunityStore.getState().clearViewedProfile();
        });

        const state = useCommunityStore.getState();
        expect(state.viewedProfile).toBeNull();
        expect(state.viewedProfilePalettes).toEqual([]);
      });
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      act(() => {
        useCommunityStore.setState({
          feedPalettes: [mockFeedPalette],
          feedType: 'recent',
          feedCursor: 'cursor-1',
          hasMoreFeed: false,
          searchQuery: 'test',
          searchResults: [mockFeedPalette],
          comments: { 'palette-1': [mockComment] },
          viewedProfile: mockProfile,
          viewedProfilePalettes: [mockFeedPalette],
        });
      });

      act(() => {
        useCommunityStore.getState().reset();
      });

      const state = useCommunityStore.getState();
      expect(state.feedPalettes).toEqual([]);
      expect(state.feedType).toBe('trending');
      expect(state.feedCursor).toBeUndefined();
      expect(state.hasMoreFeed).toBe(true);
      expect(state.searchQuery).toBe('');
      expect(state.searchResults).toEqual([]);
      expect(state.comments).toEqual({});
      expect(state.viewedProfile).toBeNull();
      expect(state.viewedProfilePalettes).toEqual([]);
    });
  });
});
