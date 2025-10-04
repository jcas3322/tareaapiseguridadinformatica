/**
 * Dependency Injection Container
 * Real implementation with functional controllers and middleware
 */

import { Logger } from '../logging/WinstonLogger';
import { EnvironmentConfig } from '../config/EnvironmentConfig';
import { PostgreSQLAdapter } from '../database/adapters/PostgreSQLAdapter';

// Controllers
import { AuthController } from '../web/controllers/AuthController';
import { UserController } from '../web/controllers/UserController';
import { SongController } from '../web/controllers/SongController';
import { AlbumController } from '../web/controllers/AlbumController';

// Middleware
import { AuthenticationMiddleware } from '../../shared/middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from '../../shared/middleware/ValidationMiddleware';
import { RateLimitingMiddleware } from '../../shared/middleware/RateLimitingMiddleware';

export interface DIContainer {
  authController: AuthController;
  userController: UserController;
  songController: SongController;
  albumController: AlbumController;
  authMiddleware: AuthenticationMiddleware;
  rateLimitMiddleware: RateLimitingMiddleware;
  validationMiddleware: ValidationMiddleware;
}

export class DIContainerFactory {
  public static async create(dependencies: {
    logger: Logger;
    envConfig: EnvironmentConfig;
    dbAdapter: PostgreSQLAdapter;
  }): Promise<DIContainer> {
    
    const { logger, envConfig, dbAdapter } = dependencies;

    // Create real controllers
    const authController = new AuthController(dbAdapter, logger);
    const userController = new UserController(dbAdapter, logger);
    const songController = new SongController(dbAdapter, logger);
    const albumController = new AlbumController(dbAdapter, logger);

    // Create real middleware
    const authMiddleware = new AuthenticationMiddleware(dbAdapter, logger);
    const validationMiddleware = new ValidationMiddleware();
    const rateLimitMiddleware = new RateLimitingMiddleware(logger);

    logger.info('Dependency injection container created with real implementations', {
      controllers: ['AuthController', 'UserController', 'SongController', 'AlbumController'],
      middleware: ['AuthenticationMiddleware', 'ValidationMiddleware', 'RateLimitingMiddleware']
    });

    return {
      authController,
      userController,
      songController,
      albumController,
      authMiddleware,
      rateLimitMiddleware,
      validationMiddleware
    };
  }

  public static async cleanup(): Promise<void> {
    // Cleanup logic here if needed
  }
}