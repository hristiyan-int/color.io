-- ============================================
-- Color.io Database Schema
-- Supabase PostgreSQL
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE
-- Extends Supabase Auth users
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for username lookups
CREATE INDEX idx_profiles_username ON profiles(username);

-- ============================================
-- 2. PALETTES TABLE
-- Stores user-created color palettes
-- ============================================
CREATE TABLE palettes (
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
);

-- Indexes for common queries
CREATE INDEX idx_palettes_user_id ON palettes(user_id);
CREATE INDEX idx_palettes_is_public ON palettes(is_public);
CREATE INDEX idx_palettes_created_at ON palettes(created_at DESC);
CREATE INDEX idx_palettes_likes_count ON palettes(likes_count DESC);

-- ============================================
-- 3. PALETTE_COLORS TABLE
-- Individual colors within a palette
-- ============================================
CREATE TABLE palette_colors (
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
);

-- Index for palette lookups
CREATE INDEX idx_palette_colors_palette_id ON palette_colors(palette_id);

-- ============================================
-- 4. TAGS TABLE
-- Mood/theme tags for categorization
-- ============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50), -- mood, style, season, purpose
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tag lookups
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_category ON tags(category);
CREATE INDEX idx_tags_usage_count ON tags(usage_count DESC);

-- ============================================
-- 5. PALETTE_TAGS TABLE
-- Many-to-many relationship between palettes and tags
-- ============================================
CREATE TABLE palette_tags (
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (palette_id, tag_id)
);

-- Indexes for lookups
CREATE INDEX idx_palette_tags_palette_id ON palette_tags(palette_id);
CREATE INDEX idx_palette_tags_tag_id ON palette_tags(tag_id);

-- ============================================
-- 6. LIKES TABLE
-- User likes on palettes
-- ============================================
CREATE TABLE likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, palette_id)
);

-- Indexes for lookups
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_palette_id ON likes(palette_id);

-- ============================================
-- 7. COMMENTS TABLE
-- User comments on palettes
-- ============================================
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lookups
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_palette_id ON comments(palette_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- ============================================
-- 8. FOLLOWS TABLE
-- User follow relationships
-- ============================================
CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id) -- Prevent self-following
);

-- Indexes for lookups
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_palettes_updated_at
  BEFORE UPDATE ON palettes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment/decrement likes_count
CREATE OR REPLACE FUNCTION update_palette_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE palettes SET likes_count = likes_count + 1 WHERE id = NEW.palette_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE palettes SET likes_count = likes_count - 1 WHERE id = OLD.palette_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for likes_count
CREATE TRIGGER update_likes_count
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_palette_likes_count();

-- Function to increment/decrement tag usage_count
CREATE OR REPLACE FUNCTION update_tag_usage_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tag usage_count
CREATE TRIGGER update_tag_usage
  AFTER INSERT OR DELETE ON palette_tags
  FOR EACH ROW EXECUTE FUNCTION update_tag_usage_count();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE palettes ENABLE ROW LEVEL SECURITY;
ALTER TABLE palette_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE palette_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- PALETTES POLICIES
CREATE POLICY "Public palettes are viewable by everyone"
  ON palettes FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own palettes"
  ON palettes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own palettes"
  ON palettes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own palettes"
  ON palettes FOR DELETE
  USING (auth.uid() = user_id);

-- PALETTE_COLORS POLICIES
CREATE POLICY "Palette colors viewable with palette"
  ON palette_colors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = palette_colors.palette_id
      AND (palettes.is_public = true OR palettes.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage colors of their palettes"
  ON palette_colors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = palette_colors.palette_id
      AND palettes.user_id = auth.uid()
    )
  );

-- TAGS POLICIES
CREATE POLICY "Tags are viewable by everyone"
  ON tags FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tags"
  ON tags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- PALETTE_TAGS POLICIES
CREATE POLICY "Palette tags viewable with palette"
  ON palette_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = palette_tags.palette_id
      AND (palettes.is_public = true OR palettes.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage tags of their palettes"
  ON palette_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = palette_tags.palette_id
      AND palettes.user_id = auth.uid()
    )
  );

-- LIKES POLICIES
CREATE POLICY "Likes are viewable by everyone"
  ON likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like palettes"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);

-- COMMENTS POLICIES
CREATE POLICY "Comments on public palettes are viewable"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = comments.palette_id
      AND palettes.is_public = true
    )
  );

CREATE POLICY "Authenticated users can comment on public palettes"
  ON comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM palettes
      WHERE palettes.id = comments.palette_id
      AND palettes.is_public = true
    )
  );

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- FOLLOWS POLICIES
CREATE POLICY "Follows are viewable by everyone"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow others"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ============================================
-- SEED DATA: Default Tags
-- ============================================
INSERT INTO tags (name, category) VALUES
  -- Mood tags
  ('calm', 'mood'),
  ('energetic', 'mood'),
  ('romantic', 'mood'),
  ('mysterious', 'mood'),
  ('cheerful', 'mood'),
  ('melancholic', 'mood'),
  ('playful', 'mood'),
  ('serious', 'mood'),
  -- Style tags
  ('minimalist', 'style'),
  ('vintage', 'style'),
  ('modern', 'style'),
  ('retro', 'style'),
  ('elegant', 'style'),
  ('rustic', 'style'),
  ('industrial', 'style'),
  ('bohemian', 'style'),
  -- Season tags
  ('spring', 'season'),
  ('summer', 'season'),
  ('autumn', 'season'),
  ('winter', 'season'),
  -- Purpose tags
  ('branding', 'purpose'),
  ('web', 'purpose'),
  ('interior', 'purpose'),
  ('fashion', 'purpose'),
  ('art', 'purpose'),
  ('print', 'purpose'),
  ('social media', 'purpose'),
  ('packaging', 'purpose');
