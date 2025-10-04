/**
 * SongId Value Object
 * Represents a unique song identifier
 */

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export class SongId {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  public static create(value?: string): SongId {
    const id = value || uuidv4();
    
    if (!this.isValid(id)) {
      throw new Error(`Invalid SongId format: ${id}`);
    }
    
    return new SongId(id);
  }

  public static fromString(value: string): SongId {
    if (!this.isValid(value)) {
      throw new Error(`Invalid SongId format: ${value}`);
    }
    
    return new SongId(value);
  }

  private static isValid(value: string): boolean {
    return typeof value === 'string' && 
           value.length > 0 && 
           validateUuid(value);
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: SongId): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }
}