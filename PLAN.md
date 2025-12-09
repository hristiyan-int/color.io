# Color.io - Complete Project Execution Plan

## Project Overview
A mobile app that extracts dominant color palettes from photos, allowing users to save, customize, share, and export palettes for design workflows.

---

## Technology Stack (All Free/Open Source)

### Mobile App
| Technology | Purpose | Cost |
|------------|---------|------|
| **React Native + Expo** | Cross-platform mobile framework | Free |
| **TypeScript** | Type-safe JavaScript | Free |
| **Expo Router** | File-based navigation | Free |
| **Zustand** | State management | Free |
| **React Native Reanimated** | Animations | Free |
| **MMKV** | Fast local storage | Free |

### Backend
| Technology | Purpose | Cost |
|------------|---------|------|
| **Node.js + Express** | API server | Free |
| **PostgreSQL** | Relational database | Free |
| **Supabase** | Auth + Database + Storage (hosted PostgreSQL) | Free tier: 500MB DB, 1GB storage |
| **Sharp** | Server-side image processing | Free |
| **Redis** (optional) | Caching | Free (self-hosted) or Upstash free tier |

### Hosting & Infrastructure
| Technology | Purpose | Cost |
|------------|---------|------|
| **Railway** or **Render** | Backend hosting | Free tier available |
| **Supabase Storage** | Image storage | Free tier: 1GB |
| **Cloudflare R2** (alternative) | Object storage | Free: 10GB storage, 10M requests |
| **Vercel** (optional) | Landing page | Free tier |

### Development Tools
| Technology | Purpose | Cost |
|------------|---------|------|
| **GitHub** | Version control | Free |
| **GitHub Actions** | CI/CD | Free: 2000 min/month |
| **ESLint + Prettier** | Code quality | Free |
| **Jest** | Testing | Free |
| **Expo EAS** | App builds | Free: 30 builds/month |

### Additional Services
| Technology | Purpose | Cost |
|------------|---------|------|
| **Supabase Auth** | Authentication | Free |
| **Meilisearch** | Search (self-hosted) | Free |
| **Sentry** | Error tracking | Free: 5K errors/month |
| **Plausible** (self-hosted) | Analytics | Free |

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Project Setup

**Task: Initialize React Native Project**
```
Create a new Expo project with TypeScript:
- Project name: color-io
- Template: expo-router with TypeScript
- Configure absolute imports (@/ prefix)
- Set up ESLint, Prettier, Husky for pre-commit hooks
- Create folder structure:
  src/
  ├── app/           # Expo Router screens
  ├── components/    # Reusable UI components
  ├── hooks/         # Custom React hooks
  ├── services/      # API and business logic
  ├── store/         # Zustand stores
  ├── utils/         # Utility functions
  ├── types/         # TypeScript types
  └── constants/     # App constants
```

**Task: Initialize Backend Project**
```
Create Node.js Express API:
- Set up TypeScript configuration
- Configure PostgreSQL with Supabase
- Set up authentication with Supabase Auth
- Create folder structure:
  src/
  ├── routes/        # API routes
  ├── controllers/   # Route handlers
  ├── services/      # Business logic
  ├── models/        # Database models
  ├── middleware/    # Express middleware
  └── utils/         # Utilities
```

### 1.2 Database Schema

**Task: Create Supabase Tables**
```sql
-- Users (managed by Supabase Auth, extend with profiles)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Palettes
CREATE TABLE palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  source_image_url TEXT,
  thumbnail_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Palette Colors
CREATE TABLE palette_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  hex_code VARCHAR(7) NOT NULL,
  rgb_r INTEGER, rgb_g INTEGER, rgb_b INTEGER,
  hsl_h INTEGER, hsl_s INTEGER, hsl_l INTEGER,
  position INTEGER NOT NULL,
  name VARCHAR(50)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50),
  usage_count INTEGER DEFAULT 0
);

CREATE TABLE palette_tags (
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (palette_id, tag_id)
);

-- Social Features
CREATE TABLE likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, palette_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  palette_id UUID REFERENCES palettes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
```

### 1.3 Authentication System

**Task: Implement Supabase Auth**
```
Mobile App:
- Install @supabase/supabase-js
- Create auth service with:
  - signUp(email, password)
  - signIn(email, password)
  - signOut()
  - resetPassword(email)
  - getCurrentUser()
  - onAuthStateChange(callback)
- Create auth screens:
  - Login screen (email/password)
  - Register screen
  - Forgot password screen
- Store session securely with expo-secure-store
- Create useAuth hook for auth state
- Implement protected routes

Backend:
- Validate Supabase JWT on protected routes
- Create middleware to extract user from token
- Set up Row Level Security (RLS) policies
```

