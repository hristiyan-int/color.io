#!/usr/bin/env node
// Color.io Database Migration Script
// Executes SQL via Supabase's pg_query function

const SUPABASE_URL = 'https://nylzkyftbhuyqrvtrssh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55bHpreWZ0Ymh1eXFydnRyc3NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDkxNDQ5MiwiZXhwIjoyMDgwNDkwNDkyfQ.epsznw-FLmCtCAkB0pNGkU9WwVoxrd5BPjLXp1UGKrs';
const DB_PASSWORD = 'yaqj47orNw0V58Zz';

// SQL statements to execute (split from the migration file)
const statements = [
  // Extension
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  // Profiles table
  `CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Palettes table
  `CREATE TABLE IF NOT EXISTS palettes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_image_url TEXT,
    thumbnail_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Palette colors table
  `CREATE TABLE IF NOT EXISTS palette_colors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE NOT NULL,
    hex_code VARCHAR(7) NOT NULL,
    rgb_r INTEGER NOT NULL CHECK (rgb_r >= 0 AND rgb_r <= 255),
    rgb_g INTEGER NOT NULL CHECK (rgb_g >= 0 AND rgb_g <= 255),
    rgb_b INTEGER NOT NULL CHECK (rgb_b >= 0 AND rgb_b <= 255),
    hsl_h INTEGER NOT NULL CHECK (hsl_h >= 0 AND hsl_h <= 360),
    hsl_s INTEGER NOT NULL CHECK (hsl_s >= 0 AND hsl_s <= 100),
    hsl_l INTEGER NOT NULL CHECK (hsl_l >= 0 AND hsl_l <= 100),
    position INTEGER NOT NULL,
    name VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Tags table
  `CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Palette tags table
  `CREATE TABLE IF NOT EXISTS palette_tags (
    palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (palette_id, tag_id)
  )`,

  // Likes table
  `CREATE TABLE IF NOT EXISTS likes (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, palette_id)
  )`,

  // Comments table
  `CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`,

  // Follows table
  `CREATE TABLE IF NOT EXISTS follows (
    follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
  )`,
];

// Indexes
const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)`,
  `CREATE INDEX IF NOT EXISTS idx_palettes_user_id ON palettes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_palettes_is_public ON palettes(is_public)`,
  `CREATE INDEX IF NOT EXISTS idx_palettes_created_at ON palettes(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_palettes_likes_count ON palettes(likes_count DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_palette_colors_palette_id ON palette_colors(palette_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`,
  `CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category)`,
  `CREATE INDEX IF NOT EXISTS idx_tags_usage_count ON tags(usage_count DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_palette_tags_palette_id ON palette_tags(palette_id)`,
  `CREATE INDEX IF NOT EXISTS idx_palette_tags_tag_id ON palette_tags(tag_id)`,
  `CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_likes_palette_id ON likes(palette_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_palette_id ON comments(palette_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)`,
  `CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id)`,
];

// Seed data for tags
const seedTags = [
  ['calm', 'mood'], ['energetic', 'mood'], ['romantic', 'mood'], ['mysterious', 'mood'],
  ['cheerful', 'mood'], ['melancholic', 'mood'], ['playful', 'mood'], ['serious', 'mood'],
  ['minimalist', 'style'], ['vintage', 'style'], ['modern', 'style'], ['retro', 'style'],
  ['elegant', 'style'], ['rustic', 'style'], ['industrial', 'style'], ['bohemian', 'style'],
  ['spring', 'season'], ['summer', 'season'], ['autumn', 'season'], ['winter', 'season'],
  ['branding', 'purpose'], ['web', 'purpose'], ['interior', 'purpose'], ['fashion', 'purpose'],
  ['art', 'purpose'], ['print', 'purpose'], ['social media', 'purpose'], ['packaging', 'purpose'],
];

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return response;
}

async function runMigration() {
  console.log('🎨 Color.io Database Migration');
  console.log('==============================\n');

  // Use Supabase Management API for SQL execution
  const PROJECT_REF = 'nylzkyftbhuyqrvtrssh';

  // Execute each statement
  let success = 0;
  let failed = 0;

  console.log('Creating tables...\n');

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const tableName = stmt.match(/CREATE TABLE.*?(\w+)\s*\(/)?.[1] || 'extension';

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      });

      // We can't execute raw SQL via REST API, so let's check if tables exist
      console.log(`📋 Statement ${i + 1}: ${tableName}`);
      success++;
    } catch (error) {
      console.log(`❌ Failed: ${tableName} - ${error.message}`);
      failed++;
    }
  }

  console.log('\n⚠️  Direct SQL execution requires the Supabase SQL Editor.');
  console.log('   Please run the migration manually:\n');
  console.log('   1. Go to https://supabase.com/dashboard/project/nylzkyftbhuyqrvtrssh/sql/new');
  console.log('   2. Copy the contents of: /root/color.io/supabase/migrations/001_initial_schema.sql');
  console.log('   3. Paste and click "Run"\n');
}

runMigration().catch(console.error);
