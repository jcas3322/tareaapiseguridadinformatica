/**
 * UserId Value Object
 * Represents a unique user identifier with validation
 */

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export class UserId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value?: string): UserId {
    const id = value || uuidv4();
    
    if (!this.isValid(id)) {
      throw new Error(`Invalid UserId format: ${id}`);
    }
    
    return new UserId(id);
  }

  public static fromString(value: string): UserId {
    if (!this.isValid(value)) {
      throw new Error(`Invalid UserId format: ${value}`);
    }
    
    return new UserId(value);
  }

  private static isValid(value: string): boolean {
    return typeof value === 'string' && 
           value.length > 0 && 
           validateUuid(value);
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: UserId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}