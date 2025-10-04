/**
 * Song Controller
 * Handles song operations
 */

import { Request, Response } from 'express';
import { Logger } from '../../logging/WinstonLogger';
import { PostgreSQLAdapter } from '../../database/adapters/PostgreSQLAdapter';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

export class SongController {
  private dbAdapter: PostgreSQLAdapter;
  private logger: Logger;

  constructor(dbAdapter: PostgreSQLAdapter, logger: Logger) {
    this.dbAdapter = dbAdapter;
    this.logger = logger;
  }

  public listSongs = async (req: Request, res: Response): Promise<void> => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        genre, 
        artist, 
        album,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      let whereClause = 'WHERE s.is_public = true';
      const queryParams: any[] = [];
      let paramCount = 0;

      // Add search filters
      if (search) {
        paramCount++;
        whereClause += ` AND (s.title ILIKE $${paramCount} OR a.stage_name ILIKE $${paramCount})`;
        queryParams.push(`%${search}%`);
      }

      if (artist) {
        paramCount++;
        whereClause += ` AND a.stage_name ILIKE $${paramCount}`;
        queryParams.push(`%${artist}%`);
      }

      if (album) {
        paramCount++;
        whereClause += ` AND al.title ILIKE $${paramCount}`;
        queryParams.push(`%${album}%`);
      }

      // Validate sort parameters
      const allowedSortFields = ['created_at', 'title', 'play_count', 'duration'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const validSortBy = allowedSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const validSortOrder = allowedSortOrders.includes((sortOrder as string).toUpperCase()) ? 
        (sortOrder as string).toUpperCase() : 'DESC';

      const query = `
        SELECT 
          s.id, s.title, s.duration, s.file_path, s.file_size, 
          s.mime_type, s.play_count, s.created_at,
          a.id as artist_id, a.stage_name as artist_name,
          al.id as album_id, al.title as album_title
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        ${whereClause}
        ORDER BY s.${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(parseInt(limit as string), offset);

      const result = await this.dbAdapter.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        ${whereClause}
      `;

      const countResult = await this.dbAdapter.query(
        countQuery, 
        queryParams.slice(0, -2) // Remove limit and offset
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit as string));

