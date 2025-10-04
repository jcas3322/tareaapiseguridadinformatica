/**
 * Spotify API Server
 * Main application entry point with complete integration
 */

import express from 'express';
import multer from 'multer';
import { EnvironmentConfig } from './infrastructure/config/EnvironmentConfig';
import { WinstonLogger } from './infrastructure/logging/WinstonLogger';
import { DatabaseConfig } from './infrastructure/database/config/DatabaseConfig';
import { PostgreSQLAdapter } from './infrastructure/database/adapters/PostgreSQLAdapter';
import { SecurityMiddleware } from './infrastructure/web/middleware/SecurityMiddleware';
import { AppSecurityConfig } from './infrastructure/web/config/SecurityConfig';
import { RequestLoggingMiddleware } from './infrastructure/web/middleware/RequestLoggingMiddleware';
import { HealthCheckMiddleware } from './infrastructure/web/middleware/HealthCheckMiddleware';
import { GlobalErrorHandler } from './infrastructure/web/middleware/GlobalErrorHandler';
import { SwaggerGenerator } from './infrastructure/documentation/SwaggerGenerator';
import { createAuthRoutes } from './infrastructure/web/routes/authRoutes';
import { createUserRoutes } from './infrastructure/web/routes/userRoutes';
import { createMusicRoutes } from './infrastructure/web/routes/musicRoutes';
import { CSPReportMiddleware } from './infrastructure/web/middleware/CSPReportMiddleware';
import { DIContainerFactory, DIContainer } from './infrastructure/di/DIContainer';

class SpotifyAPIServer {
  private app: express.Application;
  private logger!: WinstonLogger;
  private envConfig!: EnvironmentConfig;
  private dbAdapter!: PostgreSQLAdapter;
  private diContainer!: DIContainer;
  private server: any;

  constructor() {
    this.app = express();
    this.initializeConfiguration();
  }

  /**
   * Initialize application configuration
   */
  private initializeConfiguration(): void {
    // Initialize logger first
    this.logger = new WinstonLogger({
      level: process.env.LOG_LEVEL || 'info',
      enableConsole: true,
      enableFile: true,
      logDirectory: './logs',
      maxFiles: '30d',
      maxSize: '100m',
      enableRotation: true,
      enableElastic: false,
      environment: process.env.NODE_ENV || 'development',
      serviceName: 'spotify-api'
    });

    // Initialize environment configuration
    this.envConfig = EnvironmentConfig.getInstance();

    this.logger.info('Application configuration initialized', {
      environment: this.envConfig.getServerConfig().environment,
      version: this.envConfig.getAppConfig().version
    });
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    this.logger.info('Initializing database connection...');

    const dbConfig = DatabaseConfig.getInstance(this.logger);
    this.dbAdapter = new PostgreSQLAdapter(dbConfig, this.logger);

    await this.dbAdapter.initialize();

    // Run migrations if in development or if explicitly requested
    const shouldRunMigrations = this.envConfig.isDevelopment() || process.env.RUN_MIGRATIONS === 'true';

    if (shouldRunMigrations) {
      this.logger.info('Running database migrations...');
      await this.dbAdapter.migrate();
    }

    this.logger.info('Database initialization completed');
  }

  /**
   * Initialize security middleware
   */
  private initializeSecurity(): void {
    this.logger.info('Initializing security middleware...');

    const securityConfig = AppSecurityConfig.getConfig();
    const securityMiddleware = new SecurityMiddleware(securityConfig, this.logger);

    // Apply security middleware in correct order
    const securityMiddlewares = securityMiddleware.getAllMiddleware();
    securityMiddlewares.forEach(middleware => {
      this.app.use(middleware);
    });

    // Add body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Configure multer for file uploads
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'audio/mpeg',
          'audio/wav',
          'audio/flac',
          'audio/mp4',
          'audio/mp3',
          'audio/x-wav',
          'audio/wave',
          'audio/x-flac'
        ];

        const allowedExtensions = ['.mp3', '.wav', '.flac', '.m4a'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

        this.logger.info('File upload attempt', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          extension: fileExtension
        });

