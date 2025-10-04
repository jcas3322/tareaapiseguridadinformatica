/**
 * UserRole Enum
 * Defines the different roles a user can have in the system
 */

export enum UserRole {
  USER = 'user',
  ARTIST = 'artist',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export class UserRoleValidator {
  private static readonly VALID_ROLES = Object.values(UserRole);

  public static isValid(role: string): role is UserRole {
    return this.VALID_ROLES.includes(role as UserRole);
  }

  public static fromString(role: string): UserRole {
    if (!this.isValid(role)) {
      throw new Error(`Invalid user role: ${role}`);
    }
    return role as UserRole;
  }

  public static getPermissionLevel(role: UserRole): number {
    const levels = {
      [UserRole.USER]: 1,
      [UserRole.ARTIST]: 2,
      [UserRole.MODERATOR]: 3,
      [UserRole.ADMIN]: 4
    };
    
    return levels[role] || 0;
  }

  public static canAccess(userRole: UserRole, requiredRole: UserRole): boolean {
    return this.getPermissionLevel(userRole) >= this.getPermissionLevel(requiredRole);
  }
}