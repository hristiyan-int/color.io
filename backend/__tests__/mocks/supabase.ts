// Mock Supabase client for testing
export const mockSupabaseData = {
  users: new Map<string, any>(),
  profiles: new Map<string, any>(),
  palettes: new Map<string, any>(),
  palette_colors: new Map<string, any>(),
  tags: new Map<string, any>(),
  palette_tags: new Map<string, any>(),
  likes: new Map<string, any>(),
  comments: new Map<string, any>(),
  follows: new Map<string, any>(),
};

// Test user data
export const testUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
};

export const testUser2 = {
  id: 'test-user-id-456',
  email: 'test2@example.com',
};

// Test profile data
export const testProfile = {
  id: testUser.id,
  username: 'testuser',
  display_name: 'Test User',
  bio: 'A test user',
  avatar_url: null,
  created_at: new Date().toISOString(),
};

export const testProfile2 = {
  id: testUser2.id,
  username: 'testuser2',
  display_name: 'Test User 2',
  bio: 'Another test user',
  avatar_url: null,
  created_at: new Date().toISOString(),
};

// Test palette data
export const testPalette = {
  id: 'test-palette-id-123',
  user_id: testUser.id,
  name: 'Test Palette',
  description: 'A test palette',
  source_image_url: null,
  thumbnail_url: null,
  is_public: true,
  likes_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const testColors = [
  { id: 'color-1', palette_id: testPalette.id, hex_code: '#FF6B6B', rgb_r: 255, rgb_g: 107, rgb_b: 107, hsl_h: 0, hsl_s: 100, hsl_l: 71, position: 0, name: 'Coral Red' },
  { id: 'color-2', palette_id: testPalette.id, hex_code: '#4ECDC4', rgb_r: 78, rgb_g: 205, rgb_b: 196, hsl_h: 174, hsl_s: 58, hsl_l: 55, position: 1, name: 'Teal' },
  { id: 'color-3', palette_id: testPalette.id, hex_code: '#45B7D1', rgb_r: 69, rgb_g: 183, rgb_b: 209, hsl_h: 191, hsl_s: 59, hsl_l: 55, position: 2, name: 'Sky Blue' },
];

export const testTag = {
  id: 'tag-1',
  name: 'vibrant',
  category: 'mood',
  usage_count: 10,
};

// Helper to reset mock data
export function resetMockData() {
  mockSupabaseData.users.clear();
  mockSupabaseData.profiles.clear();
  mockSupabaseData.palettes.clear();
  mockSupabaseData.palette_colors.clear();
  mockSupabaseData.tags.clear();
  mockSupabaseData.palette_tags.clear();
  mockSupabaseData.likes.clear();
  mockSupabaseData.comments.clear();
  mockSupabaseData.follows.clear();

  // Add default test data
  mockSupabaseData.users.set(testUser.id, testUser);
  mockSupabaseData.users.set(testUser2.id, testUser2);
  mockSupabaseData.profiles.set(testUser.id, testProfile);
  mockSupabaseData.profiles.set(testUser2.id, testProfile2);
}

// Mock query builder
function createMockQueryBuilder(tableName: string) {
  let filters: any[] = [];
  let selectFields = '*';
  let orderBy: { column: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let isSingle = false;
  let isCount = false;
  let isHead = false;

  const builder: any = {
    select: (fields: string, options?: { count?: string; head?: boolean }) => {
      selectFields = fields;
      if (options?.count) isCount = true;
      if (options?.head) isHead = true;
      return builder;
    },
    insert: (data: any) => {
      const id = data.id || `generated-${Date.now()}`;
      const record = { ...data, id, created_at: new Date().toISOString() };
      mockSupabaseData[tableName as keyof typeof mockSupabaseData].set(id, record);
      return builder;
    },
    update: (data: any) => {
      filters.forEach(f => {
        if (f.type === 'eq') {
          const existing = mockSupabaseData[tableName as keyof typeof mockSupabaseData].get(f.value);
          if (existing) {
            mockSupabaseData[tableName as keyof typeof mockSupabaseData].set(f.value, { ...existing, ...data });
          }
        }
      });
      return builder;
    },
    delete: () => {
      filters.forEach(f => {
        if (f.type === 'eq') {
          mockSupabaseData[tableName as keyof typeof mockSupabaseData].delete(f.value);
        }
      });
      return builder;
    },
    eq: (column: string, value: any) => {
      filters.push({ type: 'eq', column, value });
      return builder;
    },
    in: (column: string, values: any[]) => {
      filters.push({ type: 'in', column, values });
      return builder;
    },
    lt: (column: string, value: any) => {
      filters.push({ type: 'lt', column, value });
      return builder;
    },
    or: (condition: string) => {
      filters.push({ type: 'or', condition });
      return builder;
    },
    order: (column: string, options?: { ascending?: boolean }) => {
      orderBy = { column, ascending: options?.ascending ?? true };
      return builder;
    },
    limit: (count: number) => {
      limitCount = count;
      return builder;
    },
    single: () => {
      isSingle = true;
      return builder;
    },
    then: async (resolve: (value: any) => void) => {
      // Simulate query execution
      let data: any[] = Array.from(mockSupabaseData[tableName as keyof typeof mockSupabaseData].values());

      // Apply filters
      filters.forEach(f => {
        if (f.type === 'eq') {
          data = data.filter(item => item[f.column] === f.value || item.id === f.value);
        }
        if (f.type === 'in') {
          data = data.filter(item => f.values.includes(item[f.column]));
        }
      });

      // Apply ordering
      if (orderBy) {
        data.sort((a, b) => {
          const aVal = a[orderBy!.column];
          const bVal = b[orderBy!.column];
          return orderBy!.ascending ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
        });
      }

      // Apply limit
      if (limitCount) {
        data = data.slice(0, limitCount);
      }

      // Handle count
      if (isCount && isHead) {
        return resolve({ data: null, count: data.length, error: null });
      }

      // Return single or array
      if (isSingle) {
        return resolve({ data: data[0] || null, error: data[0] ? null : { message: 'Not found' } });
      }

      return resolve({ data, error: null });
    },
  };

  return builder;
}

// Mock Supabase admin client
export const mockSupabaseAdmin = {
  from: (table: string) => createMockQueryBuilder(table),
  auth: {
    getUser: async (token: string) => {
      // Valid test token
      if (token === 'valid-test-token') {
        return { data: { user: testUser }, error: null };
      }
      if (token === 'valid-test-token-2') {
        return { data: { user: testUser2 }, error: null };
      }
      return { data: { user: null }, error: { message: 'Invalid token' } };
    },
  },
};

// Export for mocking
export default mockSupabaseAdmin;
