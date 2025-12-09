import request from 'supertest';
import express from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { errorHandler, AppError } from '../../src/middleware/errorHandler.js';

// Mock authentication middleware
const mockUser = { id: 'test-user-123', email: 'test@example.com' };
const mockUser2 = { id: 'test-user-456', email: 'test2@example.com' };

// In-memory store for testing
let palettes: any[] = [];
let paletteColors: any[] = [];
let likes: any[] = [];
let comments: any[] = [];
let idCounter = 1;

// Reset store between tests
beforeEach(() => {
  palettes = [];
  paletteColors = [];
  likes = [];
  comments = [];
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
  if (authHeader === 'Bearer valid-token-1') {
    req.user = mockUser;
  } else if (authHeader === 'Bearer valid-token-2') {
    req.user = mockUser2;
  }
  next();
}

// Validation schemas (same as in the actual route)
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

// Create test router with mocked database
function createPalettesRouter(authMiddleware: any) {
  const router = Router();

  // GET /palettes - Get user's palettes
  router.get('/', authMiddleware, (req: any, res) => {
    const userPalettes = palettes.filter(p => p.user_id === req.user.id);
    const enriched = userPalettes.map(p => ({
      ...p,
      palette_colors: paletteColors.filter(c => c.palette_id === p.id),
    }));
    res.json({ data: enriched });
  });

  // GET /palettes/:id - Get single palette
  router.get('/:id', mockOptionalAuth, (req: any, res) => {
    const palette = palettes.find(p => p.id === req.params.id);
    if (!palette) {
      return res.status(404).json({ error: 'Palette not found' });
    }
    if (!palette.is_public && palette.user_id !== req.user?.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({
      data: {
        ...palette,
        palette_colors: paletteColors.filter(c => c.palette_id === palette.id),
      },
    });
  });

  // POST /palettes - Create palette
  router.post('/', authMiddleware, (req: any, res) => {
    try {
      const validated = createPaletteSchema.parse(req.body);
      const { colors, tags, ...paletteData } = validated;

      const palette = {
        id: `palette-${idCounter++}`,
        ...paletteData,
        user_id: req.user.id,
        likes_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      palettes.push(palette);

      const newColors = colors.map((c, i) => ({
        id: `color-${idCounter++}`,
        palette_id: palette.id,
        ...c,
      }));
      paletteColors.push(...newColors);

      res.status(201).json({
        data: { ...palette, palette_colors: newColors },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // PATCH /palettes/:id - Update palette
  router.patch('/:id', authMiddleware, (req: any, res) => {
    const palette = palettes.find(p => p.id === req.params.id);
    if (!palette) {
      return res.status(404).json({ error: 'Palette not found' });
    }
    if (palette.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, is_public } = req.body;
    if (name) palette.name = name;
    if (description !== undefined) palette.description = description;
    if (is_public !== undefined) palette.is_public = is_public;
    palette.updated_at = new Date().toISOString();

    res.json({ data: palette });
  });

  // DELETE /palettes/:id - Delete palette
  router.delete('/:id', authMiddleware, (req: any, res) => {
    const paletteIndex = palettes.findIndex(p => p.id === req.params.id);
    if (paletteIndex === -1) {
      return res.status(404).json({ error: 'Palette not found' });
    }
    if (palettes[paletteIndex].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const paletteId = palettes[paletteIndex].id;
    palettes.splice(paletteIndex, 1);
    paletteColors = paletteColors.filter(c => c.palette_id !== paletteId);

    res.json({ message: 'Palette deleted' });
  });

  // POST /palettes/:id/like - Like palette
  router.post('/:id/like', authMiddleware, (req: any, res) => {
    const palette = palettes.find(p => p.id === req.params.id);
    if (!palette) {
      return res.status(404).json({ error: 'Palette not found' });
    }

    const existingLike = likes.find(l => l.user_id === req.user.id && l.palette_id === req.params.id);
    if (existingLike) {
      return res.json({ message: 'Already liked' });
    }

    likes.push({ user_id: req.user.id, palette_id: req.params.id });
    palette.likes_count++;
    res.json({ message: 'Liked' });
  });

  // DELETE /palettes/:id/like - Unlike palette
  router.delete('/:id/like', authMiddleware, (req: any, res) => {
    const palette = palettes.find(p => p.id === req.params.id);
    if (palette) {
      const likeIndex = likes.findIndex(l => l.user_id === req.user.id && l.palette_id === req.params.id);
      if (likeIndex !== -1) {
        likes.splice(likeIndex, 1);
        palette.likes_count--;
      }
    }
    res.json({ message: 'Unliked' });
  });

  // GET /palettes/:id/comments - Get comments
  router.get('/:id/comments', (_req: any, res) => {
    const paletteComments = comments.filter(c => c.palette_id === _req.params.id);
    res.json({ data: paletteComments });
  });

  // POST /palettes/:id/comments - Add comment
  router.post('/:id/comments', authMiddleware, (req: any, res) => {
    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.length > 500) {
      return res.status(400).json({ error: 'Invalid comment content' });
    }

    const comment = {
      id: `comment-${idCounter++}`,
      user_id: req.user.id,
      palette_id: req.params.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
    };
    comments.push(comment);
    res.status(201).json({ data: comment });
  });

  // DELETE /palettes/:id/comments/:commentId - Delete comment
  router.delete('/:id/comments/:commentId', authMiddleware, (req: any, res) => {
    const commentIndex = comments.findIndex(c => c.id === req.params.commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comments[commentIndex].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    comments.splice(commentIndex, 1);
    res.json({ message: 'Comment deleted' });
  });

  return router;
}

// Create test app
const app = express();
app.use(express.json());
app.use('/api/palettes', createPalettesRouter(mockAuth(mockUser.id)));
app.use(errorHandler);

// Valid test data
const validColors = [
  { hex_code: '#FF6B6B', rgb_r: 255, rgb_g: 107, rgb_b: 107, hsl_h: 0, hsl_s: 100, hsl_l: 71, position: 0 },
  { hex_code: '#4ECDC4', rgb_r: 78, rgb_g: 205, rgb_b: 196, hsl_h: 174, hsl_s: 58, hsl_l: 55, position: 1 },
  { hex_code: '#45B7D1', rgb_r: 69, rgb_g: 183, rgb_b: 209, hsl_h: 191, hsl_s: 59, hsl_l: 55, position: 2 },
];

describe('Palettes API', () => {
  describe('POST /api/palettes', () => {
    it('should create a new palette', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'My Test Palette',
          description: 'A beautiful palette',
          colors: validColors,
          is_public: false,
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('My Test Palette');
      expect(response.body.data.palette_colors).toHaveLength(3);
    });

    it('should reject palette with less than 3 colors', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'Invalid Palette',
          colors: validColors.slice(0, 2), // Only 2 colors
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject palette with more than 8 colors', async () => {
      const tooManyColors = Array(9).fill(validColors[0]).map((c, i) => ({ ...c, position: i }));
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'Too Many Colors',
          colors: tooManyColors,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should reject palette with invalid hex code', async () => {
      const invalidColors = [...validColors];
      invalidColors[0] = { ...invalidColors[0], hex_code: 'invalid' };

      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'Invalid Hex',
          colors: invalidColors,
        });

      expect(response.status).toBe(400);
    });

    it('should reject palette with name too long', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'A'.repeat(101), // 101 characters
          colors: validColors,
        });

      expect(response.status).toBe(400);
    });

    it('should reject palette without name', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          colors: validColors,
        });

      expect(response.status).toBe(400);
    });

    it('should accept palette with optional tags', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'Tagged Palette',
          colors: validColors,
          tags: ['vibrant', 'modern'],
        });

      expect(response.status).toBe(201);
    });

    it('should reject palette with more than 5 tags', async () => {
      const response = await request(app)
        .post('/api/palettes')
        .send({
          name: 'Too Many Tags',
          colors: validColors,
          tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/palettes', () => {
    it('should return empty array when user has no palettes', async () => {
      const response = await request(app).get('/api/palettes');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return user palettes', async () => {
      // Create a palette first
      await request(app)
        .post('/api/palettes')
        .send({ name: 'Palette 1', colors: validColors });

      await request(app)
        .post('/api/palettes')
        .send({ name: 'Palette 2', colors: validColors });

      const response = await request(app).get('/api/palettes');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/palettes/:id', () => {
    it('should return 404 for non-existent palette', async () => {
      const response = await request(app).get('/api/palettes/non-existent-id');

      expect(response.status).toBe(404);
    });

    it('should return public palette', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Public Palette', colors: validColors, is_public: true });

      const paletteId = createRes.body.data.id;
      const response = await request(app).get(`/api/palettes/${paletteId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Public Palette');
    });
  });

  describe('PATCH /api/palettes/:id', () => {
    it('should update palette name', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Original Name', colors: validColors });

      const paletteId = createRes.body.data.id;
      const response = await request(app)
        .patch(`/api/palettes/${paletteId}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update palette visibility', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Private Palette', colors: validColors, is_public: false });

      const paletteId = createRes.body.data.id;
      const response = await request(app)
        .patch(`/api/palettes/${paletteId}`)
        .send({ is_public: true });

      expect(response.status).toBe(200);
      expect(response.body.data.is_public).toBe(true);
    });

    it('should return 404 for non-existent palette', async () => {
      const response = await request(app)
        .patch('/api/palettes/non-existent')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/palettes/:id', () => {
    it('should delete palette', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'To Delete', colors: validColors });

      const paletteId = createRes.body.data.id;
      const deleteRes = await request(app).delete(`/api/palettes/${paletteId}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe('Palette deleted');

      // Verify it's deleted
      const getRes = await request(app).get(`/api/palettes/${paletteId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent palette', async () => {
      const response = await request(app).delete('/api/palettes/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/palettes/:id/like', () => {
    it('should like a palette', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Likeable', colors: validColors, is_public: true });

      const paletteId = createRes.body.data.id;
      const response = await request(app).post(`/api/palettes/${paletteId}/like`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Liked');
    });

    it('should return already liked message', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Double Like', colors: validColors });

      const paletteId = createRes.body.data.id;

      await request(app).post(`/api/palettes/${paletteId}/like`);
      const response = await request(app).post(`/api/palettes/${paletteId}/like`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Already liked');
    });
  });

  describe('DELETE /api/palettes/:id/like', () => {
    it('should unlike a palette', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Unlikeable', colors: validColors });

      const paletteId = createRes.body.data.id;

      await request(app).post(`/api/palettes/${paletteId}/like`);
      const response = await request(app).delete(`/api/palettes/${paletteId}/like`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Unliked');
    });
  });

  describe('Comments', () => {
    it('should add a comment', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Commentable', colors: validColors });

      const paletteId = createRes.body.data.id;
      const response = await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: 'Great palette!' });

      expect(response.status).toBe(201);
      expect(response.body.data.content).toBe('Great palette!');
    });

    it('should reject empty comment', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Commentable', colors: validColors });

      const paletteId = createRes.body.data.id;
      const response = await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: '' });

      expect(response.status).toBe(400);
    });

    it('should reject comment over 500 characters', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Commentable', colors: validColors });

      const paletteId = createRes.body.data.id;
      const response = await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: 'A'.repeat(501) });

      expect(response.status).toBe(400);
    });

    it('should get comments', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'With Comments', colors: validColors });

      const paletteId = createRes.body.data.id;

      await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: 'Comment 1' });
      await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: 'Comment 2' });

      const response = await request(app).get(`/api/palettes/${paletteId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
    });

    it('should delete own comment', async () => {
      const createRes = await request(app)
        .post('/api/palettes')
        .send({ name: 'Deletable Comment', colors: validColors });

      const paletteId = createRes.body.data.id;
      const commentRes = await request(app)
        .post(`/api/palettes/${paletteId}/comments`)
        .send({ content: 'To delete' });

      const commentId = commentRes.body.data.id;
      const response = await request(app).delete(`/api/palettes/${paletteId}/comments/${commentId}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Comment deleted');
    });
  });
});
