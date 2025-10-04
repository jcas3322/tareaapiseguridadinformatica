/**
 * UserDto
 * Response DTO for user data
 */

export interface UserDto {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly isVerified: boolean;
  readonly profile: UserProfileDto;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastLoginAt?: Date;
}

export interface UserProfileDto {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly displayName?: string;
  readonly bio?: string;
  readonly avatarUrl?: string;
  readonly country?: string;
  readonly dateOfBirth?: Date;
  readonly isPublic: boolean;
}

export class UserDtoMapper {
  public static toDto(user: {
    id: { value: string };
    email: { value: string };
    username: { value: string };
    role: string;
    isActive: boolean;
    isVerified: boolean;
    profile: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      country?: string;
      dateOfBirth?: Date;
      isPublic: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
  }): UserDto {
    return {
      id: user.id.value,
      email: user.email.value,
      username: user.username.value,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      profile: {
        firstName: user.profile.firstName,
        lastName: user.profile.lastName,
        displayName: user.profile.displayName,
        bio: user.profile.bio,
        avatarUrl: user.profile.avatarUrl,
        country: user.profile.country,
        dateOfBirth: user.profile.dateOfBirth,
        isPublic: user.profile.isPublic
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  public static toAuthDto(user: {
    id: { value: string };
    email: { value: string };
    username: { value: string };
    role: string;
    isVerified: boolean;
    profile: {
      displayName?: string;
      avatarUrl?: string;
    };
  }): UserAuthDto {
    return {
      id: user.id.value,
      email: user.email.value,
      username: user.username.value,
      role: user.role,
      isVerified: user.isVerified,
      profile: {
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl
      }
    };
  }
}