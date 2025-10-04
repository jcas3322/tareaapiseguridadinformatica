/**
 * Application Security Configuration
 * Centralized security settings and policies
 */

export interface SecurityMiddlewareConfig {
  corsOrigins: string[];
  enableHSTS: boolean;
  enableCSP: boolean;
  enableXSSProtection: boolean;
  enableFrameGuard: boolean;
  enableContentTypeNoSniff: boolean;
  enableReferrerPolicy: boolean;
  cspPolicy?: any;
  hstsMaxAge?: number;
}

export class AppSecurityConfig {
  public static getConfig(): SecurityMiddlewareConfig {
    const corsOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:3001'];

    return {
      corsOrigins,
      enableHSTS: process.env.ENABLE_HSTS === 'true',
      enableCSP: process.env.ENABLE_CSP !== 'false',
      enableXSSProtection: true,
      enableFrameGuard: true,
      enableContentTypeNoSniff: true,
      enableReferrerPolicy: true,
      cspPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000')
    };
  }
}