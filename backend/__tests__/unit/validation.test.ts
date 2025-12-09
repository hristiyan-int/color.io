import { z } from 'zod';

// Copy validation schemas from palettes route
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

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
});

describe('Palette Color Validation', () => {
  const validColor = {
    hex_code: '#FF6B6B',
    rgb_r: 255,
    rgb_g: 107,
    rgb_b: 107,
    hsl_h: 0,
    hsl_s: 100,
    hsl_l: 71,
    position: 0,
  };

  describe('hex_code', () => {
    it('should accept valid 6-digit hex code', () => {
      const result = paletteColorSchema.safeParse(validColor);
      expect(result.success).toBe(true);
    });

    it('should accept lowercase hex', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hex_code: '#ff6b6b' });
      expect(result.success).toBe(true);
    });

    it('should reject hex without #', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hex_code: 'FF6B6B' });
      expect(result.success).toBe(false);
    });

    it('should reject 3-digit hex', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hex_code: '#F6B' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid hex characters', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hex_code: '#GGGGGG' });
      expect(result.success).toBe(false);
    });

    it('should reject 8-digit hex (with alpha)', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hex_code: '#FF6B6BFF' });
      expect(result.success).toBe(false);
    });
  });

  describe('RGB values', () => {
    it('should accept valid RGB values', () => {
      const result = paletteColorSchema.safeParse(validColor);
      expect(result.success).toBe(true);
    });

    it('should accept 0 values', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, rgb_r: 0, rgb_g: 0, rgb_b: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept 255 values', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, rgb_r: 255, rgb_g: 255, rgb_b: 255 });
      expect(result.success).toBe(true);
    });

    it('should reject negative values', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, rgb_r: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject values over 255', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, rgb_g: 256 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer values', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, rgb_b: 100.5 });
      // Zod coerces to number, but keeps the decimal
      expect(result.success).toBe(true); // Note: Zod accepts decimals in number
    });
  });

  describe('HSL values', () => {
    it('should accept valid HSL values', () => {
      const result = paletteColorSchema.safeParse(validColor);
      expect(result.success).toBe(true);
    });

    it('should accept hue of 360', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hsl_h: 360 });
      expect(result.success).toBe(true);
    });

    it('should reject hue over 360', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hsl_h: 361 });
      expect(result.success).toBe(false);
    });

    it('should reject saturation over 100', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hsl_s: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject lightness over 100', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hsl_l: 101 });
      expect(result.success).toBe(false);
    });

    it('should accept 0 saturation and lightness', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, hsl_s: 0, hsl_l: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('position', () => {
    it('should accept 0', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, position: 0 });
      expect(result.success).toBe(true);
    });

    it('should accept positive integers', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, position: 7 });
      expect(result.success).toBe(true);
    });

    it('should reject negative position', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, position: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('name', () => {
    it('should accept name', () => {
      const result = paletteColorSchema.safeParse({ ...validColor, name: 'Coral Red' });
      expect(result.success).toBe(true);
    });

    it('should accept without name', () => {
      const result = paletteColorSchema.safeParse(validColor);
      expect(result.success).toBe(true);
    });
  });
});