---

## Phase 2: Core Features (Week 3-4)

### 2.1 Camera & Image Capture

**Task: Implement Camera Functionality**
```
Install dependencies:
- expo-camera
- expo-image-picker
- expo-image-manipulator

Create components:
1. CameraView.tsx
   - Full-screen camera preview
   - Capture button with animation
   - Flash toggle (auto/on/off)
   - Camera flip (front/back)
   - Gallery access button

2. ImageCropper.tsx
   - Display selected/captured image
   - Draggable crop rectangle
   - Aspect ratio options (free, 1:1, 4:3)
   - Zoom and pan gestures
   - "Use Full Image" option

3. useImagePicker hook
   - pickFromGallery()
   - takePhoto()
   - Handle permissions
   - Return processed image URI
```

### 2.2 Color Extraction Algorithm

**Task: Implement Color Extraction**
```
Create utils/colorExtraction.ts:

1. Core Algorithm (Modified Median Cut + K-Means):
   - Load image pixels from URI
   - Resize to max 200x200 for performance
   - Apply median cut to get initial clusters
   - Refine with k-means (5-10 iterations)
   - Calculate color percentages
   - Filter similar colors (Delta E < 10)
   - Sort by dominance

2. Color Utilities:
   - rgbToHex, hexToRgb
   - rgbToHsl, hslToRgb
   - deltaE (color distance)
   - getColorName (from dictionary of 150 colors)

3. Color Harmonies:
   - getComplementary(hsl)
   - getAnalogous(hsl)
   - getTriadic(hsl)
   - getSplitComplementary(hsl)

4. useColorExtraction hook:
   - extractColors(imageUri, options)
   - isExtracting state
   - error handling
   - caching with MMKV

Target: Extract 3-8 colors in < 500ms
```

### 2.3 Palette Generation Screen

**Task: Create Palette Result Screen**
```
Screen: PaletteResultScreen.tsx

Layout:
┌─────────────────────────────────┐
│  [Back]   New Palette   [Save]  │
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │    Source Image         │    │
│  │    (collapsible)        │    │
│  └─────────────────────────┘    │
│                                 │
│  [■][■][■][■][■][■]            │  <- Color swatches
│                                 │
│  ── Color Details ────────────  │
│  Selected: Coral Red            │
│  HEX: #FF6B6B  [Copy]          │
│  RGB: 255, 107, 107            │
│  HSL: 0°, 100%, 71%            │
│                                 │
│  ── Actions ──────────────────  │
│  [Customize] [Share] [Export]   │
└─────────────────────────────────┘

Features:
- Tap swatch to see details
- Long press to copy HEX
- Pull down to show/hide source image
- Animate swatches on mount
```

---

## Phase 3: Palette Management (Week 5-6)

### 3.1 Palette Customization

**Task: Create Palette Editor**
```
Screen: PaletteEditorScreen.tsx

Features:
1. Draggable color reordering (react-native-draggable-flatlist)
2. Color adjustment sliders:
   - Hue (0-360°)
   - Saturation (0-100%)
   - Lightness (0-100%)
3. Add/remove colors (min 3, max 8)
4. Color picker wheel for manual selection
5. Undo/redo (track last 20 states)
6. Color suggestions:
   - Complementary
   - Lighter/darker variants
   - More/less saturated
7. Preview modes:
   - Swatches
   - Gradient
   - Simple mockup
```

### 3.2 Palette Library

**Task: Create Library Screen**
```
Screen: LibraryScreen.tsx (Tab)

Features:
1. Grid view of saved palettes (2 columns)
2. Sort options: Recent, Name, Likes
3. Filter by tags
4. Search palettes
5. Swipe to delete
6. Pull to refresh
7. Empty state with CTA

API Endpoints:
- GET /palettes (user's palettes)
- DELETE /palettes/:id
- PATCH /palettes/:id (update name, public status)
```

### 3.3 Palette Detail Screen

**Task: Create Detail View**
```
Screen: PaletteDetailScreen.tsx

Features:
1. Full palette display with source image
2. All color codes (tap to copy)
3. Tag display
4. Edit button (owner only)
5. Share button
6. Export options
7. Like button (if viewing others' palette)
8. Comments section (if public)
9. Creator info (if viewing others')
```

---

## Phase 4: Sharing & Export (Week 7-8)

### 4.1 Export Functionality

