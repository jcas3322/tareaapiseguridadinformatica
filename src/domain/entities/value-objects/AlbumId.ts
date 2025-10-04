/**
 * AlbumId Value Object
 * Represents a unique album identifier
 */

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export class AlbumId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value?: string): AlbumId {
    const id = value || uuidv4();
    
    if (!this.isValid(id)) {
      throw new Error(`Invalid AlbumId format: ${id}`);
    }
    
    return new AlbumId(id);
  }

  public static fromString(value: string): AlbumId {
    if (!this.isValid(value)) {
      throw new Error(`Invalid AlbumId format: ${value}`);
    }
    
    return new AlbumId(value);
  }

  private static isValid(value: string): boolean {
    return typeof value === 'string' && 
           value.length > 0 && 
           validateUuid(value);
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: AlbumId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}