      res.json({
        songs: result.rows.map((song: any) => ({
          id: song.id,
          title: song.title,
          duration: song.duration,
          playCount: song.play_count,
          createdAt: song.created_at,
          artist: song.artist_name ? {
            id: song.artist_id,
            name: song.artist_name
          } : null,
          album: song.album_title ? {
            id: song.album_id,
            title: song.album_title
          } : null,
          streaming: {
            streamUrl: `/api/songs/${song.id}/stream`,
            downloadUrl: `/api/songs/${song.id}/download`,
            playerUrl: `/api/songs/${song.id}/player`
          }
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
      this.logger.error('Failed to get songs', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public listMySongs = async (req: Request, res: Response): Promise<void> => {
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
        album,
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
          songs: [],
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
      
      let whereClause = 'WHERE s.artist_id = $1';
      const queryParams: any[] = [artistId];
      let paramCount = 1;

      // Add search filters
      if (search) {
        paramCount++;
        whereClause += ` AND s.title ILIKE $${paramCount}`;
        queryParams.push(`%${search}%`);
      }

      if (album) {
        paramCount++;
        whereClause += ` AND al.title ILIKE $${paramCount}`;
        queryParams.push(`%${album}%`);
      }

      // Validate sort parameters
      const allowedSortFields = ['created_at', 'title', 'play_count', 'duration'];
      const allowedSortOrders = ['ASC', 'DESC'];
      
      const validSortBy = allowedSortFields.includes(sortBy as string) ? sortBy : 'created_at';
      const validSortOrder = allowedSortOrders.includes((sortOrder as string).toUpperCase()) ? 
        (sortOrder as string).toUpperCase() : 'DESC';

      const query = `
        SELECT 
          s.id, s.title, s.duration, s.file_path, s.file_size, 
          s.mime_type, s.play_count, s.is_public, s.created_at,
          a.id as artist_id, a.stage_name as artist_name,
          al.id as album_id, al.title as album_title
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        ${whereClause}
        ORDER BY s.${validSortBy} ${validSortOrder}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(parseInt(limit as string), offset);

      const result = await this.dbAdapter.query(query, queryParams);

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        ${whereClause}
      `;

      const countResult = await this.dbAdapter.query(
        countQuery, 
        queryParams.slice(0, -2) // Remove limit and offset
      );

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit as string));

      res.json({
        songs: result.rows.map((song: any) => ({
          id: song.id,
          title: song.title,
          duration: song.duration,
          playCount: song.play_count,
          isPublic: song.is_public,
          createdAt: song.created_at,
          artist: song.artist_name ? {
            id: song.artist_id,
            name: song.artist_name
          } : null,
          album: song.album_title ? {
            id: song.album_id,
            title: song.album_title
          } : null,
          streaming: {
            streamUrl: `/api/songs/${song.id}/stream`,
            downloadUrl: `/api/songs/${song.id}/download`,
            playerUrl: `/api/songs/${song.id}/player`
          }
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
      this.logger.error('Failed to get user songs', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public getSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Song ID is required'
        });
        return;
      }

      const result = await this.dbAdapter.query(
        `SELECT 
           s.id, s.title, s.duration, s.file_path, s.file_size, 
           s.mime_type, s.play_count, s.is_public, s.created_at, s.updated_at,
           a.id as artist_id, a.stage_name as artist_name, a.bio as artist_bio,
           al.id as album_id, al.title as album_title, al.release_date as album_release_date
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         WHERE s.id = $1 AND s.is_public = true`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Song not found'
        });
        return;
      }

      const song = result.rows[0];

      // Increment play count
      await this.dbAdapter.query(
        'UPDATE songs SET play_count = play_count + 1 WHERE id = $1',
        [id]
      );

      res.json({
        song: {
          id: song.id,
          title: song.title,
          duration: song.duration,
          fileSize: song.file_size,
          mimeType: song.mime_type,
          playCount: song.play_count + 1, // Include the increment
          isPublic: song.is_public,
          createdAt: song.created_at,
          updatedAt: song.updated_at,
          artist: song.artist_name ? {
            id: song.artist_id,
            name: song.artist_name,
            bio: song.artist_bio
          } : null,
          album: song.album_title ? {
            id: song.album_id,
            title: song.album_title,
            releaseDate: song.album_release_date
          } : null
        }
      });

    } catch (error) {
      this.logger.error('Failed to get song', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public streamSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Song ID is required'
        });
        return;
      }

      // Get song info from database
      const result = await this.dbAdapter.query(
        `SELECT s.id, s.title, s.file_path, s.file_size, s.mime_type, s.is_public,
                a.stage_name as artist_name
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         WHERE s.id = $1 AND s.is_public = true`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Song not found or not available for streaming'
        });
        return;
      }

      const song = result.rows[0];
      const filePath = path.join(process.cwd(), song.file_path);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        this.logger.error('Song file not found on disk', {
          songId: id,
          filePath: song.file_path
        });
        
        res.status(404).json({
          error: 'Song file not found'
        });
        return;
      }

      // Get file stats for range requests
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Increment play count
      await this.dbAdapter.query(
        'UPDATE songs SET play_count = play_count + 1 WHERE id = $1',
        [id]
      );

      // Log streaming event
      this.logger.info('Song streaming started', {
        songId: id,
        title: song.title,
        artist: song.artist_name,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasRange: !!range
      });

      if (range) {
        // Handle range requests for audio streaming
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        if (start >= fileSize || end >= fileSize) {
          res.status(416).json({
            error: 'Range not satisfiable'
          });
          return;
        }

        const file = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': song.mime_type || 'audio/mpeg',
          'Cache-Control': 'public, max-age=3600',
          'X-Song-Title': song.title,
          'X-Artist-Name': song.artist_name || 'Unknown Artist'
        });