**Task: Implement Export Options**
```
Create services/exportService.ts:

Export Formats:
1. Image (PNG)
   - Generate palette image with swatches
   - Include HEX codes
   - Optional: include source image
   - Save to camera roll or share

2. Text/Code
   - Copy as HEX list
   - Copy as RGB list
   - Copy as CSS variables
   - Copy as SCSS variables
   - Copy as Tailwind config

3. PDF (using react-native-pdf-lib)
   - Professional palette document
   - Include all color formats
   - Source image thumbnail

4. ASE/ACO (Adobe Swatch)
   - For Photoshop/Illustrator
   - Binary format generation

UI: Bottom sheet with export options
```

### 4.2 Social Sharing

**Task: Implement Share Flow**
```
Features:
1. Native share sheet (expo-sharing)
   - Share palette image
   - Share link to palette (if public)

2. Direct app shares:
   - Copy link
   - Share to Instagram Stories (with palette overlay)
   - Share to Pinterest

3. Make palette public toggle
   - Adds to community feed
   - Generates shareable link
```

---

## Phase 5: Community Features (Week 9-10)

### 5.1 Community Feed

**Task: Create Feed Screen**
```
Screen: FeedScreen.tsx (Tab)

Sections:
1. Trending (most liked in 7 days)
2. Recent (chronological)
3. Following (from followed users)

Features:
- Infinite scroll with pagination
- Pull to refresh
- Double-tap to like
- Tap to view detail
- Long press for quick actions

API Endpoints:
- GET /feed?type=trending|recent|following
- Cursor-based pagination
```

### 5.2 Social Interactions

**Task: Implement Social Features**
```
Features:
1. Like/unlike palettes
   - Optimistic updates
   - Heart animation
   - Like count display

2. Comments
   - View comments on palette
   - Add comment
   - Delete own comments
   - Report inappropriate

3. Follow users
   - Follow/unfollow button
   - Follower/following counts
   - Following feed

API Endpoints:
- POST/DELETE /palettes/:id/like
- GET/POST /palettes/:id/comments
- POST/DELETE /users/:id/follow
- GET /users/:id/followers
- GET /users/:id/following
```

### 5.3 User Profiles

**Task: Create Profile Screens**
```
Screen: ProfileScreen.tsx (Tab - own profile)
Screen: UserProfileScreen.tsx (other users)

Features:
1. Avatar, display name, bio
2. Palette count, followers, following
3. User's public palettes grid
4. Edit profile (own)
5. Follow button (others)
6. Settings access (own)
```

---

## Phase 6: Tags & Search (Week 11)

### 6.1 Mood/Theme Tagging

**Task: Implement Tag System**
```
Tag Categories:
- Mood: calm, energetic, romantic, mysterious, cheerful
- Style: minimalist, vintage, modern, retro, elegant
- Season: spring, summer, autumn, winter
- Purpose: branding, web, interior, fashion, art

Features:
1. Tag selector during save
   - Autocomplete existing tags
   - Create new tags
   - Max 5 tags per palette

2. Tag browsing
   - Popular tags page
   - Tap tag to see palettes
   - Tag clouds

API Endpoints:
- GET /tags (popular tags)
- GET /tags/search?q=
- GET /tags/:name/palettes
```

### 6.2 Search

**Task: Implement Search**
```
Features:
1. Search palettes by:
   - Name
   - Tags
   - Creator username
   - Color (find palettes containing specific color)

2. Search UI:
   - Search bar in feed
   - Recent searches
   - Suggested tags
   - Filter by: Most liked, Recent, Following

Use Supabase full-text search or Meilisearch (self-hosted)
```

---

## Phase 7: Advanced Features (Week 12-13)

### 7.1 AI Palette Suggestions

**Task: Implement Smart Suggestions**
```
Features (using local algorithms, no paid AI):
1. Color harmony suggestions
   - Based on color theory
   - Complementary, analogous, triadic

2. Palette completion
   - Suggest colors to add based on existing
   - Fill gaps in color spectrum

3. Similar palettes
   - Find palettes with similar colors
   - "You might also like"

4. Gradient generation
   - Create gradients between palette colors
   - Suggest gradient directions
```

### 7.2 Palette History

**Task: Implement History**
```
Features:
1. Auto-save all generated palettes
2. "Recent" section in library
3. Clear history option
4. Restore deleted palettes (30 days)

Storage: Local with MMKV + sync to Supabase
```

### 7.3 Color Trends

