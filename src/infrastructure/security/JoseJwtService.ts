/**
 * JoseJwtService
 * Secure JWT implementation using the JOSE library
 */

import * as jose from 'jose';
import { JwtService, JwtPayload, JwtTokens } from '../../application/ports/JwtService';

export interface JwtConfig {
  readonly accessTokenSecret: string;
  readonly refreshTokenSecret: string;
  readonly accessTokenExpiresIn: string; // e.g., '15m'
  readonly refreshTokenExpiresIn: string; // e.g., '7d'
  readonly issuer: string;
  readonly audience: string;
  readonly algorithm: string; // e.g., 'HS256'
}

export class JoseJwtService implements JwtService {
  private readonly config: JwtConfig;
  private readonly accessTokenKey: Uint8Array;
  private readonly refreshTokenKey: Uint8Array;
  private readonly revokedTokens = new Set<string>(); // In production, use Redis or database

  constructor(config: JwtConfig) {
    this.validateConfig(config);
    this.config = config;
    
    // Convert secrets to Uint8Array for JOSE
    this.accessTokenKey = new TextEncoder().encode(config.accessTokenSecret);
    this.refreshTokenKey = new TextEncoder().encode(config.refreshTokenSecret);
  }

  public async generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<JwtTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(payload),
      this.generateRefreshToken(payload)
    ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresIn: this.parseExpirationToSeconds(this.config.accessTokenExpiresIn),
      refreshExpiresIn: this.parseExpirationToSeconds(this.config.refreshTokenExpiresIn)
    };
  }

  public async generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpirationToSeconds(this.config.accessTokenExpiresIn);

    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp,
      iss: this.config.issuer,
      aud: this.config.audience,
      type: 'access'
    };

    try {
      return await new jose.SignJWT(fullPayload)
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setIssuer(this.config.issuer)
        .setAudience(this.config.audience)
        .sign(this.accessTokenKey);
    } catch (error) {
      throw new Error('Failed to generate access token');
    }
  }

  public async generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseExpirationToSeconds(this.config.refreshTokenExpiresIn);

    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp,
      iss: this.config.issuer,
      aud: this.config.audience,
      type: 'refresh'
    };

    try {
      return await new jose.SignJWT(fullPayload)
        .setProtectedHeader({ alg: this.config.algorithm })
        .setIssuedAt(now)
        .setExpirationTime(exp)
        .setIssuer(this.config.issuer)
        .setAudience(this.config.audience)
        .sign(this.refreshTokenKey);
    } catch (error) {
      throw new Error('Failed to generate refresh token');
    }
  }

  public async verifyToken(token: string): Promise<JwtPayload> {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }

    if (await this.isTokenRevoked(token)) {
      throw new Error('Token has been revoked');
    }

    try {
      // Try access token first
      try {
        return await this.verifyAccessToken(token);
      } catch {
        // If access token verification fails, try refresh token
        return await this.verifyRefreshToken(token);
      }
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  public async verifyAccessToken(token: string): Promise<JwtPayload> {
    if (!token || typeof token !== 'string') {
      throw new Error('Access token must be a non-empty string');
    }

    if (await this.isTokenRevoked(token)) {
      throw new Error('Access token has been revoked');
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.accessTokenKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm]
      });

      const jwtPayload = payload as JwtPayload;

      if (jwtPayload.type !== 'access') {
        throw new Error('Token is not an access token');
      }

      this.validatePayload(jwtPayload);
      return jwtPayload;
    } catch (error) {
      if (error instanceof Error && error.message.includes('revoked')) {
        throw error;
      }
      throw new Error('Invalid or expired access token');
    }
  }

  public async verifyRefreshToken(token: string): Promise<JwtPayload> {
    if (!token || typeof token !== 'string') {
      throw new Error('Refresh token must be a non-empty string');
    }

    if (await this.isTokenRevoked(token)) {
      throw new Error('Refresh token has been revoked');
    }

    try {
      const { payload } = await jose.jwtVerify(token, this.refreshTokenKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm]
      });

      const jwtPayload = payload as JwtPayload;

      if (jwtPayload.type !== 'refresh') {
        throw new Error('Token is not a refresh token');
      }

      this.validatePayload(jwtPayload);
      return jwtPayload;
    } catch (error) {
      if (error instanceof Error && error.message.includes('revoked')) {
        throw error;
      }
      throw new Error('Invalid or expired refresh token');
    }
  }

  public async refreshAccessToken(refreshToken: string): Promise<string> {
    const payload = await this.verifyRefreshToken(refreshToken);
    
    // Generate new access token with same user data
    return this.generateAccessToken({
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      role: payload.role
    });
  }

  public decodeToken(token: string): JwtPayload | null {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const decoded = jose.decodeJwt(token);
      return decoded as JwtPayload;
    } catch {
      return null;
    }
  }

  public getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  public isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }

    return expiration.getTime() <= Date.now();
  }

  public async revokeToken(token: string): Promise<void> {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a non-empty string');
    }

    // In production, store in Redis with expiration time
    this.revokedTokens.add(token);
    
    // Optional: Store token hash instead of full token for privacy
    const tokenHash = await this.hashToken(token);
    this.revokedTokens.add(tokenHash);
  }

  public async isTokenRevoked(token: string): Promise<boolean> {
    if (!token || typeof token !== 'string') {
      return true;
    }

    // Check both token and its hash
    const tokenHash = await this.hashToken(token);
    return this.revokedTokens.has(token) || this.revokedTokens.has(tokenHash);
  }

  private validateConfig(config: JwtConfig): void {
    if (!config.accessTokenSecret || config.accessTokenSecret.length < 32) {
      throw new Error('Access token secret must be at least 32 characters');
    }

    if (!config.refreshTokenSecret || config.refreshTokenSecret.length < 32) {
      throw new Error('Refresh token secret must be at least 32 characters');
    }

    if (config.accessTokenSecret === config.refreshTokenSecret) {
      throw new Error('Access and refresh token secrets must be different');
    }

    if (!config.issuer || config.issuer.trim().length === 0) {
      throw new Error('Issuer is required');
    }

    if (!config.audience || config.audience.trim().length === 0) {
      throw new Error('Audience is required');
    }

    const supportedAlgorithms = ['HS256', 'HS384', 'HS512'];
    if (!supportedAlgorithms.includes(config.algorithm)) {
      throw new Error(`Algorithm must be one of: ${supportedAlgorithms.join(', ')}`);
    }

    // Validate expiration formats
    if (!this.isValidExpirationFormat(config.accessTokenExpiresIn)) {
      throw new Error('Invalid access token expiration format');
    }

    if (!this.isValidExpirationFormat(config.refreshTokenExpiresIn)) {
      throw new Error('Invalid refresh token expiration format');
    }
  }

  private validatePayload(payload: JwtPayload): void {
    const requiredFields = ['sub', 'email', 'username', 'role', 'iat', 'exp', 'iss', 'aud', 'type'];
    
    for (const field of requiredFields) {
      if (!(field in payload)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
      throw new Error('Subject must be a non-empty string');
    }

    if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
      throw new Error('Email must be a non-empty string');
    }

    if (typeof payload.username !== 'string' || payload.username.trim().length === 0) {
      throw new Error('Username must be a non-empty string');
    }

    if (typeof payload.role !== 'string' || payload.role.trim().length === 0) {
      throw new Error('Role must be a non-empty string');
    }

    if (typeof payload.iat !== 'number' || payload.iat <= 0) {
      throw new Error('Issued at must be a positive number');
    }

    if (typeof payload.exp !== 'number' || payload.exp <= 0) {
      throw new Error('Expiration must be a positive number');
    }

    if (payload.exp <= payload.iat) {
      throw new Error('Expiration must be after issued at');
    }
  }

  private isValidExpirationFormat(expiration: string): boolean {
    // Support formats like: 15m, 1h, 7d, 30s
    const expirationRegex = /^\d+[smhd]$/;
    return expirationRegex.test(expiration);
  }

  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error('Invalid expiration unit');
    }
  }

  private async hashToken(token: string): Promise<string> {
    // Use Web Crypto API for hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clean up expired revoked tokens (should be called periodically)
   */
  public cleanupRevokedTokens(): void {
    // In production, this would clean up expired tokens from Redis/database
    // For in-memory implementation, we can't easily determine expiration
    // without decoding each token, so this is a placeholder
    console.log('Cleanup revoked tokens - implement with persistent storage');
  }

  /**
   * Get token statistics for monitoring
   */
  public getTokenStats(): { revokedCount: number } {
    return {
      revokedCount: this.revokedTokens.size
    };
  }
}