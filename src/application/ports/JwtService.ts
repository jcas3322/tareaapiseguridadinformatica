/**
 * JwtService Port
 * Interface for JWT token operations
 */

export interface JwtPayload {
  readonly sub: string; // Subject (user ID)
  readonly email: string;
  readonly username: string;
  readonly role: string;
  readonly iat: number; // Issued at
  readonly exp: number; // Expiration
  readonly iss: string; // Issuer
  readonly aud: string; // Audience
  readonly type: 'access' | 'refresh';
}

export interface JwtTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresIn: number; // seconds
  readonly refreshExpiresIn: number; // seconds
}

export interface JwtService {
  /**
   * Generate access and refresh tokens for a user
   */
  generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<JwtTokens>;

  /**
   * Generate only an access token
   */
  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<string>;

  /**
   * Generate only a refresh token
   */
  generateRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'type'>): Promise<string>;

  /**
   * Verify and decode a JWT token
   */
  verifyToken(token: string): Promise<JwtPayload>;

  /**
   * Verify specifically an access token
   */
  verifyAccessToken(token: string): Promise<JwtPayload>;

  /**
   * Verify specifically a refresh token
   */
  verifyRefreshToken(token: string): Promise<JwtPayload>;

  /**
   * Refresh an access token using a refresh token
   */
  refreshAccessToken(refreshToken: string): Promise<string>;

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null;

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null;

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean;

  /**
   * Revoke a token (add to blacklist)
   */
  revokeToken(token: string): Promise<void>;

  /**
   * Check if token is revoked
   */
  isTokenRevoked(token: string): Promise<boolean>;
}