        // Accept if MIME type is allowed OR if extension is allowed
        if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
          cb(null, true);
        } else {
          this.logger.warn('Invalid file type rejected', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            extension: fileExtension,
            allowedTypes: allowedMimeTypes,
            allowedExtensions: allowedExtensions
          });
          cb(
            new Error(
              `Invalid file type: ${file.mimetype} (${fileExtension}). Only MP3, WAV, FLAC, and M4A files are allowed.`
            )
          );
        }
      }
    });

    // Apply multer middleware to song upload route
    this.app.use('/api/songs', (req, res, next) => {
      if (req.method === 'POST') {
        upload.single('audioFile')(req, res, next);
      } else {
        next();
      }
    });

    this.logger.info('Security middleware initialized');
  }

  /**
   * Initialize logging and monitoring
   */
  private initializeLogging(): void {
    this.logger.info('Initializing request logging and monitoring...');

    // Request logging middleware
    const requestLoggingConfig = {
      enableRequestLogging: true,
      enableResponseLogging: true,
      enableBodyLogging: !this.envConfig.isProduction(),
      enableHeaderLogging: !this.envConfig.isProduction(),
      maxBodySize: 1024 * 10, // 10KB
      excludePaths: ['/api/health', '/api/metrics', '/favicon.ico'],
      excludeHeaders: ['authorization', 'cookie'],
      logLevel: 'info' as const,
      enablePerformanceLogging: true
    };

    const requestLogging = new RequestLoggingMiddleware(this.logger, requestLoggingConfig);
    this.app.use(requestLogging.logRequests());

    // Health check middleware
    const healthCheckConfig = {
      enableDetailedMetrics: !this.envConfig.isProduction(),
      enableDatabaseCheck: true,
      enableExternalServiceChecks: false,
      enableFileSystemCheck: true,
      enableMemoryCheck: true,
      memoryThreshold: 512, // MB
      diskThreshold: 80, // percentage
      responseTimeThreshold: 1000 // ms
    };

    const healthCheck = new HealthCheckMiddleware(this.logger, healthCheckConfig);

    // Health check endpoints
    this.app.get('/api/health', healthCheck.healthCheck());
    this.app.get('/api/health/ready', healthCheck.readinessProbe());
    this.app.get('/api/health/live', healthCheck.livenessProbe());
    this.app.get('/api/metrics', healthCheck.metricsEndpoint());

    // Track requests for metrics
    this.app.use(healthCheck.trackRequests());

    this.logger.info('Logging and monitoring initialized');
  }

  /**
   * Initialize dependency injection container
   */
  private async initializeDependencies(): Promise<void> {
    this.logger.info('Initializing dependency injection container...');

    this.diContainer = await DIContainerFactory.create({
      logger: this.logger,
      envConfig: this.envConfig,
      dbAdapter: this.dbAdapter
    });

    this.logger.info('Dependency injection container initialized');
  }

  /**
   * Initialize API routes
   */
  private initializeRoutes(): void {
    this.logger.info('Initializing API routes...');

    // CSP Report endpoint
    const cspReportMiddleware = new CSPReportMiddleware(this.logger);
    this.app.post(
      '/api/security/csp-report',
      cspReportMiddleware.validateCSPReportContentType(),
      cspReportMiddleware.handleCSPReport()
    );

    // API routes
    const authRoutes = createAuthRoutes(
      this.diContainer.authController,
      this.diContainer.authMiddleware,
      this.diContainer.rateLimitMiddleware,
      this.diContainer.validationMiddleware
    );

    const userRoutes = createUserRoutes(
      this.diContainer.userController,
      this.diContainer.authMiddleware,
      this.diContainer.rateLimitMiddleware,
      this.diContainer.validationMiddleware
    );

    const musicRoutes = createMusicRoutes(
      this.diContainer.songController,
      this.diContainer.albumController,
      this.diContainer.authMiddleware,
      this.diContainer.rateLimitMiddleware,
      this.diContainer.validationMiddleware
    );

    // Mount routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api', musicRoutes); // songs and albums

    this.logger.info('API routes initialized');
  }

  /**
   * Initialize documentation
   */
  private initializeDocumentation(): void {
    if (!this.envConfig.getServerConfig().enableSwagger) {
      this.logger.info('Swagger documentation disabled');
      return;
    }

    this.logger.info('Initializing API documentation...');

    const swaggerGenerator = new SwaggerGenerator(this.logger);
    swaggerGenerator.setupSwagger(this.app);

    this.logger.info('API documentation initialized');
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.logger.info('Initializing error handling...');

    const errorHandlerConfig = {
      enableStackTrace: this.envConfig.isDevelopment(),
      enableErrorDetails: !this.envConfig.isProduction(),
      enableErrorReporting: this.envConfig.isProduction(),
      sanitizeErrors: this.envConfig.isProduction(),
      logErrors: true,
      environment: this.envConfig.getServerConfig().environment
    };

    const globalErrorHandler = new GlobalErrorHandler(this.logger, errorHandlerConfig);

    // Setup process error handlers
    globalErrorHandler.handleUnhandledRejection();
    globalErrorHandler.handleUncaughtException();
    globalErrorHandler.handleGracefulShutdown();

    // 404 handler
    this.app.use(globalErrorHandler.handleNotFound());

    // Request timeout handler
    this.app.use(globalErrorHandler.handleTimeout(this.envConfig.getServerConfig().requestTimeout));

    // Global error handler (must be last)
    this.app.use(globalErrorHandler.handleErrors());

    this.logger.info('Error handling initialized');
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting Spotify API server...');

      // Initialize all components in order
      await this.initializeDatabase();
      await this.initializeDependencies();
      this.initializeSecurity();
      this.initializeLogging();
      this.initializeRoutes();
      this.initializeDocumentation();
      this.initializeErrorHandling();

      // Start HTTP server
      const serverConfig = this.envConfig.getServerConfig();

      this.server = this.app.listen(serverConfig.port, serverConfig.host, () => {
        this.logger.info('🚀 Spotify API server started successfully!', {
          port: serverConfig.port,
          host: serverConfig.host,
          environment: serverConfig.environment,
          version: this.envConfig.getAppConfig().version,
          baseUrl: this.envConfig.getAppConfig().baseUrl,
          swaggerEnabled: serverConfig.enableSwagger,
          metricsEnabled: serverConfig.enableMetrics
        });

        // Log important URLs
        const baseUrl = `http://${serverConfig.host}:${serverConfig.port}`;
        this.logger.info('📋 Important URLs:', {
          api: `${baseUrl}/api`,
          health: `${baseUrl}/api/health`,
          docs: serverConfig.enableSwagger ? `${baseUrl}/api/docs` : 'disabled',
          metrics: `${baseUrl}/api/metrics`
        });

        // Log security status
        this.logger.info('🔒 Security Status:', {
          environment: serverConfig.environment,
          httpsOnly: this.envConfig.isProduction(),
          corsEnabled: true,
          rateLimitingEnabled: true,
          authenticationRequired: true,
          inputValidationEnabled: true,
          auditLoggingEnabled: true
        });
      });

      // Handle server errors
      this.server.on('error', (error: Error) => {
        this.logger.error('Server error occurred', error);
        process.exit(1);
      });
    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  /**
   * Stop the server gracefully
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Spotify API server...');

    return new Promise(resolve => {
      if (this.server) {
        this.server.close(async () => {
          // Cleanup DI container
          if (this.diContainer) {
            await DIContainerFactory.cleanup();
          }

          // Close database connections
          if (this.dbAdapter) {
            await this.dbAdapter.close();
          }

          // Close logger
          if (this.logger) {
            await this.logger.flush();
            this.logger.close();
          }

          this.logger.info('Spotify API server stopped gracefully');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * Get logger instance
   */
  public getLogger(): WinstonLogger {
    return this.logger;
  }

  /**
   * Get database adapter
   */
  public getDatabase(): PostgreSQLAdapter {
    return this.dbAdapter;
  }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new SpotifyAPIServer();

  server.start().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Handle process termination
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}

export { SpotifyAPIServer };
