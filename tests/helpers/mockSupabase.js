/**
 * Mock Supabase Client Helper
 * Provides mocked Supabase client for testing
 */

class MockSupabaseQuery {
  constructor() {
    this.mockData = null;
    this.mockError = null;
    this.filters = [];
  }

  from(table) {
    this.table = table;
    return this;
  }

  select(columns = '*') {
    this.columns = columns;
    return this;
  }

  insert(data) {
    this.insertData = data;
    return this;
  }

  upsert(data, options = {}) {
    this.upsertData = data;
    this.upsertOptions = options;
    return this;
  }

  update(data) {
    this.updateData = data;
    return this;
  }

  delete() {
    this.deleteFlag = true;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ type: 'neq', column, value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ type: 'lte', column, value });
    return this;
  }

  like(column, pattern) {
    this.filters.push({ type: 'like', column, pattern });
    return this;
  }

  ilike(column, pattern) {
    this.filters.push({ type: 'ilike', column, pattern });
    return this;
  }

  is(column, value) {
    this.filters.push({ type: 'is', column, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, values });
    return this;
  }

  order(column, options) {
    this.orderBy = { column, ...options };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = true;
    return this;
  }

  maybeSingle() {
    this.maybeSingleMode = true;
    return this;
  }

  // Mock response methods
  then(callback) {
    const result = {
      data: this.mockData,
      error: this.mockError,
      count: this.mockCount,
    };
    return Promise.resolve(callback(result));
  }
}

class MockSupabaseClient {
  constructor() {
    this.mockResponses = new Map();
  }

  from(table) {
    const query = new MockSupabaseQuery();
    query.from(table);

    // Set mock data if configured
    const mockConfig = this.mockResponses.get(table);
    if (mockConfig) {
      query.mockData = mockConfig.data;
      query.mockError = mockConfig.error;
      query.mockCount = mockConfig.count;
    }

    return query;
  }

  // RPC method for stored procedures
  rpc(functionName, params) {
    const query = new MockSupabaseQuery();
    query.rpcFunction = functionName;
    query.rpcParams = params;

    const mockConfig = this.mockResponses.get(`rpc:${functionName}`);
    if (mockConfig) {
      query.mockData = mockConfig.data;
      query.mockError = mockConfig.error;
    }

    return query;
  }

  // Auth methods
  auth = {
    signInWithPassword: jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({
      error: null,
    }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    admin: {
      createUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: null,
      }),
      listUsers: jest.fn().mockResolvedValue({
        data: { users: [] },
        error: null,
      }),
    },
    mfa: {
      challenge: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      verify: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      enroll: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      unenroll: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    },
    setSession: jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
  };

  // Storage methods
  storage = {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  // Helper to set mock responses for tables
  setMockResponse(table, { data = null, error = null, count = undefined }) {
    this.mockResponses.set(table, { data, error, count });
  }

  // Helper to set mock RPC responses
  setMockRpcResponse(functionName, { data = null, error = null }) {
    this.mockResponses.set(`rpc:${functionName}`, { data, error });
  }

  // Reset all mocks
  reset() {
    this.mockResponses.clear();
    this.auth.signInWithPassword.mockClear();
    this.auth.signUp.mockClear();
    this.auth.signOut.mockClear();
    this.auth.getSession.mockClear();
  }
}

// Factory function to create mock Supabase client
function createMockSupabaseClient() {
  return new MockSupabaseClient();
}

module.exports = {
  createMockSupabaseClient,
  MockSupabaseClient,
  MockSupabaseQuery,
};