        file.pipe(res);
      } else {
        // Serve entire file
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': song.mime_type || 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
          'X-Song-Title': song.title,
          'X-Artist-Name': song.artist_name || 'Unknown Artist'
        });

        const file = fs.createReadStream(filePath);
        file.pipe(res);
      }

    } catch (error) {
      this.logger.error('Failed to stream song', error);
      res.status(500).json({
        error: 'Internal server error during streaming'
      });
    }
  };

  public downloadSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Song ID is required'
        });
        return;
      }

      // Get song info from database
      const result = await this.dbAdapter.query(
        `SELECT s.id, s.title, s.file_path, s.file_size, s.mime_type, s.is_public,
                a.stage_name as artist_name
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         WHERE s.id = $1 AND s.is_public = true`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'Song not found or not available for download'
        });
        return;
      }

      const song = result.rows[0];
      const filePath = path.join(process.cwd(), song.file_path);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        this.logger.error('Song file not found on disk', {
          songId: id,
          filePath: song.file_path
        });
        
        res.status(404).json({
          error: 'Song file not found'
        });
        return;
      }

      // Create a safe filename for download
      const artistName = song.artist_name || 'Unknown Artist';
      const safeTitle = song.title.replace(/[^a-zA-Z0-9\s-_]/g, '');
      const safeArtist = artistName.replace(/[^a-zA-Z0-9\s-_]/g, '');
      const fileExtension = path.extname(song.file_path);
      const downloadFilename = `${safeArtist} - ${safeTitle}${fileExtension}`;

      // Log download event
      this.logger.info('Song download started', {
        songId: id,
        title: song.title,
        artist: song.artist_name,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Set headers for download
      res.setHeader('Content-Type', song.mime_type || 'audio/mpeg');
      res.setHeader('Content-Length', song.file_size);
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Song-Title', song.title);
      res.setHeader('X-Artist-Name', song.artist_name || 'Unknown Artist');

      // Stream the file for download
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      // Increment download count (you could add a downloads column to track this)
      await this.dbAdapter.query(
        'UPDATE songs SET play_count = play_count + 1 WHERE id = $1',
        [id]
      );

    } catch (error) {
      this.logger.error('Failed to download song', error);
      res.status(500).json({
        error: 'Internal server error during download'
      });
    }
  };

  public webPlayer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: 'Song ID is required'
        });
        return;
      }

      // Get song info from database
      const result = await this.dbAdapter.query(
        `SELECT s.id, s.title, s.duration, s.play_count, s.is_public,
                a.stage_name as artist_name,
                al.title as album_title
         FROM songs s
         LEFT JOIN artists a ON s.artist_id = a.id
         LEFT JOIN albums al ON s.album_id = al.id
         WHERE s.id = $1 AND s.is_public = true`,
        [id]
      );

      if (result.rows.length === 0) {
        res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Song Not Found</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🎵 Song Not Found</h1>
            <p>The requested song could not be found or is not available for streaming.</p>
          </body>
          </html>
        `);
        return;
      }

      const song = result.rows[0];
      const streamUrl = `/api/songs/${id}/stream`;
      const downloadUrl = `/api/songs/${id}/download`;

      // Generate HTML player
      const playerHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${song.title} - ${song.artist_name || 'Unknown Artist'}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .player-container {
              background: white;
              border-radius: 20px;
              padding: 30px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              max-width: 500px;
              width: 100%;
              text-align: center;
            }
            .song-info {
              margin-bottom: 30px;
            }
            .song-title {
              font-size: 24px;
              font-weight: bold;
              color: #333;
              margin-bottom: 10px;
            }
            .artist-name {
              font-size: 18px;
              color: #666;
              margin-bottom: 5px;
            }
            .album-name {
              font-size: 14px;
              color: #999;
              font-style: italic;
            }
            .audio-player {
              width: 100%;
              margin: 20px 0;
              border-radius: 10px;
            }
            .controls {
              display: flex;
              gap: 15px;
              justify-content: center;
              margin-top: 20px;
            }
            .btn {
              padding: 12px 24px;
              border: none;
              border-radius: 25px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              text-decoration: none;
              display: inline-block;
              transition: all 0.3s ease;
            }
            .btn-primary {
              background: #667eea;
              color: white;
            }
            .btn-primary:hover {
              background: #5a6fd8;
              transform: translateY(-2px);
            }
            .btn-secondary {
              background: #f8f9fa;
              color: #333;
              border: 2px solid #dee2e6;
            }
            .btn-secondary:hover {
              background: #e9ecef;
              transform: translateY(-2px);
            }
            .stats {
              margin-top: 20px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 10px;
              font-size: 14px;
              color: #666;
            }
            .music-icon {
              font-size: 60px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="player-container">
            <div class="music-icon">🎵</div>
            
            <div class="song-info">
              <div class="song-title">${song.title}</div>
              <div class="artist-name">${song.artist_name || 'Unknown Artist'}</div>
              ${song.album_title ? `<div class="album-name">from "${song.album_title}"</div>` : ''}
            </div>

            <audio class="audio-player" controls preload="metadata">
              <source src="${streamUrl}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>

            <div class="controls">
              <a href="${downloadUrl}" class="btn btn-primary" download>
                📥 Download
              </a>
              <a href="/api/songs" class="btn btn-secondary">
                🎵 Browse Songs
              </a>
            </div>

            <div class="stats">
              <div>▶️ Played ${song.play_count} times</div>
              ${song.duration ? `<div>⏱️ Duration: ${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}</div>` : ''}
            </div>
          </div>

          <script>
            // Add some interactivity
            const audio = document.querySelector('audio');
            
            audio.addEventListener('loadstart', () => {
              console.log('🎵 Loading song...');
            });
            
            audio.addEventListener('canplay', () => {
              console.log('🎵 Song ready to play!');
            });
            
            audio.addEventListener('play', () => {
              console.log('▶️ Playing:', '${song.title}');
            });
            
            audio.addEventListener('pause', () => {
              console.log('⏸️ Paused');
            });

            // Update page title when playing
            audio.addEventListener('play', () => {
              document.title = '▶️ ' + '${song.title}' + ' - ' + '${song.artist_name || 'Unknown Artist'}';
            });
            
            audio.addEventListener('pause', () => {
              document.title = '${song.title}' + ' - ' + '${song.artist_name || 'Unknown Artist'}';
            });
          </script>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(playerHTML);

    } catch (error) {
      this.logger.error('Failed to generate web player', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Player Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Player Error</h1>
          <p>There was an error loading the music player.</p>
        </body>
        </html>
      `);
    }
  };

  public uploadSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { title, albumId } = req.body;
      const file = req.file;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      if (!title || !file) {
        res.status(400).json({
          error: 'Title and audio file are required'
        });
        return;
      }

      // Validate file type
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
      const uploadFileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      
      // Accept if MIME type is allowed OR if extension is allowed
      if (!allowedMimeTypes.includes(file.mimetype) && !allowedExtensions.includes(uploadFileExtension)) {
        this.logger.warn('File type validation failed', {
          originalname: file.originalname,
          mimetype: file.mimetype,
          extension: uploadFileExtension
        });
        
        res.status(400).json({
          error: 'Invalid file type. Allowed types: MP3, WAV, FLAC, M4A',
          details: {
            receivedMimeType: file.mimetype,
            receivedExtension: uploadFileExtension,
            allowedMimeTypes: allowedMimeTypes,
            allowedExtensions: allowedExtensions
          }
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

      // Validate album if provided
      if (albumId) {
        const albumResult = await this.dbAdapter.query(
          'SELECT id FROM albums WHERE id = $1 AND artist_id = $2',
          [albumId, artistId]
        );

        if (albumResult.rows.length === 0) {
          res.status(400).json({
            error: 'Album not found or does not belong to this artist'
          });
          return;
        }
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'songs');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(uploadsDir, fileName);

      // Save file
      fs.writeFileSync(filePath, file.buffer);

      // Create song record
      const songId = uuidv4();
      const result = await this.dbAdapter.query(
        `INSERT INTO songs (id, artist_id, album_id, title, duration, file_path, 
                           file_size, mime_type, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
         RETURNING id, title, file_size, mime_type, created_at`,
        [
          songId,
          artistId,
          albumId || null,
          title,
          null, // Duration would be extracted from audio file in real implementation
          `uploads/songs/${fileName}`,
          file.size,
          file.mimetype,
          true
        ]
      );

      const song = result.rows[0];

      this.logger.info('Song uploaded successfully', {
        songId: song.id,
        userId: user.userId,
        artistId,
        title,
        fileSize: file.size,
        ip: req.ip
      });

      res.status(201).json({
        message: 'Song uploaded successfully',
        song: {
          id: song.id,
          title: song.title,
          fileSize: song.file_size,
          mimeType: song.mime_type,
          createdAt: song.created_at
        }
      });

    } catch (error) {
      this.logger.error('Failed to upload song', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public updateSong = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { title, isPublic } = req.body;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: 'Song ID is required'
        });
        return;
      }

      // Check if song exists and belongs to user
      const songResult = await this.dbAdapter.query(
        `SELECT s.id, s.title, s.is_public, a.user_id
         FROM songs s
         JOIN artists a ON s.artist_id = a.id
         WHERE s.id = $1`,
        [id]
      );

      if (songResult.rows.length === 0) {
        res.status(404).json({
          error: 'Song not found'
        });
        return;
      }

      const song = songResult.rows[0];

      if (song.user_id !== user.userId) {
        res.status(403).json({
          error: 'You can only update your own songs'
        });
        return;
      }

      // Update song
      const updateResult = await this.dbAdapter.query(
        `UPDATE songs 
         SET title = COALESCE($1, title), 
             is_public = COALESCE($2, is_public),
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, title, is_public, updated_at`,
        [title || null, isPublic !== undefined ? isPublic : null, id]
      );

      const updatedSong = updateResult.rows[0];

      this.logger.info('Song updated successfully', {
        songId: id,
        userId: user.userId,
        updatedFields: { title, isPublic },
        ip: req.ip
      });

      res.json({
        message: 'Song updated successfully',
        song: {
          id: updatedSong.id,
          title: updatedSong.title,
          isPublic: updatedSong.is_public,
          updatedAt: updatedSong.updated_at
        }
      });

    } catch (error) {
      this.logger.error('Failed to update song', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public deleteSong = async (req: Request, res: Response): Promise<void> => {
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
          error: 'Song ID is required'
        });
        return;
      }

      // Check if song exists and belongs to user
      const songResult = await this.dbAdapter.query(
        `SELECT s.id, s.file_path, a.user_id
         FROM songs s
         JOIN artists a ON s.artist_id = a.id
         WHERE s.id = $1`,
        [id]
      );

      if (songResult.rows.length === 0) {
        res.status(404).json({
          error: 'Song not found'
        });
        return;
      }

      const song = songResult.rows[0];

      if (song.user_id !== user.userId) {
        res.status(403).json({
          error: 'You can only delete your own songs'
        });
        return;
      }

      // Delete song from database
      await this.dbAdapter.query('DELETE FROM songs WHERE id = $1', [id]);

      // Delete file from filesystem
      try {
        const fullFilePath = path.join(process.cwd(), song.file_path);
        if (fs.existsSync(fullFilePath)) {
          fs.unlinkSync(fullFilePath);
        }
      } catch (fileError) {
        this.logger.warn('Failed to delete song file', {
          songId: id,
          filePath: song.file_path,
          error: fileError
        });
      }

      this.logger.info('Song deleted successfully', {
        songId: id,
        userId: user.userId,
        ip: req.ip
      });

      res.json({
        message: 'Song deleted successfully'
      });

    } catch (error) {
      this.logger.error('Failed to delete song', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
}