**Task: Show Trending Colors**
```
Features:
1. Analyze community palettes
2. Show trending colors this week/month
3. Trending color combinations
4. Seasonal color trends

Implementation:
- Aggregate color data from public palettes
- Calculate frequency and recency
- Update daily via cron job
```

---

## Phase 8: Polish & Launch (Week 14-15)

### 8.1 Performance Optimization

**Task: Optimize App Performance**
```
Optimizations:
1. Image optimization
   - Lazy load images in feed
   - Use thumbnails in lists
   - Progressive image loading

2. List performance
   - Use FlashList instead of FlatList
   - Memoize components
   - Optimize re-renders

3. Bundle size
   - Analyze with expo-bundle-analyzer
   - Tree shake unused code
   - Lazy load screens

4. API optimization
   - Request caching
   - Optimistic updates
   - Background sync
```

### 8.2 Testing

**Task: Implement Tests**
```
Unit Tests (Jest):
- Color conversion functions
- Color extraction algorithm
- Utility functions
- Zustand stores

Integration Tests:
- API endpoints
- Authentication flow
- Database operations

E2E Tests (Detox - optional):
- Full user flows
- Critical paths
```

### 8.3 App Store Preparation

**Task: Prepare for Launch**
```
Assets needed:
1. App icon (1024x1024)
2. Screenshots for both platforms
   - 6.5" iPhone
   - 5.5" iPhone
   - 12.9" iPad
   - Android phone
   - Android tablet
3. Feature graphic (Android)
4. App preview video (optional)

Metadata:
- App name: Color.io
- Subtitle: Photo Color Palette Generator
- Description (4000 chars max)
- Keywords
- Privacy policy URL
- Support URL

Build:
- Use Expo EAS Build (free tier)
- Configure app.json properly
- Test on real devices
```

---

## API Endpoints Summary

### Auth (via Supabase)
- POST /auth/signup
- POST /auth/login
- POST /auth/logout
- POST /auth/reset-password

### Profiles
- GET /profiles/me
- PATCH /profiles/me
- GET /profiles/:username
- POST /profiles/:id/follow
- DELETE /profiles/:id/follow

### Palettes
- GET /palettes (user's palettes)
- POST /palettes
- GET /palettes/:id
- PATCH /palettes/:id
- DELETE /palettes/:id
- POST /palettes/:id/like
- DELETE /palettes/:id/like
- GET /palettes/:id/comments
- POST /palettes/:id/comments

### Feed
- GET /feed?type=trending|recent|following
- GET /feed/search?q=

### Tags
- GET /tags
- GET /tags/:name/palettes

### Colors
- POST /colors/extract (server-side extraction)

---

## Environment Variables

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...

# Backend
DATABASE_URL=postgresql://...
SUPABASE_SERVICE_KEY=eyJhbG...
JWT_SECRET=your-secret

# Storage (if using Cloudflare R2)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=colorio-images

# Optional
SENTRY_DSN=
```

---

## Cost Estimation (Monthly)

| Service | Free Tier Limits | Estimated Usage | Cost |
|---------|------------------|-----------------|------|
| Supabase | 500MB DB, 1GB storage, 50K auth users | Should fit | $0 |
| Railway/Render | 500 hours/month | Backend API | $0 |
| Cloudflare R2 | 10GB storage | Image storage | $0 |
| Expo EAS | 30 builds/month | App builds | $0 |
| GitHub Actions | 2000 min/month | CI/CD | $0 |
| **Total** | | | **$0** |

**When to upgrade:**
- 10K+ active users: Consider Supabase Pro ($25/mo)
- High traffic: Upgrade Railway ($5-20/mo)
- More builds: EAS Production ($99/mo)

---

## Success Metrics

### Launch Goals
- [ ] 1,000 downloads in first month
- [ ] 4.0+ App Store rating
- [ ] 500 registered users
- [ ] 1,000 palettes created

### Engagement Goals
- [ ] 30% Day 1 retention
- [ ] 15% Day 7 retention
- [ ] 5 palettes per active user
- [ ] 20% users engage with community feed

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Free tier limits exceeded | Monitor usage, implement rate limiting |
| App store rejection | Follow guidelines, prepare appeal |
| Performance issues | Load testing, optimization sprint |
| Security vulnerabilities | Regular audits, RLS policies, input validation |
| User data loss | Regular backups, sync to cloud |

---

## Next Steps

1. **Today**: Set up project repositories (mobile + backend)
2. **This Week**: Complete Phase 1 foundation
3. **Review Points**: End of each phase for stakeholder review
4. **Launch**: Target 15 weeks from start
