import request from 'supertest';
import express from 'express';
import { Router } from 'express';
import { z } from 'zod';

// Mock data store
let profiles: any[] = [];
let follows: any[] = [];
let palettes: any[] = [];
let idCounter = 1;

const mockUser = { id: 'user-1', email: 'test@example.com' };
const mockUser2 = { id: 'user-2', email: 'test2@example.com' };

beforeEach(() => {
  profiles = [
    { id: mockUser.id, username: 'testuser', display_name: 'Test User', bio: 'Hello', avatar_url: null, created_at: new Date().toISOString() },
    { id: mockUser2.id, username: 'testuser2', display_name: 'Test User 2', bio: 'Hi', avatar_url: null, created_at: new Date().toISOString() },
  ];
  follows = [];
  palettes = [];
  idCounter = 1;
});

// Mock auth middleware
function mockAuth(userId: string) {
  return (req: any, _res: any, next: any) => {
    req.user = { id: userId, email: `${userId}@test.com` };
    next();
  };
}

function mockOptionalAuth(req: any, _res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer user-1-token') {
    req.user = mockUser;
  } else if (authHeader === 'Bearer user-2-token') {
    req.user = mockUser2;
  }
  next();
}

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

function createProfilesRouter(authMiddleware: any) {
  const router = Router();

  // GET /profiles/me
  router.get('/me', authMiddleware, (req: any, res) => {
    const profile = profiles.find(p => p.id === req.user.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const palettesCount = palettes.filter(p => p.user_id === req.user.id).length;
    const followersCount = follows.filter(f => f.following_id === req.user.id).length;
    const followingCount = follows.filter(f => f.follower_id === req.user.id).length;

    res.json({
      data: {
        ...profile,
        stats: {
          palettes_count: palettesCount,
          followers_count: followersCount,
          following_count: followingCount,
        },
      },
    });
  });

  // PATCH /profiles/me
  router.patch('/me', authMiddleware, (req: any, res) => {
    try {
      const validated = updateProfileSchema.parse(req.body);
      const profile = profiles.find(p => p.id === req.user.id);
      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      Object.assign(profile, validated);
      res.json({ data: profile });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // GET /profiles/:username
  router.get('/:username', mockOptionalAuth, (req: any, res) => {
    const profile = profiles.find(p => p.username === req.params.username);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const palettesCount = palettes.filter(p => p.user_id === profile.id && p.is_public).length;
    const followersCount = follows.filter(f => f.following_id === profile.id).length;
    const followingCount = follows.filter(f => f.follower_id === profile.id).length;
    const isFollowing = req.user ? follows.some(f => f.follower_id === req.user.id && f.following_id === profile.id) : false;

    res.json({
      data: {
        ...profile,
        stats: {
          palettes_count: palettesCount,
          followers_count: followersCount,
          following_count: followingCount,
        },
        is_following: isFollowing,
      },
    });
  });

  // POST /profiles/:id/follow
  router.post('/:id/follow', authMiddleware, (req: any, res) => {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetProfile = profiles.find(p => p.id === id);
    if (!targetProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existingFollow = follows.find(f => f.follower_id === req.user.id && f.following_id === id);
    if (existingFollow) {
      return res.json({ message: 'Already following' });
    }

    follows.push({ follower_id: req.user.id, following_id: id, created_at: new Date().toISOString() });
    res.json({ message: 'Following' });
  });

  // DELETE /profiles/:id/follow
  router.delete('/:id/follow', authMiddleware, (req: any, res) => {
    const { id } = req.params;
    const followIndex = follows.findIndex(f => f.follower_id === req.user.id && f.following_id === id);
    if (followIndex !== -1) {
      follows.splice(followIndex, 1);
    }
    res.json({ message: 'Unfollowed' });
  });

  // GET /profiles/:id/followers
  router.get('/:id/followers', (_req: any, res) => {
    const { id } = _req.params;
    const followerIds = follows.filter(f => f.following_id === id).map(f => f.follower_id);
    const followers = profiles.filter(p => followerIds.includes(p.id));
    res.json({ data: followers });
  });

  // GET /profiles/:id/following
  router.get('/:id/following', (_req: any, res) => {
    const { id } = _req.params;
    const followingIds = follows.filter(f => f.follower_id === id).map(f => f.following_id);
    const following = profiles.filter(p => followingIds.includes(p.id));
    res.json({ data: following });
  });

  return router;
}

// Test apps for different users
const app1 = express();
app1.use(express.json());
app1.use('/api/profiles', createProfilesRouter(mockAuth(mockUser.id)));

const app2 = express();
app2.use(express.json());
app2.use('/api/profiles', createProfilesRouter(mockAuth(mockUser2.id)));

describe('Profiles API', () => {
  describe('GET /api/profiles/me', () => {
    it('should return current user profile', async () => {
      const response = await request(app1).get('/api/profiles/me');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('username', 'testuser');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('palettes_count');
      expect(response.body.data.stats).toHaveProperty('followers_count');
      expect(response.body.data.stats).toHaveProperty('following_count');
    });

    it('should include correct stats', async () => {
      // Add some data
      palettes.push({ id: 'p1', user_id: mockUser.id, is_public: true });
      palettes.push({ id: 'p2', user_id: mockUser.id, is_public: false });
      follows.push({ follower_id: mockUser2.id, following_id: mockUser.id });

      const response = await request(app1).get('/api/profiles/me');

      expect(response.body.data.stats.palettes_count).toBe(2);
      expect(response.body.data.stats.followers_count).toBe(1);
    });
  });

  describe('PATCH /api/profiles/me', () => {
    it('should update display name', async () => {
      const response = await request(app1)
        .patch('/api/profiles/me')
        .send({ display_name: 'New Display Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.display_name).toBe('New Display Name');
    });

    it('should update bio', async () => {
      const response = await request(app1)
        .patch('/api/profiles/me')
        .send({ bio: 'My new bio' });

      expect(response.status).toBe(200);
      expect(response.body.data.bio).toBe('My new bio');
    });

    it('should reject bio over 500 characters', async () => {
      const response = await request(app1)
        .patch('/api/profiles/me')
        .send({ bio: 'A'.repeat(501) });

      expect(response.status).toBe(400);
    });

    it('should reject invalid avatar URL', async () => {
      const response = await request(app1)
        .patch('/api/profiles/me')
        .send({ avatar_url: 'not-a-url' });

      expect(response.status).toBe(400);
    });

    it('should accept valid avatar URL', async () => {
      const response = await request(app1)
        .patch('/api/profiles/me')
        .send({ avatar_url: 'https://example.com/avatar.png' });

      expect(response.status).toBe(200);
      expect(response.body.data.avatar_url).toBe('https://example.com/avatar.png');
    });
  });

  describe('GET /api/profiles/:username', () => {
    it('should return profile by username', async () => {
      const response = await request(app1).get('/api/profiles/testuser2');

      expect(response.status).toBe(200);
      expect(response.body.data.username).toBe('testuser2');
    });

    it('should return 404 for non-existent username', async () => {
      const response = await request(app1).get('/api/profiles/nonexistent');

      expect(response.status).toBe(404);
    });

    it('should only count public palettes for other users', async () => {
      palettes.push({ id: 'p1', user_id: mockUser2.id, is_public: true });
      palettes.push({ id: 'p2', user_id: mockUser2.id, is_public: false });

      const response = await request(app1).get('/api/profiles/testuser2');

      expect(response.body.data.stats.palettes_count).toBe(1); // Only public
    });
  });

  describe('POST /api/profiles/:id/follow', () => {
    it('should follow a user', async () => {
      const response = await request(app1).post(`/api/profiles/${mockUser2.id}/follow`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Following');
      expect(follows).toHaveLength(1);
    });

    it('should not allow following yourself', async () => {
      const response = await request(app1).post(`/api/profiles/${mockUser.id}/follow`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot follow yourself');
    });

    it('should return already following for duplicate follow', async () => {
      await request(app1).post(`/api/profiles/${mockUser2.id}/follow`);
      const response = await request(app1).post(`/api/profiles/${mockUser2.id}/follow`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Already following');
    });
  });

  describe('DELETE /api/profiles/:id/follow', () => {
    it('should unfollow a user', async () => {
      await request(app1).post(`/api/profiles/${mockUser2.id}/follow`);
      const response = await request(app1).delete(`/api/profiles/${mockUser2.id}/follow`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Unfollowed');
      expect(follows).toHaveLength(0);
    });

    it('should succeed even if not following', async () => {
      const response = await request(app1).delete(`/api/profiles/${mockUser2.id}/follow`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/profiles/:id/followers', () => {
    it('should return followers list', async () => {
      follows.push({ follower_id: mockUser.id, following_id: mockUser2.id });

      const response = await request(app1).get(`/api/profiles/${mockUser2.id}/followers`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].username).toBe('testuser');
    });

    it('should return empty array when no followers', async () => {
      const response = await request(app1).get(`/api/profiles/${mockUser.id}/followers`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /api/profiles/:id/following', () => {
    it('should return following list', async () => {
      follows.push({ follower_id: mockUser.id, following_id: mockUser2.id });

      const response = await request(app1).get(`/api/profiles/${mockUser.id}/following`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].username).toBe('testuser2');
    });
  });
});
