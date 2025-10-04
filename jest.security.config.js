module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/security'],
  testMatch: [
    '**/security/**/*.test.ts',
    '**/security/**/*.spec.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/types/**/*'
  ],
  coverageDirectory: 'coverage/security',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 60000, // 60 seconds for security tests
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Run security tests sequentially
  
  // Security-specific configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs'
        }
      }
    }
  },
  
  // Custom test environment for security tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Coverage thresholds for security tests
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Stricter thresholds for security-critical modules
    'src/infrastructure/security/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/infrastructure/web/middleware/SecurityMiddleware.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/shared/middleware/AuthenticationMiddleware.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Reporter configuration for security tests
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicPath: './reports/security',
      filename: 'security-test-report.html',
      expand: true,
      hideIcon: false,
      pageTitle: 'Security Test Report',
      logoImgPath: undefined,
      includeFailureMsg: true,
      includeSuiteFailure: true
    }],
    ['jest-junit', {
      outputDirectory: './reports/security',
      outputName: 'security-test-results.xml',
      suiteName: 'Security Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ],
  
  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Setup files for security tests
  setupFiles: [
    '<rootDir>/tests/security/setup-security-tests.ts'
  ],
  
  // Custom matchers for security testing
  setupFilesAfterEnv: [
    '<rootDir>/tests/security/security-matchers.ts'
  ]
};