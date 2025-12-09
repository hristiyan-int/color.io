# Color.io

A mobile app that extracts dominant color palettes from photos, allowing users to save, customize, share, and export palettes for design workflows.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo, TypeScript, Expo Router, Zustand |
| Backend | Node.js + Express, TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Supabase account (free tier works)

### 1. Clone and Install

```bash
git clone <repo-url>
cd color.io

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

### 2. Configure Environment

**Frontend** - copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**Backend** - copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=generate-with-openssl-rand-base64-32
CORS_ORIGIN=http://localhost:8081
```

### 3. Set Up Database

Run the migrations in your Supabase SQL editor:
```bash
# Located in:
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_advanced_features.sql
```

### 4. Run the App

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Mobile App:**
```bash
npm start
# Then press 'i' for iOS or 'a' for Android
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/ready` | Health check with DB status |
| POST | `/api/auth/signup` | Register user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/palettes` | List user's palettes |
| POST | `/api/palettes` | Create palette |
| GET | `/api/palettes/:id` | Get palette details |
| PATCH | `/api/palettes/:id` | Update palette |
| DELETE | `/api/palettes/:id` | Delete palette |
| POST | `/api/palettes/:id/like` | Like a palette |
| GET | `/api/feed` | Community feed |
| GET | `/api/profiles/:username` | User profile |
| GET | `/api/tags` | Popular tags |

## Project Structure

```
color.io/
├── app/                    # Expo Router screens
├── src/
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and business logic
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── backend/
│   └── src/
│       ├── routes/         # API routes
│       ├── middleware/     # Express middleware
│       ├── services/       # Business logic
│       └── types/          # TypeScript types
└── supabase/
    └── migrations/         # Database migrations
```

## Testing

```bash
# Run frontend tests
npm test

# Run with coverage
npm test -- --coverage
```

## Building for Production

```bash
# Build mobile app with EAS
npx eas build --platform ios
npx eas build --platform android

# Build backend
cd backend && npm run build
```

## Environment Variables

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `EXPO_PUBLIC_API_URL` | Backend API URL |

### Backend (backend/.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | Environment (development/production) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `JWT_SECRET` | JWT signing secret |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) |
| `RATE_LIMIT_MAX` | Max requests per window (default: 100) |
| `AUTH_RATE_LIMIT_MAX` | Max auth requests per minute (default: 5) |

## License

MIT
