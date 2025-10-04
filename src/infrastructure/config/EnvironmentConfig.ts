/**
 * Environment Configuration Manager
 * Centralized configuration management with validation
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AppConfig {
  name: string;
  version: string;
  description: string;
  baseUrl: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  logLevel: string;
  requestTimeout: number;
  bodyLimit: string;
  uploadLimit: string;
  enableSwagger: boolean;
  enableMetrics: boolean;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  poolMin: number;
  poolMax: number;
  connectionTimeout: number;
  statementTimeout: number;
  enableLogging: boolean;
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  bcryptRounds: number;
  corsOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  enableCSP: boolean;
  enableHSTS: boolean;
  cspPolicy?: any;
  hstsMaxAge?: number;
}

export class EnvironmentConfig {
  private static instance: EnvironmentConfig;
  private logger?: any;

  private constructor(logger?: any) {
    this.logger = logger;
    this.validateEnvironment();
  }

  public static getInstance(logger?: any): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig(logger);
    }
    return EnvironmentConfig.instance;
  }

  private validateEnvironment(): void {
    const requiredVars = [
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'JWT_SECRET'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  public getAppConfig(): AppConfig {
    return {
      name: process.env.APP_NAME || 'Spotify API',
      version: process.env.APP_VERSION || '1.0.0',
      description: process.env.APP_DESCRIPTION || 'Secure Music Streaming API',
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@spotify-api.com',
      termsUrl: process.env.TERMS_URL || 'https://spotify-api.com/terms',
      privacyUrl: process.env.PRIVACY_URL || 'https://spotify-api.com/privacy'
    };
  }

  public getServerConfig(): ServerConfig {
    return {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || 'localhost',
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      bodyLimit: process.env.BODY_LIMIT || '1mb',
      uploadLimit: process.env.UPLOAD_LIMIT || '50mb',
      enableSwagger: process.env.ENABLE_SWAGGER === 'true',
      enableMetrics: process.env.ENABLE_METRICS !== 'false'
    };
  }

  public getDatabaseConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME!,
      username: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      ssl: process.env.DB_SSL === 'true',
      poolMin: parseInt(process.env.DB_POOL_MIN || '2'),
      poolMax: parseInt(process.env.DB_POOL_MAX || '20'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
      enableLogging: process.env.DB_ENABLE_LOGGING === 'true'
    };
  }

  public getSecurityConfig(): SecurityConfig {
    const corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:3001'];

    return {
      jwtSecret: process.env.JWT_SECRET!,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
      corsOrigins,
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      enableCSP: process.env.ENABLE_CSP !== 'false',
      enableHSTS: process.env.ENABLE_HSTS === 'true',
      hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000')
    };
  }

  public isDevelopment(): boolean {
    return this.getServerConfig().environment === 'development';
  }

  public isProduction(): boolean {
    return this.getServerConfig().environment === 'production';
  }

  public isTest(): boolean {
    return this.getServerConfig().environment === 'test';
  }
}