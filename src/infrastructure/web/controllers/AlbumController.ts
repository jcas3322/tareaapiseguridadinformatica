/**
 * Album Controller
 * Handles album operations
 */

import { Request, Response } from 'express';
import { Logger } from '../../logging/WinstonLogger';
import { PostgreSQLAdapter } from '../../database/adapters/PostgreSQLAdapter';
import { v4 as uuidv4 } from 'uuid';

export class AlbumController {
  private dbAdapter: PostgreSQLAdapter;
  private logger: Logger;

  constructor(dbAdapter: PostgreSQLAdapter, logger: Logger) {
    this.dbAdapter = dbAdapter;
    this.logger = logger;
  }

  public listAlbums = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        artist, 
        genre,
        year,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      let whereClause = 'WHERE al.is_public = true';
      const queryParams: any[] = [];
      let paramCount = 0;

      // Add search filters
      if (search) {
        paramCount++;
        whereClause += ` AND (al.title ILIKE $${paramCount} OR al.description ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      if (artist) {
        paramCount++;
        whereClause += ` AND a.stage_name ILIKE $${paramCount}`;
        queryParams.push(`%${artist}%`);
      }

      if (genre) {
        paramCount++;
        whereClause += ` AND al.genre ILIKE $${paramCount}`;
        queryParams.push(`%${genre}%`);
      }

      if (year) {
        paramCount++;
        whereClause += ` AND EXTRACT(YEAR FROM al.release_date) = $${paramCount}`;
        queryParams.push(parseInt(year as string));
      }

      // Validate sort parameters
      const allowedSortFields = ['created_at', 'title', 'release_date'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const validSortBy = allowedSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const validSortOrder = allowedSortOrders.includes((sortOrder as string).toUpperCase()) ? 
        (sortOrder as string).toUpperCase() : 'DESC';

      const query = `
        SELECT 
          al.id, al.title, al.description, al.cover_image, al.release_date, 
          al.genre, al.created_at,
          a.id as artist_id, a.stage_name as artist_name,
          COUNT(s.id) as song_count
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        LEFT JOIN songs s ON al.id = s.album_id
        ${whereClause}
        GROUP BY al.id, a.id, a.stage_name
        ORDER BY al.${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(parseInt(limit as string), offset);

      const result = await this.dbAdapter.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT al.id) as total
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        ${whereClause}
      `;

      const countResult = await this.dbAdapter.query(
        countQuery, 
        queryParams.slice(0, -2) // Remove limit and offset
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit as string));

      res.json({
        albums: result.rows.map((album: any) => ({
          id: album.id,
          title: album.title,
          description: album.description,
          coverImage: album.cover_image,
          releaseDate: album.release_date,
          genre: album.genre,
          createdAt: album.created_at,
          songCount: parseInt(album.song_count),
          artist: album.artist_name ? {
            id: album.artist_id,
            name: album.artist_name
          } : null
        })),
        pagination: {
          currentPage: parseInt(page as string),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit as string),
          hasNextPage: parseInt(page as string) < totalPages,
          hasPreviousPage: parseInt(page as string) > 1
        }
      });

    } catch (error) {
      this.logger.error('Failed to get albums', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public listMyAlbums = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      
      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      const { 
        page = 1, 
        limit = 20, 
        search, 
        genre,
        year,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      // Get user's artist ID first
      const artistResult = await this.dbAdapter.query(
        'SELECT id FROM artists WHERE user_id = $1',
        [user.userId]
      );

      if (artistResult.rows.length === 0) {
        // User has no artist profile, return empty results
        res.json({
          albums: [],
          pagination: {
            currentPage: parseInt(page as string),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit as string),
            hasNextPage: false,
            hasPreviousPage: false
          }
        });
        return;
      }

      const artistId = artistResult.rows[0].id;
      
      let whereClause = 'WHERE al.artist_id = $1';
      const queryParams: any[] = [artistId];
      let paramCount = 1;

      // Add search filters
      if (search) {
        paramCount++;
        whereClause += ` AND (al.title ILIKE $${paramCount} OR al.description ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      if (genre) {
        paramCount++;
        whereClause += ` AND al.genre ILIKE $${paramCount}`;
        queryParams.push(`%${genre}%`);
      }

      if (year) {
        paramCount++;
        whereClause += ` AND EXTRACT(YEAR FROM al.release_date) = $${paramCount}`;
        queryParams.push(parseInt(year as string));
      }

      // Validate sort parameters
      const allowedSortFields = ['created_at', 'title', 'release_date'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const validSortBy = allowedSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const validSortOrder = allowedSortOrders.includes((sortOrder as string).toUpperCase()) ? 
        (sortOrder as string).toUpperCase() : 'DESC';

      const query = `
        SELECT 
          al.id, al.title, al.description, al.cover_image, al.release_date, 
          al.genre, al.is_public, al.created_at,
          a.id as artist_id, a.stage_name as artist_name,
          COUNT(s.id) as song_count
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        LEFT JOIN songs s ON al.id = s.album_id
        ${whereClause}
        GROUP BY al.id, a.id, a.stage_name
        ORDER BY al.${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(parseInt(limit as string), offset);

      const result = await this.dbAdapter.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT al.id) as total
        FROM albums al
        LEFT JOIN artists a ON al.artist_id = a.id
        ${whereClause}
      `;

      const countResult = await this.dbAdapter.query(
        countQuery, 
        queryParams.slice(0, -2) // Remove limit and offset
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit as string));

      res.json({
        albums: result.rows.map((album: any) => ({
          id: album.id,
          title: album.title,
          description: album.description,
          coverImage: album.cover_image,
          releaseDate: album.release_date,
          genre: album.genre,
          isPublic: album.is_public,
          createdAt: album.created_at,
          songCount: parseInt(album.song_count),
          artist: album.artist_name ? {
            id: album.artist_id,
            name: album.artist_name
          } : null
        })),
        pagination: {
          currentPage: parseInt(page as string),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit as string),
          hasNextPage: parseInt(page as string) < totalPages,
          hasPreviousPage: parseInt(page as string) > 1
        }
      });

    } catch (error) {
      this.logger.error('Failed to get user albums', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public getAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Album ID is required'
        });
        return;
      }

      // Get album details
      const albumResult = await this.dbAdapter.query(
        `SELECT 
           al.id, al.title, al.description, al.cover_image, al.release_date, 
           al.genre, al.is_public, al.created_at, al.updated_at,
           a.id as artist_id, a.stage_name as artist_name, a.bio as artist_bio
         FROM albums al
         LEFT JOIN artists a ON al.artist_id = a.id
         WHERE al.id = $1 AND al.is_public = true`,
        [id]
      );

      if (albumResult.rows.length === 0) {
        res.status(404).json({
          error: 'Album not found'
        });
        return;
      }

      const album = albumResult.rows[0];

      // Get album songs
      const songsResult = await this.dbAdapter.query(
        `SELECT 
           s.id, s.title, s.duration, s.play_count, s.created_at
         FROM songs s
         WHERE s.album_id = $1 AND s.is_public = true
         ORDER BY s.created_at ASC`,
        [id]
      );

      res.json({
        album: {
          id: album.id,
          title: album.title,
          description: album.description,
          coverImage: album.cover_image,
          releaseDate: album.release_date,
          genre: album.genre,
          isPublic: album.is_public,
          createdAt: album.created_at,
          updatedAt: album.updated_at,
          artist: album.artist_name ? {
            id: album.artist_id,
            name: album.artist_name,
            bio: album.artist_bio
          } : null,
          songs: songsResult.rows.map((song: any) => ({
            id: song.id,
            title: song.title,
            duration: song.duration,
            playCount: song.play_count,
            createdAt: song.created_at
          })),
          songCount: songsResult.rows.length
        }
      });

    } catch (error) {
      this.logger.error('Failed to get album', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public createAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { title, description, releaseDate, genre } = req.body;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      if (!title) {
        res.status(400).json({
          error: 'Album title is required'
        });
        return;
      }

      // Validate release date if provided
      if (releaseDate && isNaN(Date.parse(releaseDate))) {
        res.status(400).json({
          error: 'Invalid release date format'
        });
        return;
      }

      // Get or create artist profile for user
      let artistResult = await this.dbAdapter.query(
        'SELECT id FROM artists WHERE user_id = $1',
        [user.userId]
      );

      let artistId;
      if (artistResult.rows.length === 0) {
        // Create artist profile
        const newArtistId = uuidv4();
        await this.dbAdapter.query(
          'INSERT INTO artists (id, user_id, stage_name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [newArtistId, user.userId, `Artist_${user.userId.substring(0, 8)}`]
        );
        artistId = newArtistId;
      } else {
        artistId = artistResult.rows[0].id;
      }

      // Check if album with same title already exists for this artist
      const existingAlbum = await this.dbAdapter.query(
        'SELECT id FROM albums WHERE artist_id = $1 AND title = $2',
        [artistId, title]
      );

      if (existingAlbum.rows.length > 0) {
        res.status(409).json({
          error: 'Album with this title already exists'
        });
        return;
      }

      // Create album
      const albumId = uuidv4();
      const result = await this.dbAdapter.query(
        `INSERT INTO albums (id, artist_id, title, description, release_date, 
                            genre, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, title, description, release_date, genre, created_at`,
        [
          albumId,
          artistId,
          title,
          description || null,
          releaseDate ? new Date(releaseDate) : null,
          genre || null,
          true
        ]
      );

      const album = result.rows[0];

      this.logger.info('Album created successfully', {
        albumId: album.id,
        userId: user.userId,
        artistId,
        title,
        ip: req.ip
      });

      res.status(201).json({
        message: 'Album created successfully',
        album: {
          id: album.id,
          title: album.title,
          description: album.description,
          releaseDate: album.release_date,
          genre: album.genre,
          createdAt: album.created_at
        }
      });

    } catch (error) {
      this.logger.error('Failed to create album', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public updateAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { title, description, releaseDate, genre, isPublic } = req.body;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: 'Album ID is required'
        });
        return;
      }

      // Validate release date if provided
      if (releaseDate && isNaN(Date.parse(releaseDate))) {
        res.status(400).json({
          error: 'Invalid release date format'
        });
        return;
      }

      // Check if album exists and belongs to user
      const albumResult = await this.dbAdapter.query(
        `SELECT al.id, al.title, a.user_id
         FROM albums al
         JOIN artists a ON al.artist_id = a.id
         WHERE al.id = $1`,
        [id]
      );

      if (albumResult.rows.length === 0) {
        res.status(404).json({
          error: 'Album not found'
        });
        return;
      }

      const album = albumResult.rows[0];

      if (album.user_id !== user.userId) {
        res.status(403).json({
          error: 'You can only update your own albums'
        });
        return;
      }

      // Update album
      const updateResult = await this.dbAdapter.query(
        `UPDATE albums 
         SET title = COALESCE($1, title), 
             description = COALESCE($2, description),
             release_date = COALESCE($3, release_date),
             genre = COALESCE($4, genre),
             is_public = COALESCE($5, is_public),
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, title, description, release_date, genre, is_public, updated_at`,
        [
          title || null, 
          description !== undefined ? description : null,
          releaseDate ? new Date(releaseDate) : null,
          genre || null,
          isPublic !== undefined ? isPublic : null,
          id
        ]
      );

      const updatedAlbum = updateResult.rows[0];

      this.logger.info('Album updated successfully', {
        albumId: id,
        userId: user.userId,
        updatedFields: { title, description, releaseDate, genre, isPublic },
        ip: req.ip
      });

      res.json({
        message: 'Album updated successfully',
        album: {
          id: updatedAlbum.id,
          title: updatedAlbum.title,
          description: updatedAlbum.description,
          releaseDate: updatedAlbum.release_date,
          genre: updatedAlbum.genre,
          isPublic: updatedAlbum.is_public,
          updatedAt: updatedAlbum.updated_at
        }
      });

    } catch (error) {
      this.logger.error('Failed to update album', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public deleteAlbum = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: 'Album ID is required'
        });
        return;
      }

      // Check if album exists and belongs to user
      const albumResult = await this.dbAdapter.query(
        `SELECT al.id, a.user_id, COUNT(s.id) as song_count
         FROM albums al
         JOIN artists a ON al.artist_id = a.id
         LEFT JOIN songs s ON al.id = s.album_id
         WHERE al.id = $1
         GROUP BY al.id, a.user_id`,
        [id]
      );

      if (albumResult.rows.length === 0) {
        res.status(404).json({
          error: 'Album not found'
        });
        return;
      }

      const album = albumResult.rows[0];

      if (album.user_id !== user.userId) {
        res.status(403).json({
          error: 'You can only delete your own albums'
        });
        return;
      }

      // Check if album has songs
      if (parseInt(album.song_count) > 0) {
        res.status(400).json({
          error: 'Cannot delete album that contains songs. Please delete all songs first.',
          songCount: parseInt(album.song_count)
        });
        return;
      }

      // Delete album
      await this.dbAdapter.query('DELETE FROM albums WHERE id = $1', [id]);

      this.logger.info('Album deleted successfully', {
        albumId: id,
        userId: user.userId,
        ip: req.ip
      });

      res.json({
        message: 'Album deleted successfully'
      });

    } catch (error) {
      this.logger.error('Failed to delete album', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
}