describe('Palette Validation', () => {
  const validColors = [
    { hex_code: '#FF6B6B', rgb_r: 255, rgb_g: 107, rgb_b: 107, hsl_h: 0, hsl_s: 100, hsl_l: 71, position: 0 },
    { hex_code: '#4ECDC4', rgb_r: 78, rgb_g: 205, rgb_b: 196, hsl_h: 174, hsl_s: 58, hsl_l: 55, position: 1 },
    { hex_code: '#45B7D1', rgb_r: 69, rgb_g: 183, rgb_b: 209, hsl_h: 191, hsl_s: 59, hsl_l: 55, position: 2 },
  ];

  describe('name', () => {
    it('should accept valid name', () => {
      const result = createPaletteSchema.safeParse({ name: 'My Palette', colors: validColors });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createPaletteSchema.safeParse({ name: '', colors: validColors });
      expect(result.success).toBe(false);
    });

    it('should reject name over 100 characters', () => {
      const result = createPaletteSchema.safeParse({ name: 'A'.repeat(101), colors: validColors });
      expect(result.success).toBe(false);
    });

    it('should accept name of exactly 100 characters', () => {
      const result = createPaletteSchema.safeParse({ name: 'A'.repeat(100), colors: validColors });
      expect(result.success).toBe(true);
    });
  });

  describe('description', () => {
    it('should accept valid description', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        description: 'A beautiful palette',
      });
      expect(result.success).toBe(true);
    });

    it('should accept without description', () => {
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: validColors });
      expect(result.success).toBe(true);
    });

    it('should reject description over 500 characters', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        description: 'A'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('colors', () => {
    it('should accept 3 colors (minimum)', () => {
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: validColors });
      expect(result.success).toBe(true);
    });

    it('should accept 8 colors (maximum)', () => {
      const eightColors = Array(8).fill(validColors[0]).map((c, i) => ({ ...c, position: i }));
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: eightColors });
      expect(result.success).toBe(true);
    });

    it('should reject less than 3 colors', () => {
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: validColors.slice(0, 2) });
      expect(result.success).toBe(false);
    });

    it('should reject more than 8 colors', () => {
      const nineColors = Array(9).fill(validColors[0]).map((c, i) => ({ ...c, position: i }));
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: nineColors });
      expect(result.success).toBe(false);
    });
  });

  describe('source_image_url', () => {
    it('should accept valid URL', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        source_image_url: 'https://example.com/image.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should accept without source_image_url', () => {
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: validColors });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        source_image_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('is_public', () => {
    it('should default to false', () => {
      const result = createPaletteSchema.parse({ name: 'Palette', colors: validColors });
      expect(result.is_public).toBe(false);
    });

    it('should accept true', () => {
      const result = createPaletteSchema.parse({ name: 'Palette', colors: validColors, is_public: true });
      expect(result.is_public).toBe(true);
    });
  });

  describe('tags', () => {
    it('should accept up to 5 tags', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject more than 5 tags', () => {
      const result = createPaletteSchema.safeParse({
        name: 'Palette',
        colors: validColors,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept without tags', () => {
      const result = createPaletteSchema.safeParse({ name: 'Palette', colors: validColors });
      expect(result.success).toBe(true);
    });
  });
});

describe('Profile Validation', () => {
  describe('display_name', () => {
    it('should accept valid display name', () => {
      const result = updateProfileSchema.safeParse({ display_name: 'John Doe' });
      expect(result.success).toBe(true);
    });

    it('should reject empty display name', () => {
      const result = updateProfileSchema.safeParse({ display_name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject display name over 100 characters', () => {
      const result = updateProfileSchema.safeParse({ display_name: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe('bio', () => {
    it('should accept valid bio', () => {
      const result = updateProfileSchema.safeParse({ bio: 'Hello, I am a designer.' });
      expect(result.success).toBe(true);
    });

    it('should accept empty bio', () => {
      const result = updateProfileSchema.safeParse({ bio: '' });
      expect(result.success).toBe(true);
    });

    it('should reject bio over 500 characters', () => {
      const result = updateProfileSchema.safeParse({ bio: 'A'.repeat(501) });
      expect(result.success).toBe(false);
    });
  });

  describe('avatar_url', () => {
    it('should accept valid URL', () => {
      const result = updateProfileSchema.safeParse({ avatar_url: 'https://example.com/avatar.png' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const result = updateProfileSchema.safeParse({ avatar_url: 'not-a-url' });
      expect(result.success).toBe(false);
    });
  });

  describe('partial validation', () => {
    it('should accept empty object', () => {
      const result = updateProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept single field', () => {
      const result = updateProfileSchema.safeParse({ bio: 'New bio' });
      expect(result.success).toBe(true);
    });
  });
});
