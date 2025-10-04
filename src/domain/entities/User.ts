/**
 * User Entity
 * Represents a user in the system with security validations
 */

import { UserId } from './value-objects/UserId';
import { Email } from './value-objects/Email';
import { Username } from './value-objects/Username';
import { HashedPassword } from './value-objects/HashedPassword';
import { UserRole } from './enums/UserRole';
import { UserProfile, UserProfileValidator } from './types/UserProfile';

export interface UserProps {
  readonly id: UserId;
  readonly email: Email;
  readonly username: Username;
  readonly password: HashedPassword;
  readonly role: UserRole;
  readonly profile: UserProfile;
  readonly isActive: boolean;
  readonly isVerified: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastLoginAt?: Date;
  readonly deletedAt?: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {
    this.validate();
  }

  public static create(params: {
    email: string;
    username: string;
    hashedPassword: string;
    role?: UserRole;
    profile?: Partial<UserProfile>;
  }): User {
    const now = new Date();
    
    const userProps: UserProps = {
      id: UserId.create(),
      email: Email.create(params.email),
      username: Username.create(params.username),
      password: HashedPassword.create(params.hashedPassword),
      role: params.role || UserRole.USER,
      profile: UserProfileValidator.validate(params.profile || {}),
      isActive: true,
      isVerified: false,
      createdAt: now,
      updatedAt: now
    };

    return new User(userProps);
  }

  public static fromPersistence(props: UserProps): User {
    return new User(props);
  }

  private validate(): void {
    if (!this.props.id) {
      throw new Error('User ID is required');
    }
    
    if (!this.props.email) {
      throw new Error('Email is required');
    }
    
    if (!this.props.username) {
      throw new Error('Username is required');
    }
    
    if (!this.props.password) {
      throw new Error('Password is required');
    }

    if (!Object.values(UserRole).includes(this.props.role)) {
      throw new Error('Invalid user role');
    }

    if (this.props.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this.props.updatedAt < this.props.createdAt) {
      throw new Error('Updated date cannot be before created date');
    }
  }

  // Getters
  public get id(): UserId {
    return this.props.id;
  }

  public get email(): Email {
    return this.props.email;
  }

  public get username(): Username {
    return this.props.username;
  }

  public get password(): HashedPassword {
    return this.props.password;
  }

  public get role(): UserRole {
    return this.props.role;
  }

  public get profile(): UserProfile {
    return this.props.profile;
  }

  public get isActive(): boolean {
    return this.props.isActive;
  }

  public get isVerified(): boolean {
    return this.props.isVerified;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get lastLoginAt(): Date | undefined {
    return this.props.lastLoginAt;
  }

  public get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // Business methods
  public updateEmail(newEmail: string): User {
    const email = Email.create(newEmail);
    
    return new User({
      ...this.props,
      email,
      isVerified: false, // Reset verification when email changes
      updatedAt: new Date()
    });
  }

  public updateUsername(newUsername: string): User {
    const username = Username.create(newUsername);
    
    return new User({
      ...this.props,
      username,
      updatedAt: new Date()
    });
  }

  public updatePassword(newHashedPassword: string): User {
    const password = HashedPassword.create(newHashedPassword);
    
    return new User({
      ...this.props,
      password,
      updatedAt: new Date()
    });
  }

  public updateProfile(profileUpdates: Partial<UserProfile>): User {
    const updatedProfile = UserProfileValidator.validate({
      ...this.props.profile,
      ...profileUpdates
    });
    
    return new User({
      ...this.props,
      profile: updatedProfile,
      updatedAt: new Date()
    });
  }

  public updateRole(newRole: UserRole): User {
    if (!Object.values(UserRole).includes(newRole)) {
      throw new Error('Invalid user role');
    }
    
    return new User({
      ...this.props,
      role: newRole,
      updatedAt: new Date()
    });
  }

  public activate(): User {
    return new User({
      ...this.props,
      isActive: true,
      updatedAt: new Date()
    });
  }

  public deactivate(): User {
    return new User({
      ...this.props,
      isActive: false,
      updatedAt: new Date()
    });
  }

  public verify(): User {
    return new User({
      ...this.props,
      isVerified: true,
      updatedAt: new Date()
    });
  }

  public recordLogin(): User {
    return new User({
      ...this.props,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    });
  }

  public softDelete(): User {
    return new User({
      ...this.props,
      isActive: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Security methods
  public canAccess(requiredRole: UserRole): boolean {
    if (!this.isActive || this.deletedAt) {
      return false;
    }
    
    return UserRoleValidator.canAccess(this.role, requiredRole);
  }

  public isOwner(resourceUserId: UserId): boolean {
    return this.id.equals(resourceUserId);
  }

  public canModify(resourceUserId: UserId): boolean {
    return this.isOwner(resourceUserId) || this.canAccess(UserRole.MODERATOR);
  }

  // Utility methods
  public equals(other: User): boolean {
    return this.id.equals(other.id);
  }

  public toPlainObject(): Record<string, unknown> {
    return {
      id: this.id.value,
      email: this.email.value,
      username: this.username.value,
      role: this.role,
      profile: this.profile,
      isActive: this.isActive,
      isVerified: this.isVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLoginAt: this.lastLoginAt,
      deletedAt: this.deletedAt
    };
  }
}