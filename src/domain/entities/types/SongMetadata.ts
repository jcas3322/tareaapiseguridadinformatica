/**
 * SongMetadata Type
 * Represents metadata information for songs
 */

import { Genre } from '../enums/Genre';

export interface SongMetadata {
  readonly genre: Genre;
  readonly year?: number;
  readonly bpm?: number;
  readonly key?: string;
  readonly explicit: boolean;
  readonly language?: string;
  readonly tags: string[];
  readonly fileSize: number;
  readonly bitrate?: number;
  readonly sampleRate?: number;
  readonly format: string;
}

export class SongMetadataValidator {
  private static readonly MIN_YEAR = 1900;
  private static readonly MAX_YEAR = new Date().getFullYear() + 1;
  private static readonly MIN_BPM = 20;
  private static readonly MAX_BPM = 300;
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly MAX_TAGS = 10;
  private static readonly MAX_TAG_LENGTH = 30;
  private static readonly ALLOWED_FORMATS = ['mp3', 'wav', 'flac', 'aac', 'm4a'];
  private static readonly ALLOWED_KEYS = [
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 
    'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
  ];

  public static validate(metadata: Partial<SongMetadata>): SongMetadata {
    if (!metadata.genre) {
      throw new Error('Genre is required');
    }

    if (!metadata.format) {
      throw new Error('Format is required');
    }

    if (metadata.fileSize === undefined || metadata.fileSize === null) {
      throw new Error('File size is required');
    }

    const validatedMetadata: SongMetadata = {
      genre: this.validateGenre(metadata.genre),
      explicit: metadata.explicit ?? false,
      tags: this.validateTags(metadata.tags || []),
      fileSize: this.validateFileSize(metadata.fileSize),
      format: this.validateFormat(metadata.format)
    };

    if (metadata.year !== undefined) {
      validatedMetadata.year = this.validateYear(metadata.year);
    }

    if (metadata.bpm !== undefined) {
      validatedMetadata.bpm = this.validateBpm(metadata.bpm);
    }

    if (metadata.key !== undefined) {
      validatedMetadata.key = this.validateKey(metadata.key);
    }

    if (metadata.language !== undefined) {
      validatedMetadata.language = this.validateLanguage(metadata.language);
    }

    if (metadata.bitrate !== undefined) {
      validatedMetadata.bitrate = this.validateBitrate(metadata.bitrate);
    }

    if (metadata.sampleRate !== undefined) {
      validatedMetadata.sampleRate = this.validateSampleRate(metadata.sampleRate);
    }

    return validatedMetadata;
  }

  private static validateGenre(genre: Genre | string): Genre {
    if (typeof genre === 'string') {
      if (!Object.values(Genre).includes(genre as Genre)) {
        throw new Error(`Invalid genre: ${genre}`);
      }
      return genre as Genre;
    }
    return genre;
  }

  private static validateYear(year: number): number {
    if (!Number.isInteger(year) || year < this.MIN_YEAR || year > this.MAX_YEAR) {
      throw new Error(`Year must be between ${this.MIN_YEAR} and ${this.MAX_YEAR}`);
    }
    return year;
  }

  private static validateBpm(bpm: number): number {
    if (!Number.isInteger(bpm) || bpm < this.MIN_BPM || bpm > this.MAX_BPM) {
      throw new Error(`BPM must be between ${this.MIN_BPM} and ${this.MAX_BPM}`);
    }
    return bpm;
  }

  private static validateKey(key: string): string {
    if (!this.ALLOWED_KEYS.includes(key)) {
      throw new Error(`Invalid key: ${key}. Allowed keys: ${this.ALLOWED_KEYS.join(', ')}`);
    }
    return key;
  }

  private static validateLanguage(language: string): string {
    if (!language || typeof language !== 'string') {
      throw new Error('Language must be a non-empty string');
    }

    const trimmedLanguage = language.trim();
    
    if (trimmedLanguage.length < 2 || trimmedLanguage.length > 3) {
      throw new Error('Language must be a valid ISO language code');
    }

    return trimmedLanguage.toLowerCase();
  }

  private static validateTags(tags: string[]): string[] {
    if (!Array.isArray(tags)) {
      throw new Error('Tags must be an array');
    }

    if (tags.length > this.MAX_TAGS) {
      throw new Error(`Maximum ${this.MAX_TAGS} tags allowed`);
    }

    const validatedTags: string[] = [];

    for (const tag of tags) {
      if (typeof tag !== 'string') {
        throw new Error('All tags must be strings');
      }

      const trimmedTag = tag.trim().toLowerCase();
      
      if (trimmedTag.length === 0) {
        continue; // Skip empty tags
      }

      if (trimmedTag.length > this.MAX_TAG_LENGTH) {
        throw new Error(`Tag "${trimmedTag}" exceeds maximum length of ${this.MAX_TAG_LENGTH}`);
      }

      if (this.containsSuspiciousPatterns(trimmedTag)) {
        throw new Error(`Tag "${trimmedTag}" contains invalid characters`);
      }

      if (!validatedTags.includes(trimmedTag)) {
        validatedTags.push(trimmedTag);
      }
    }

    return validatedTags;
  }

  private static validateFileSize(fileSize: number): number {
    if (!Number.isInteger(fileSize) || fileSize <= 0) {
      throw new Error('File size must be a positive integer');
    }

    if (fileSize > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE} bytes`);
    }

    return fileSize;
  }

  private static validateFormat(format: string): string {
    if (!format || typeof format !== 'string') {
      throw new Error('Format must be a non-empty string');
    }

    const normalizedFormat = format.toLowerCase().trim();
    
    if (!this.ALLOWED_FORMATS.includes(normalizedFormat)) {
      throw new Error(`Invalid format: ${format}. Allowed formats: ${this.ALLOWED_FORMATS.join(', ')}`);
    }

    return normalizedFormat;
  }

  private static validateBitrate(bitrate: number): number {
    if (!Number.isInteger(bitrate) || bitrate <= 0) {
      throw new Error('Bitrate must be a positive integer');
    }

    // Common bitrates: 128, 192, 256, 320 kbps
    const commonBitrates = [128, 192, 256, 320, 512, 1024];
    
    if (!commonBitrates.includes(bitrate)) {
      console.warn(`Unusual bitrate: ${bitrate}. Common bitrates are: ${commonBitrates.join(', ')}`);
    }

    return bitrate;
  }

  private static validateSampleRate(sampleRate: number): number {
    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
      throw new Error('Sample rate must be a positive integer');
    }

    // Common sample rates: 44100, 48000, 96000 Hz
    const commonSampleRates = [22050, 44100, 48000, 88200, 96000, 192000];
    
    if (!commonSampleRates.includes(sampleRate)) {
      console.warn(`Unusual sample rate: ${sampleRate}. Common sample rates are: ${commonSampleRates.join(', ')}`);
    }

    return sampleRate;
  }

  private static containsSuspiciousPatterns(text: string): boolean {
    const suspiciousPatterns = [
      /<script/i,        // Script tags
      /javascript:/i,    // JavaScript URLs
      /[<>]/,           // HTML tags
      /\0/,             // Null bytes
      /[^\w\s-]/,       // Only allow alphanumeric, spaces, and hyphens
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }
}