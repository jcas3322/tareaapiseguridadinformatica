/**
 * Authentication Controller
 * Handles user authentication operations
 */

import { Request, Response } from 'express';
import { Logger } from '../../logging/WinstonLogger';
import { PostgreSQLAdapter } from '../../database/adapters/PostgreSQLAdapter';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';

export class AuthController {
  private dbAdapter: PostgreSQLAdapter;
  private logger: Logger;
  private jwtSecret: string;

  constructor(dbAdapter: PostgreSQLAdapter, logger: Logger) {
    this.dbAdapter = dbAdapter;
    this.logger = logger;
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  }

  public register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      // Validate input
      if (!email || !password || !name) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['email', 'password', 'name']
        });
        return;
      }

      // Check if user already exists
      const existingUser = await this.dbAdapter.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        res.status(409).json({
          error: 'User already exists with this email'
        });
        return;
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const userId = uuidv4();
      const result = await this.dbAdapter.query(
        `INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
         RETURNING id, email, name, role, created_at`,
        [userId, email.toLowerCase(), name, passwordHash, 'user']
      );

      const user = result.rows[0];

      // Generate JWT token
      const tokenPayload = { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      };
      const token = jwt.sign(tokenPayload, this.jwtSecret, { expiresIn: '1h' });

      // Generate refresh token
      const refreshPayload = { userId: user.id, type: 'refresh' };
      const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, { expiresIn: '7d' });

      this.logger.info('User registered successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.created_at
        },
        token,
        refreshToken
      });

    } catch (error) {
      this.logger.error('Registration failed', error);
      res.status(500).json({
        error: 'Internal server error during registration'
      });
    }
  };

  public login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({
          error: 'Email and password are required'
        });
        return;
      }

      // Find user
      const result = await this.dbAdapter.query(
        'SELECT id, email, name, password_hash, role, is_active FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        res.status(401).json({
          error: 'Invalid credentials'
        });
        return;
      }

      const user = result.rows[0];

      // Check if account is active
      if (!user.is_active) {
        res.status(401).json({
          error: 'Account is deactivated'
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        res.status(401).json({
          error: 'Invalid credentials'
        });
        return;
      }

      // Update last login
      await this.dbAdapter.query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
      const tokenPayload = { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      };
      const token = jwt.sign(tokenPayload, this.jwtSecret, { expiresIn: '1h' });

      // Generate refresh token
      const refreshPayload = { userId: user.id, type: 'refresh' };
      const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, { expiresIn: '7d' });

      this.logger.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token,
        refreshToken
      });

    } catch (error) {
      this.logger.error('Login failed', error);
      res.status(500).json({
        error: 'Internal server error during login'
      });
    }
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as any).user;

      if (user) {
        this.logger.info('User logged out', {
          userId: user.userId,
          ip: req.ip
        });
      }

      res.json({
        message: 'Logout successful'
      });

    } catch (error) {
      this.logger.error('Logout failed', error);
      res.status(500).json({
        error: 'Internal server error during logout'
      });
    }
  };

  public refresh = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: 'Refresh token is required'
        });
        return;
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as any;

      if (decoded.type !== 'refresh') {
        res.status(401).json({
          error: 'Invalid refresh token'
        });
        return;
      }

      // Get user info
      const result = await this.dbAdapter.query(
        'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        res.status(401).json({
          error: 'User not found or inactive'
        });
        return;
      }

      const user = result.rows[0];

      // Generate new access token
      const tokenPayload = { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      };
      const newToken = jwt.sign(tokenPayload, this.jwtSecret, { expiresIn: '1h' });

      res.json({
        message: 'Token refreshed successfully',
        token: newToken
      });

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          error: 'Invalid refresh token'
        });
      } else {
        this.logger.error('Token refresh failed', error);
        res.status(500).json({
          error: 'Internal server error during token refresh'
        });
      }
    }
  };
}