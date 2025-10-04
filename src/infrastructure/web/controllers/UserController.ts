/**
 * User Controller
 * Handles user profile operations
 */

import { Request, Response } from 'express';
import { Logger } from '../../logging/WinstonLogger';
import { PostgreSQLAdapter } from '../../database/adapters/PostgreSQLAdapter';
import bcrypt from 'bcrypt';

export class UserController {
  private dbAdapter: PostgreSQLAdapter;
  private logger: Logger;

  constructor(dbAdapter: PostgreSQLAdapter, logger: Logger) {
    this.dbAdapter = dbAdapter;
    this.logger = logger;
  }

  public getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      // Get user profile from database
      const result = await this.dbAdapter.query(
        `SELECT id, email, name, role, is_active, email_verified, 
                created_at, updated_at, last_login
         FROM users WHERE id = $1`,
        [user.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          error: 'User not found'
        });
        return;
      }

      const userProfile = result.rows[0];

      // Get user statistics
      const statsResult = await this.dbAdapter.query(
        `SELECT 
           (SELECT COUNT(*) FROM songs WHERE artist_id IN 
            (SELECT id FROM artists WHERE user_id = $1)) as song_count,
           (SELECT COUNT(*) FROM albums WHERE artist_id IN 
            (SELECT id FROM artists WHERE user_id = $1)) as album_count,
           (SELECT COUNT(*) FROM playlists WHERE user_id = $1) as playlist_count`,
        [user.userId]
      );

      const stats = statsResult.rows[0] || { song_count: 0, album_count: 0, playlist_count: 0 };

      this.logger.info('User profile retrieved', {
        userId: user.userId,
        ip: req.ip
      });

      res.json({
        user: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          role: userProfile.role,
          isActive: userProfile.is_active,
          emailVerified: userProfile.email_verified,
          createdAt: userProfile.created_at,
          updatedAt: userProfile.updated_at,
          lastLogin: userProfile.last_login
        },
        statistics: {
          songs: parseInt(stats.song_count),
          albums: parseInt(stats.album_count),
          playlists: parseInt(stats.playlist_count)
        }
      });

    } catch (error) {
      this.logger.error('Failed to get user profile', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { name, currentPassword, newPassword } = req.body;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      // Validate input
      if (!name || name.trim().length < 2) {
        res.status(400).json({
          error: 'Name must be at least 2 characters long'
        });
        return;
      }

      // Get current user data
      const currentUserResult = await this.dbAdapter.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.userId]
      );

      if (currentUserResult.rows.length === 0) {
        res.status(404).json({
          error: 'User not found'
        });
        return;
      }

      let updateQuery = 'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2';
      let queryParams = [name.trim(), user.userId];

      // If password change is requested
      if (newPassword) {
        if (!currentPassword) {
          res.status(400).json({
            error: 'Current password is required to change password'
          });
          return;
        }

        // Validate new password
        if (newPassword.length < 8) {
          res.status(400).json({
            error: 'New password must be at least 8 characters long'
          });
          return;
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(
          currentPassword, 
          currentUserResult.rows[0].password_hash
        );

        if (!isValidPassword) {
          res.status(401).json({
            error: 'Current password is incorrect'
          });
          return;
        }

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
        const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

        updateQuery = 'UPDATE users SET name = $1, password_hash = $2, updated_at = NOW() WHERE id = $3';
        queryParams = [name.trim(), newPasswordHash, user.userId];
      }

      // Update user
      await this.dbAdapter.query(updateQuery, queryParams);

      // Get updated user data
      const updatedUserResult = await this.dbAdapter.query(
        'SELECT id, email, name, role, updated_at FROM users WHERE id = $1',
        [user.userId]
      );

      const updatedUser = updatedUserResult.rows[0];

      this.logger.info('User profile updated', {
        userId: user.userId,
        updatedFields: newPassword ? ['name', 'password'] : ['name'],
        ip: req.ip
      });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          updatedAt: updatedUser.updated_at
        }
      });

    } catch (error) {
      this.logger.error('Failed to update user profile', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };

  public deleteProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;
      const { password, confirmDelete } = req.body;

      if (!user || !user.userId) {
        res.status(401).json({
          error: 'User not authenticated'
        });
        return;
      }

      // Require explicit confirmation
      if (confirmDelete !== 'DELETE_MY_ACCOUNT') {
        res.status(400).json({
          error: 'Account deletion requires explicit confirmation',
          required: 'confirmDelete: "DELETE_MY_ACCOUNT"'
        });
        return;
      }

      if (!password) {
        res.status(400).json({
          error: 'Password is required to delete account'
        });
        return;
      }

      // Get user data
      const userResult = await this.dbAdapter.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [user.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(404).json({
          error: 'User not found'
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password, 
        userResult.rows[0].password_hash
      );

      if (!isValidPassword) {
        res.status(401).json({
          error: 'Password is incorrect'
        });
        return;
      }

      // Use transaction to delete user and related data
      await this.dbAdapter.transaction(async (client) => {
        // Delete user sessions
        await client.query('DELETE FROM user_sessions WHERE user_id = $1', [user.userId]);
        
        // Delete playlists
        await client.query('DELETE FROM playlists WHERE user_id = $1', [user.userId]);
        
        // Delete artist profile and related songs/albums (CASCADE will handle this)
        await client.query('DELETE FROM artists WHERE user_id = $1', [user.userId]);
        
        // Finally delete user
        await client.query('DELETE FROM users WHERE id = $1', [user.userId]);
      });

      this.logger.info('User account deleted', {
        userId: user.userId,
        ip: req.ip
      });

      res.json({
        message: 'Account deleted successfully'
      });

    } catch (error) {
      this.logger.error('Failed to delete user account', error);
      res.status(500).json({
        error: 'Internal server error'
      });
    }
  };
}