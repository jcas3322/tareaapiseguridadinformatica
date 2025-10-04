/**
 * AuthTokenDto
 * Response DTO for authentication operations
 */

export interface AuthTokenDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: string;
  readonly expiresIn: number; // seconds
  readonly refreshExpiresIn: number; // seconds
  readonly user: UserAuthDto;
}

export interface UserAuthDto {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly role: string;
  readonly isVerified: boolean;
  readonly profile: {
    readonly displayName?: string;
    readonly avatarUrl?: string;
  };
}

export class AuthTokenDtoBuilder {
  private accessToken?: string;
  private refreshToken?: string;
  private tokenType: string = 'Bearer';
  private expiresIn?: number;
  private refreshExpiresIn?: number;
  private user?: UserAuthDto;

  public setAccessToken(token: string): AuthTokenDtoBuilder {
    this.accessToken = token;
    return this;
  }

  public setRefreshToken(token: string): AuthTokenDtoBuilder {
    this.refreshToken = token;
    return this;
  }

  public setTokenType(type: string): AuthTokenDtoBuilder {
    this.tokenType = type;
    return this;
  }

  public setExpiresIn(seconds: number): AuthTokenDtoBuilder {
    this.expiresIn = seconds;
    return this;
  }

  public setRefreshExpiresIn(seconds: number): AuthTokenDtoBuilder {
    this.refreshExpiresIn = seconds;
    return this;
  }

  public setUser(user: UserAuthDto): AuthTokenDtoBuilder {
    this.user = user;
    return this;
  }

  public build(): AuthTokenDto {
    if (!this.accessToken) {
      throw new Error('Access token is required');
    }

    if (!this.refreshToken) {
      throw new Error('Refresh token is required');
    }

    if (!this.expiresIn) {
      throw new Error('Expires in is required');
    }

    if (!this.refreshExpiresIn) {
      throw new Error('Refresh expires in is required');
    }

    if (!this.user) {
      throw new Error('User is required');
    }

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      tokenType: this.tokenType,
      expiresIn: this.expiresIn,
      refreshExpiresIn: this.refreshExpiresIn,
      user: this.user
    };
  }
}