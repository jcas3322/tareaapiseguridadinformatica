/**
 * Music Routes
 * Real implementation with authentication, validation and rate limiting
 */

import { Router } from 'express';
import { SongController } from '../controllers/SongController';
import { AlbumController } from '../controllers/AlbumController';
import { AuthenticationMiddleware } from '../../../shared/middleware/AuthenticationMiddleware';
import { ValidationMiddleware } from '../../../shared/middleware/ValidationMiddleware';
import { RateLimitingMiddleware } from '../../../shared/middleware/RateLimitingMiddleware';

export function createMusicRoutes(
  songController: SongController,
  albumController: AlbumController,
  authMiddleware: AuthenticationMiddleware,
  rateLimitMiddleware: RateLimitingMiddleware,
  validationMiddleware: ValidationMiddleware
): Router {
  const router = Router();

  // ===== SONG ROUTES =====

  // List songs (public - only public songs from all users)
  router.get('/songs', 
    rateLimitMiddleware.searchRateLimit(),
    validationMiddleware.validateQuery(ValidationMiddleware.searchSchema),
    songController.listSongs
  );

  // List my songs (private - authenticated user's songs only)
  router.get('/my/songs', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateQuery(ValidationMiddleware.searchSchema),
    songController.listMySongs
  );

  // Upload song (authenticated)
  router.post('/songs', 
    authMiddleware.authenticate,
    rateLimitMiddleware.uploadRateLimit(),
    songController.uploadSong
  );

  // Get specific song (public)
  router.get('/songs/:id', 
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    songController.getSong
  );

  // Stream song audio (public)
  router.get('/songs/:id/stream', 
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    songController.streamSong
  );

  // Download song audio (public)
  router.get('/songs/:id/download', 
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    songController.downloadSong
  );

  // Web player for song (public)
  router.get('/songs/:id/player', 
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    songController.webPlayer
  );

  // Update song (authenticated, owner only)
  router.put('/songs/:id', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    validationMiddleware.validate(ValidationMiddleware.updateSongSchema),
    songController.updateSong
  );

  // Delete song (authenticated, owner only)
  router.delete('/songs/:id', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    songController.deleteSong
  );

  // ===== ALBUM ROUTES =====

  // List albums (public - only public albums from all users)
  router.get('/albums', 
    rateLimitMiddleware.searchRateLimit(),
    validationMiddleware.validateQuery(ValidationMiddleware.searchSchema),
    albumController.listAlbums
  );

  // List my albums (private - authenticated user's albums only)
  router.get('/my/albums', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateQuery(ValidationMiddleware.searchSchema),
    albumController.listMyAlbums
  );

  // Create album (authenticated)
  router.post('/albums', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validate(ValidationMiddleware.createAlbumSchema),
    albumController.createAlbum
  );

  // Get specific album (public)
  router.get('/albums/:id', 
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    albumController.getAlbum
  );

  // Update album (authenticated, owner only)
  router.put('/albums/:id', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    validationMiddleware.validate(ValidationMiddleware.updateAlbumSchema),
    albumController.updateAlbum
  );

  // Delete album (authenticated, owner only)
  router.delete('/albums/:id', 
    authMiddleware.authenticate,
    rateLimitMiddleware.apiRateLimit(),
    validationMiddleware.validateParams(ValidationMiddleware.uuidParamSchema),
    albumController.deleteAlbum
  );

  return router;
}