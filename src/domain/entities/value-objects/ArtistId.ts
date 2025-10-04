/**
 * ArtistId Value Object
 * Represents a unique artist identifier
 */

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export class ArtistId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value?: string): ArtistId {
    const id = value || uuidv4();
    
    if (!this.isValid(id)) {
      throw new Error(`Invalid ArtistId format: ${id}`);
    }
    
    return new ArtistId(id);
  }

  public static fromString(value: string): ArtistId {
    if (!this.isValid(value)) {
      throw new Error(`Invalid ArtistId format: ${value}`);
    }
    
    return new ArtistId(value);
  }

  private static isValid(value: string): boolean {
    return typeof value === 'string' && 
           value.length > 0 && 
           validateUuid(value);
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: ArtistId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}