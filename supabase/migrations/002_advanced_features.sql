-- ============================================
-- Color.io Phase 7: Advanced Features
-- Migration for Palette History & Color Trends
-- ============================================

-- ============================================
-- 1. SOFT DELETE FOR PALETTES
-- Add deleted_at column for soft deletes
-- ============================================

ALTER TABLE palettes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_palettes_deleted_at ON palettes(deleted_at) WHERE deleted_at IS NOT NULL;

-- Update RLS policy to exclude soft-deleted palettes
DROP POLICY IF EXISTS "Public palettes are viewable by everyone" ON palettes;
CREATE POLICY "Public palettes are viewable by everyone"
  ON palettes FOR SELECT
  USING (deleted_at IS NULL AND (is_public = true OR auth.uid() = user_id));

-- Policy for users to see their own deleted palettes
CREATE POLICY "Users can view their own deleted palettes"
  ON palettes FOR SELECT
  USING (auth.uid() = user_id);

-- Function to soft delete a palette
CREATE OR REPLACE FUNCTION soft_delete_palette(palette_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE palettes
  SET deleted_at = NOW()
  WHERE id = palette_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to restore a soft-deleted palette
CREATE OR REPLACE FUNCTION restore_palette(palette_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE palettes
  SET deleted_at = NULL
  WHERE id = palette_id
    AND user_id = auth.uid()
    AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to permanently delete old soft-deleted palettes (>30 days)
CREATE OR REPLACE FUNCTION cleanup_old_deleted_palettes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM palettes
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. COLOR TRENDS TABLE
-- Track trending colors from community palettes
-- ============================================

CREATE TABLE IF NOT EXISTS color_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hex_code VARCHAR(7) NOT NULL,
  rgb_r INTEGER NOT NULL CHECK (rgb_r >= 0 AND rgb_r <= 255),
  rgb_g INTEGER NOT NULL CHECK (rgb_g >= 0 AND rgb_g <= 255),
  rgb_b INTEGER NOT NULL CHECK (rgb_b >= 0 AND rgb_b <= 255),
  hsl_h INTEGER NOT NULL CHECK (hsl_h >= 0 AND hsl_h <= 360),
  hsl_s INTEGER NOT NULL CHECK (hsl_s >= 0 AND hsl_s <= 100),
  hsl_l INTEGER NOT NULL CHECK (hsl_l >= 0 AND hsl_l <= 100),
  usage_count INTEGER DEFAULT 1,
  period_type VARCHAR(20) NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly', 'seasonal'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  color_name VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trend queries
CREATE INDEX IF NOT EXISTS idx_color_trends_period ON color_trends(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_color_trends_usage ON color_trends(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_color_trends_hex ON color_trends(hex_code);

-- RLS for color_trends
ALTER TABLE color_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Color trends are viewable by everyone"
  ON color_trends FOR SELECT
  USING (true);

-- Only backend/cron can insert/update (no direct user access)
CREATE POLICY "Only service role can modify trends"
  ON color_trends FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. COLOR COMBINATIONS TRENDS TABLE
-- Track popular color combinations
-- ============================================

CREATE TABLE IF NOT EXISTS combination_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colors JSONB NOT NULL, -- Array of hex codes
  color_count INTEGER NOT NULL,
  usage_count INTEGER DEFAULT 1,
  period_type VARCHAR(20) NOT NULL DEFAULT 'weekly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_combination_trends_period ON combination_trends(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_combination_trends_usage ON combination_trends(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_combination_trends_colors ON combination_trends USING GIN (colors);

-- RLS for combination_trends
ALTER TABLE combination_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Combination trends are viewable by everyone"
  ON combination_trends FOR SELECT
  USING (true);

CREATE POLICY "Only service role can modify combination trends"
  ON combination_trends FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. FUNCTIONS FOR TREND CALCULATIONS
-- ============================================

-- Function to aggregate color data into trends (weekly)
CREATE OR REPLACE FUNCTION calculate_weekly_color_trends()
RETURNS INTEGER AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  inserted_count INTEGER;
BEGIN
  start_date := date_trunc('week', CURRENT_DATE)::DATE;
  end_date := (start_date + INTERVAL '6 days')::DATE;

  -- Delete existing weekly trends for current week (to refresh)
  DELETE FROM color_trends
  WHERE period_type = 'weekly'
    AND period_start = start_date;

  -- Insert aggregated color trends from public palettes
  INSERT INTO color_trends (hex_code, rgb_r, rgb_g, rgb_b, hsl_h, hsl_s, hsl_l, usage_count, period_type, period_start, period_end, color_name)
  SELECT
    pc.hex_code,
    pc.rgb_r,
    pc.rgb_g,
    pc.rgb_b,
    pc.hsl_h,
    pc.hsl_s,
    pc.hsl_l,
    COUNT(*) as usage_count,
    'weekly',
    start_date,
    end_date,
    pc.name
  FROM palette_colors pc
  INNER JOIN palettes p ON p.id = pc.palette_id
  WHERE p.is_public = true
    AND p.deleted_at IS NULL
    AND p.created_at >= start_date
    AND p.created_at < end_date + INTERVAL '1 day'
  GROUP BY pc.hex_code, pc.rgb_r, pc.rgb_g, pc.rgb_b, pc.hsl_h, pc.hsl_s, pc.hsl_l, pc.name
  HAVING COUNT(*) >= 2
  ORDER BY COUNT(*) DESC
  LIMIT 100;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate monthly color trends
CREATE OR REPLACE FUNCTION calculate_monthly_color_trends()
RETURNS INTEGER AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  inserted_count INTEGER;
BEGIN
  start_date := date_trunc('month', CURRENT_DATE)::DATE;
  end_date := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  DELETE FROM color_trends
  WHERE period_type = 'monthly'
    AND period_start = start_date;

  INSERT INTO color_trends (hex_code, rgb_r, rgb_g, rgb_b, hsl_h, hsl_s, hsl_l, usage_count, period_type, period_start, period_end, color_name)
  SELECT
    pc.hex_code,
    pc.rgb_r,
    pc.rgb_g,
    pc.rgb_b,
    pc.hsl_h,
    pc.hsl_s,
    pc.hsl_l,
    COUNT(*) as usage_count,
    'monthly',
    start_date,
    end_date,
    pc.name
  FROM palette_colors pc
  INNER JOIN palettes p ON p.id = pc.palette_id
  WHERE p.is_public = true
    AND p.deleted_at IS NULL
    AND p.created_at >= start_date
    AND p.created_at < end_date + INTERVAL '1 day'
  GROUP BY pc.hex_code, pc.rgb_r, pc.rgb_g, pc.rgb_b, pc.hsl_h, pc.hsl_s, pc.hsl_l, pc.name
  HAVING COUNT(*) >= 3
  ORDER BY COUNT(*) DESC
  LIMIT 100;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to determine season
CREATE OR REPLACE FUNCTION get_current_season()
RETURNS VARCHAR(20) AS $$
DECLARE
  current_month INTEGER;
BEGIN
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  IF current_month IN (3, 4, 5) THEN
    RETURN 'spring';
  ELSIF current_month IN (6, 7, 8) THEN
    RETURN 'summer';
  ELSIF current_month IN (9, 10, 11) THEN
    RETURN 'autumn';
  ELSE
    RETURN 'winter';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get trending colors for a period
CREATE OR REPLACE FUNCTION get_trending_colors(
  p_period_type VARCHAR DEFAULT 'weekly',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  hex_code VARCHAR,
  rgb_r INTEGER,
  rgb_g INTEGER,
  rgb_b INTEGER,
  hsl_h INTEGER,
  hsl_s INTEGER,
  hsl_l INTEGER,
  usage_count INTEGER,
  color_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.hex_code,
    ct.rgb_r,
    ct.rgb_g,
    ct.rgb_b,
    ct.hsl_h,
    ct.hsl_s,
    ct.hsl_l,
    ct.usage_count,
    ct.color_name
  FROM color_trends ct
  WHERE ct.period_type = p_period_type
    AND ct.period_start <= CURRENT_DATE
    AND ct.period_end >= CURRENT_DATE
  ORDER BY ct.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_color_trends_updated_at
  BEFORE UPDATE ON color_trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. INCREMENT/DECREMENT HELPER FUNCTIONS
-- For use with RPC calls from the client
-- ============================================

CREATE OR REPLACE FUNCTION increment_likes_count(palette_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE palettes SET likes_count = likes_count + 1 WHERE id = palette_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_likes_count(palette_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE palettes SET likes_count = GREATEST(0, likes_count - 1) WHERE id = palette_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
