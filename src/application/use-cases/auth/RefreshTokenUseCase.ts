/**
 * Refresh Token Use Case
 * Handles token refresh with security validation
 */

import { IUserRepository } from '../../../domain/repositories/IUserRepository';
import { IJwtService, JwtPayload } from '../../../domain/services/IJwtService';
import { Logger } from '../../../infrastructure/logging/WinstonLogger';

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  message: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly jwtService: IJwtService,
    private readonly logger: Logger
  ) {}

  async execute(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      // Validate input
      if (!request.refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required'
        };
      }

      // Verify refresh token
      let payload: JwtPayload;
      try {
        payload = await this.jwtService.verifyRefreshToken(request.refreshToken);
      } catch (error: any) {
        this.logger.warn('Invalid refresh token provided', {
          error: error.message
        });
        
        return {
          success: false,
          message: 'Invalid or expired refresh token'
        };
      }

      // Find user
      const user = await this.userRepository.findById(payload.sub);
      if (!user) {
        this.logger.warn('Refresh token for non-existent user', {
          userId: payload.sub
        });
        
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Check if user is active
      if (!user.isActive()) {
        this.logger.warn('Refresh token attempt for deactivated user', {
          userId: user.getId(),
          email: user.getEmail()
        });
        
        return {
          success: false,
          message: 'Account is deactivated'
        };
      }

      // Generate new token pair
      const tokenPair = await this.jwtService.generateTokenPair({
        sub: user.getId(),
        email: user.getEmail(),
        role: user.getRole()
      });

      this.logger.info('Token refreshed successfully', {
        userId: user.getId(),
        email: user.getEmail()
      });

      return {
        success: true,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: {
          id: user.getId(),
          email: user.getEmail(),
          name: user.getName(),
          role: user.getRole()
        },
        message: 'Token refreshed successfully'
      };

    } catch (error: any) {
      this.logger.error('Token refresh failed', {
        error: error.message
      });
      
      return {
        success: false,
        message: 'Token refresh failed'
      };
    }
  }
}