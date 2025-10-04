/**
 * Security Tests Setup
 * Configures the test environment for security testing
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-security-testing-minimum-32-characters-long';
process.env.BCRYPT_ROUNDS = '10';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_security_db';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.CORS_ORIGINS = 'https://localhost:3000,https://test.example.com';
process.env.RATE_LIMIT_WINDOW = '60000'; // 1 minute
process.env.RATE_LIMIT_MAX = '10';
process.env.ENABLE_SWAGGER = 'false';
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_HSTS = 'true';
process.env.ENABLE_CSP = 'true';
process.env.SESSION_SECRET = 'test-session-secret-for-security-testing';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB
process.env.ALLOWED_FILE_TYPES = '.mp3,.wav,.flac,.m4a,.jpg,.png';
process.env.REQUEST_TIMEOUT = '30000';
process.env.BODY_LIMIT = '10mb';

// Mock external services for security testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'https://test-bucket.s3.amazonaws.com/test-file' })
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  }))
}));

// Mock Redis for testing
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
    flushall: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined)
  };
  
  return jest.fn(() => mockRedis);
});

// Mock database connections
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Global test timeout for security tests
jest.setTimeout(60000);

// Suppress console logs during tests unless explicitly needed
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global setup for security tests
beforeAll(async () => {
  // Clear any existing timers
  jest.clearAllTimers();
  
  // Set up test database if needed
  // This would typically involve creating a test database
  // and running migrations
});

afterAll(async () => {
  // Clean up after all tests
  jest.clearAllMocks();
  jest.restoreAllMocks();
  
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

export {};