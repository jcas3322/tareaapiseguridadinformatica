/**
 * UploadSongCommand DTO
 * Command for uploading songs
 */

export interface UploadSongCommand {
  readonly title: string;
  readonly duration: number; // in seconds
  readonly artistId: string;
  readonly albumId?: string;
  readonly genre: string;
  readonly year?: number;
  readonly bpm?: number;
  readonly key?: string;
  readonly explicit: boolean;
  readonly language?: string;
  readonly tags: string[];
  readonly isPublic: boolean;
  readonly file: {
    readonly originalname: string;
    readonly mimetype: string;
    readonly size: number;
    readonly buffer?: Buffer;
  };
  readonly uploaderId: string;
}

export class UploadSongCommandValidator {
  public static validate(command: UploadSongCommand): void {
    // Basic field validation
    if (!command.title || typeof command.title !== 'string') {
      throw new Error('Title is required');
    }

    if (command.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }

    if (command.title.length > 200) {
      throw new Error('Title cannot exceed 200 characters');
    }

    if (!Number.isInteger(command.duration) || command.duration <= 0) {
      throw new Error('Duration must be a positive integer');
    }

    if (command.duration > 3600) { // 1 hour max
      throw new Error('Duration cannot exceed 1 hour');
    }

    if (!command.artistId || typeof command.artistId !== 'string') {
      throw new Error('Artist ID is required');
    }

    if (!command.uploaderId || typeof command.uploaderId !== 'string') {
      throw new Error('Uploader ID is required');
    }

    if (!command.genre || typeof command.genre !== 'string') {
      throw new Error('Genre is required');
    }

    if (typeof command.explicit !== 'boolean') {
      throw new Error('Explicit flag is required');
    }

    if (!Array.isArray(command.tags)) {
      throw new Error('Tags must be an array');
    }

    if (command.tags.length > 10) {
      throw new Error('Maximum 10 tags allowed');
    }

    if (typeof command.isPublic !== 'boolean') {
      throw new Error('Is public flag is required');
    }

    // Validate UUID format for IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(command.artistId)) {
      throw new Error('Invalid artist ID format');
    }

    if (!uuidRegex.test(command.uploaderId)) {
      throw new Error('Invalid uploader ID format');
    }

    if (command.albumId && !uuidRegex.test(command.albumId)) {
      throw new Error('Invalid album ID format');
    }

    // Optional field validation
    if (command.year !== undefined) {
      if (!Number.isInteger(command.year) || command.year < 1900 || command.year > new Date().getFullYear() + 1) {
        throw new Error('Year must be between 1900 and next year');
      }
    }

    if (command.bpm !== undefined) {
      if (!Number.isInteger(command.bpm) || command.bpm < 20 || command.bpm > 300) {
        throw new Error('BPM must be between 20 and 300');
      }
    }

    if (command.key !== undefined) {
      const validKeys = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
      if (!validKeys.includes(command.key)) {
        throw new Error('Invalid musical key');
      }
    }

    if (command.language !== undefined) {
      if (typeof command.language !== 'string' || command.language.length < 2 || command.language.length > 3) {
        throw new Error('Language must be a valid ISO language code');
      }
    }

    // File validation
    if (!command.file || typeof command.file !== 'object') {
      throw new Error('File is required');
    }

    if (!command.file.originalname || typeof command.file.originalname !== 'string') {
      throw new Error('File name is required');
    }

    if (!command.file.mimetype || typeof command.file.mimetype !== 'string') {
      throw new Error('File MIME type is required');
    }

    if (!Number.isInteger(command.file.size) || command.file.size <= 0) {
      throw new Error('File size must be a positive integer');
    }

    // Validate file type
    const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/mp4'];
    if (!allowedMimeTypes.includes(command.file.mimetype)) {
      throw new Error('Invalid file type. Allowed: MP3, WAV, FLAC, AAC, M4A');
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (command.file.size > maxSize) {
      throw new Error('File size cannot exceed 50MB');
    }

    // Validate tags
    for (const tag of command.tags) {
      if (typeof tag !== 'string') {
        throw new Error('All tags must be strings');
      }
      if (tag.trim().length === 0) {
        throw new Error('Tags cannot be empty');
      }
      if (tag.length > 30) {
        throw new Error('Tags cannot exceed 30 characters');
      }
    }
  }
}