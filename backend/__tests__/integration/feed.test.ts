import request from 'supertest';
import express from 'express';
import { Router } from 'express';

// Mock data store
let palettes: any[] = [];
let follows: any[] = [];
let likes: any[] = [];
let comments: any[] = [];

const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUser2 = { id: 'user-2', email: 'test2@example.com' };

beforeEach(() => {
  palettes = [];
  follows = [];
  likes = [];
  comments = [];
});

// Mock profiles
const profiles = [
  { id: mockUser.id, username: 'testuser', display_name: 'Test User', avatar_url: null },
  { id: mockUser2.id, username: 'testuser2', display_name: 'Test User 2', avatar_url: null },
];

function mockOptionalAuth(req: any, _res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer user-1-token') {
    req.user = mockUser;
  } else if (authHeader === 'Bearer user-2-token') {
    req.user = mockUser2;
  }
  next();
}

function mockAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer user-1-token') {
    req.user = mockUser;
    next();
  } else if (authHeader === 'Bearer user-2-token') {
    req.user = mockUser2;
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

function createFeedRouter() {
  const router = Router();

  // GET /feed
  router.get('/', mockOptionalAuth, (req: any, res) => {
    const { type = 'trending', cursor, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    let feedPalettes = palettes.filter(p => p.is_public);

    // Filter by type
    if (type === 'following') {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required for following feed' });
      }
      const followedIds = follows.filter(f => f.follower_id === req.user.id).map(f => f.following_id);
      if (followedIds.length === 0) {
        return res.json({ data: [], hasMore: false });
      }
      feedPalettes = feedPalettes.filter(p => followedIds.includes(p.user_id));
    }

    // Apply ordering
    if (type === 'trending') {
      feedPalettes.sort((a, b) => b.likes_count - a.likes_count);
    } else {
      feedPalettes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Apply cursor pagination
    if (cursor) {
      const cursorIndex = feedPalettes.findIndex(p => p.created_at === cursor);
      if (cursorIndex !== -1) {
        feedPalettes = feedPalettes.slice(cursorIndex + 1);
      }
    }

    // Check for more
    const hasMore = feedPalettes.length > limitNum;
    feedPalettes = feedPalettes.slice(0, limitNum);

    // Get like status
    const likedIds = req.user
      ? likes.filter(l => l.user_id === req.user.id).map(l => l.palette_id)
      : [];

    // Get comment counts
    const commentCounts: Record<string, number> = {};
    comments.forEach(c => {
      commentCounts[c.palette_id] = (commentCounts[c.palette_id] || 0) + 1;
    });

    // Enrich with profile data
    const enrichedPalettes = feedPalettes.map(p => ({
      ...p,
      profiles: profiles.find(pr => pr.id === p.user_id),
      is_liked: likedIds.includes(p.id),
      comments_count: commentCounts[p.id] || 0,
    }));

    res.json({
      data: enrichedPalettes,
      cursor: feedPalettes.length > 0 ? feedPalettes[feedPalettes.length - 1].created_at : null,
      hasMore,
    });
  });

  // GET /feed/search
  router.get('/search', mockOptionalAuth, (req: any, res) => {
    const { q, tag, limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    if (!q && !tag) {
      return res.status(400).json({ error: 'Search query or tag required' });
    }

    let searchPalettes = palettes.filter(p => p.is_public);

    // Search by name/description
    if (q) {
      const query = (q as string).toLowerCase();
      searchPalettes = searchPalettes.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Filter by tag (simplified - in real app would use palette_tags table)
    if (tag) {
      searchPalettes = searchPalettes.filter(p =>
        p.tags && p.tags.includes((tag as string).toLowerCase())
      );
    }

    // Sort by likes
    searchPalettes.sort((a, b) => b.likes_count - a.likes_count);

    // Apply limit
    searchPalettes = searchPalettes.slice(0, limitNum);

    res.json({ data: searchPalettes });
  });

  return router;
}

const app = express();
app.use(express.json());
app.use('/api/feed', createFeedRouter());

// Helper to create test palettes
function createPalette(overrides: any = {}) {
  const id = `palette-${palettes.length + 1}`;
  const palette = {
    id,
    user_id: mockUser.id,
    name: `Palette ${palettes.length + 1}`,
    description: 'Test palette',
    is_public: true,
    likes_count: 0,
    created_at: new Date(Date.now() - palettes.length * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
  palettes.push(palette);
  return palette;
}

describe('Feed API', () => {
  describe('GET /api/feed', () => {
    it('should return empty feed when no palettes', async () => {
      const response = await request(app).get('/api/feed');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.hasMore).toBe(false);
    });

    it('should return public palettes only', async () => {
      createPalette({ is_public: true, name: 'Public' });
      createPalette({ is_public: false, name: 'Private' });

      const response = await request(app).get('/api/feed');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Public');
    });

    it('should sort by likes for trending', async () => {
      createPalette({ name: 'Low Likes', likes_count: 5 });
      createPalette({ name: 'High Likes', likes_count: 100 });
      createPalette({ name: 'Medium Likes', likes_count: 50 });

      const response = await request(app).get('/api/feed?type=trending');

      expect(response.status).toBe(200);
      expect(response.body.data[0].name).toBe('High Likes');
      expect(response.body.data[1].name).toBe('Medium Likes');
      expect(response.body.data[2].name).toBe('Low Likes');
    });

    it('should sort by date for recent', async () => {
      const now = Date.now();
      createPalette({ name: 'Oldest', created_at: new Date(now - 3000).toISOString() });
      createPalette({ name: 'Newest', created_at: new Date(now).toISOString() });
      createPalette({ name: 'Middle', created_at: new Date(now - 1000).toISOString() });

      const response = await request(app).get('/api/feed?type=recent');

      expect(response.status).toBe(200);
      expect(response.body.data[0].name).toBe('Newest');
      expect(response.body.data[2].name).toBe('Oldest');
    });

    it('should require auth for following feed', async () => {
      const response = await request(app).get('/api/feed?type=following');

      expect(response.status).toBe(401);
    });

    it('should return following feed when authenticated', async () => {
      createPalette({ user_id: mockUser2.id, name: 'Followed User Palette' });
      createPalette({ user_id: 'other-user', name: 'Other User Palette' });
      follows.push({ follower_id: mockUser.id, following_id: mockUser2.id });

      const response = await request(app)
        .get('/api/feed?type=following')
        .set('Authorization', 'Bearer user-1-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Followed User Palette');
    });

    it('should return empty array when not following anyone', async () => {
      createPalette({ user_id: mockUser2.id });

      const response = await request(app)
        .get('/api/feed?type=following')
        .set('Authorization', 'Bearer user-1-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        createPalette({ name: `Palette ${i}` });
      }

      const response = await request(app).get('/api/feed?limit=5');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(5);
      expect(response.body.hasMore).toBe(true);
    });

    it('should cap limit at 50', async () => {
      for (let i = 0; i < 60; i++) {
        createPalette({ name: `Palette ${i}` });
      }

      const response = await request(app).get('/api/feed?limit=100');

      expect(response.body.data).toHaveLength(50);
    });

    it('should include is_liked status when authenticated', async () => {
      const palette = createPalette();
      likes.push({ user_id: mockUser.id, palette_id: palette.id });

      const response = await request(app)
        .get('/api/feed')
        .set('Authorization', 'Bearer user-1-token');

      expect(response.body.data[0].is_liked).toBe(true);
    });

    it('should include comment counts', async () => {
      const palette = createPalette();
      comments.push({ id: 'c1', palette_id: palette.id, content: 'Comment 1' });
      comments.push({ id: 'c2', palette_id: palette.id, content: 'Comment 2' });

      const response = await request(app).get('/api/feed');

      expect(response.body.data[0].comments_count).toBe(2);
    });

    it('should include profile data', async () => {
      createPalette({ user_id: mockUser.id });

      const response = await request(app).get('/api/feed');

      expect(response.body.data[0].profiles).toBeDefined();
      expect(response.body.data[0].profiles.username).toBe('testuser');
    });
  });

  describe('GET /api/feed/search', () => {
    it('should require search query or tag', async () => {
      const response = await request(app).get('/api/feed/search');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Search query or tag required');
    });

    it('should search by name', async () => {
      createPalette({ name: 'Sunset Colors' });
      createPalette({ name: 'Ocean Vibes' });
      createPalette({ name: 'Another Sunset' });

      const response = await request(app).get('/api/feed/search?q=sunset');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should search by description', async () => {
      createPalette({ name: 'Palette 1', description: 'Warm sunset tones' });
      createPalette({ name: 'Palette 2', description: 'Cool ocean hues' });

      const response = await request(app).get('/api/feed/search?q=sunset');

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Palette 1');
    });

    it('should be case insensitive', async () => {
      createPalette({ name: 'SUNSET PALETTE' });

      const response = await request(app).get('/api/feed/search?q=sunset');

      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by tag', async () => {
      createPalette({ name: 'Warm Palette', tags: ['warm', 'cozy'] });
      createPalette({ name: 'Cool Palette', tags: ['cool', 'modern'] });

      const response = await request(app).get('/api/feed/search?tag=warm');

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Warm Palette');
    });

    it('should only search public palettes', async () => {
      createPalette({ name: 'Public Sunset', is_public: true });
      createPalette({ name: 'Private Sunset', is_public: false });

      const response = await request(app).get('/api/feed/search?q=sunset');

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Public Sunset');
    });

    it('should sort results by likes', async () => {
      createPalette({ name: 'Sunset Low', likes_count: 5 });
      createPalette({ name: 'Sunset High', likes_count: 100 });

      const response = await request(app).get('/api/feed/search?q=sunset');

      expect(response.body.data[0].name).toBe('Sunset High');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        createPalette({ name: `Test Palette ${i}` });
      }

      const response = await request(app).get('/api/feed/search?q=test&limit=3');

      expect(response.body.data).toHaveLength(3);
    });
  });
});
