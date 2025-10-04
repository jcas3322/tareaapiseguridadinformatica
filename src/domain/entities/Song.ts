/**
 * Song Entity
 * Represents a song in the music system
 */

import { SongId } from './value-objects/SongId';
import { ArtistId } from './value-objects/ArtistId';
import { AlbumId } from './value-objects/AlbumId';
import { SongMetadata, SongMetadataValidator } from './types/SongMetadata';

export interface SongProps {
  readonly id: SongId;
  readonly title: string;
  readonly duration: number; // in seconds
  readonly artistId: ArtistId;
  readonly albumId?: AlbumId;
  readonly filePath: string;
  readonly metadata: SongMetadata;
  readonly isPublic: boolean;
  readonly playCount: number;
  readonly likeCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export class Song {
  private static readonly MAX_TITLE_LENGTH = 200;
  private static readonly MIN_DURATION = 1; // 1 second
  private static readonly MAX_DURATION = 3600; // 1 hour
  private static readonly MAX_PATH_LENGTH = 500;

  private constructor(private readonly props: SongProps) {
    this.validate();
  }

  public static create(params: {
    title: string;
    duration: number;
    artistId: ArtistId;
    filePath: string;
    metadata: Partial<SongMetadata>;
    albumId?: AlbumId;
    isPublic?: boolean;
  }): Song {
    const now = new Date();
    
    const songProps: SongProps = {
      id: SongId.create(),
      title: this.validateTitle(params.title),
      duration: this.validateDuration(params.duration),
      artistId: params.artistId,
      albumId: params.albumId,
      filePath: this.validateFilePath(params.filePath),
      metadata: SongMetadataValidator.validate(params.metadata),
      isPublic: params.isPublic ?? false,
      playCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now
    };

    return new Song(songProps);
  }

  public static fromPersistence(props: SongProps): Song {
    return new Song(props);
  }

  private validate(): void {
    if (!this.props.id) {
      throw new Error('Song ID is required');
    }
    
    if (!this.props.artistId) {
      throw new Error('Artist ID is required');
    }
    
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new Error('Song title is required');
    }

    if (!this.props.filePath || this.props.filePath.trim().length === 0) {
      throw new Error('File path is required');
    }

    if (this.props.playCount < 0) {
      throw new Error('Play count cannot be negative');
    }

    if (this.props.likeCount < 0) {
      throw new Error('Like count cannot be negative');
    }

    if (this.props.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this.props.updatedAt < this.props.createdAt) {
      throw new Error('Updated date cannot be before created date');
    }
  }

  private static validateTitle(title: string): string {
    if (!title || typeof title !== 'string') {
      throw new Error('Song title must be a non-empty string');
    }

    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length === 0) {
      throw new Error('Song title cannot be empty');
    }

    if (trimmedTitle.length > this.MAX_TITLE_LENGTH) {
      throw new Error(`Song title cannot exceed ${this.MAX_TITLE_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedTitle)) {
      throw new Error('Song title contains invalid characters');
    }

    return trimmedTitle;
  }

  private static validateDuration(duration: number): number {
    if (!Number.isInteger(duration) || duration < this.MIN_DURATION || duration > this.MAX_DURATION) {
      throw new Error(`Duration must be between ${this.MIN_DURATION} and ${this.MAX_DURATION} seconds`);
    }

    return duration;
  }

  private static validateFilePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string');
    }

    const trimmedPath = filePath.trim();
    
    if (trimmedPath.length === 0) {
      throw new Error('File path cannot be empty');
    }

    if (trimmedPath.length > this.MAX_PATH_LENGTH) {
      throw new Error(`File path cannot exceed ${this.MAX_PATH_LENGTH} characters`);
    }

    // Security check for path traversal
    if (this.containsPathTraversal(trimmedPath)) {
      throw new Error('File path contains invalid characters or path traversal attempts');
    }

    return trimmedPath;
  }

  private static containsSuspiciousPatterns(text: string): boolean {
    const suspiciousPatterns = [
      /<script/i,        // Script tags
      /javascript:/i,    // JavaScript URLs
      /on\w+\s*=/i,     // Event handlers
      /[<>]/,           // HTML tags
      /\0/,             // Null bytes
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  private static containsPathTraversal(path: string): boolean {
    const pathTraversalPatterns = [
      /\.\./,           // Directory traversal
      /\/\//,           // Double slashes
      /\0/,             // Null bytes
      /[<>|]/,          // Invalid path characters
    ];

    return pathTraversalPatterns.some(pattern => pattern.test(path));
  }

  // Getters
  public get id(): SongId {
    return this.props.id;
  }

  public get title(): string {
    return this.props.title;
  }

  public get duration(): number {
    return this.props.duration;
  }

  public get artistId(): ArtistId {
    return this.props.artistId;
  }

  public get albumId(): AlbumId | undefined {
    return this.props.albumId;
  }

  public get filePath(): string {
    return this.props.filePath;
  }

  public get metadata(): SongMetadata {
    return this.props.metadata;
  }

  public get isPublic(): boolean {
    return this.props.isPublic;
  }

  public get playCount(): number {
    return this.props.playCount;
  }

  public get likeCount(): number {
    return this.props.likeCount;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get deletedAt(): Date | undefined {
    return this.props.deletedAt;
  }

  // Business methods
  public updateTitle(newTitle: string): Song {
    const title = Song.validateTitle(newTitle);
    
    return new Song({
      ...this.props,
      title,
      updatedAt: new Date()
    });
  }

  public updateDuration(newDuration: number): Song {
    const duration = Song.validateDuration(newDuration);
    
    return new Song({
      ...this.props,
      duration,
      updatedAt: new Date()
    });
  }

  public updateMetadata(metadataUpdates: Partial<SongMetadata>): Song {
    const metadata = SongMetadataValidator.validate({
      ...this.props.metadata,
      ...metadataUpdates
    });
    
    return new Song({
      ...this.props,
      metadata,
      updatedAt: new Date()
    });
  }

  public assignToAlbum(albumId: AlbumId): Song {
    return new Song({
      ...this.props,
      albumId,
      updatedAt: new Date()
    });
  }

  public removeFromAlbum(): Song {
    return new Song({
      ...this.props,
      albumId: undefined,
      updatedAt: new Date()
    });
  }

  public makePublic(): Song {
    return new Song({
      ...this.props,
      isPublic: true,
      updatedAt: new Date()
    });
  }

  public makePrivate(): Song {
    return new Song({
      ...this.props,
      isPublic: false,
      updatedAt: new Date()
    });
  }

  public incrementPlayCount(): Song {
    return new Song({
      ...this.props,
      playCount: this.props.playCount + 1,
      updatedAt: new Date()
    });
  }

  public incrementLikeCount(): Song {
    return new Song({
      ...this.props,
      likeCount: this.props.likeCount + 1,
      updatedAt: new Date()
    });
  }

  public decrementLikeCount(): Song {
    const newCount = Math.max(0, this.props.likeCount - 1);
    
    return new Song({
      ...this.props,
      likeCount: newCount,
      updatedAt: new Date()
    });
  }

  public softDelete(): Song {
    return new Song({
      ...this.props,
      isPublic: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Security and access methods
  public isOwnedBy(artistId: ArtistId): boolean {
    return this.artistId.equals(artistId);
  }

  public canBeAccessedBy(artistId?: ArtistId): boolean {
    if (this.deletedAt) {
      return false;
    }

    if (this.isPublic) {
      return true;
    }

    return artistId ? this.isOwnedBy(artistId) : false;
  }

  public belongsToAlbum(albumId: AlbumId): boolean {
    return this.albumId ? this.albumId.equals(albumId) : false;
  }

  // Utility methods
  public getDurationFormatted(): string {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  public equals(other: Song): boolean {
    return this.id.equals(other.id);
  }

  public toPlainObject(): Record<string, unknown> {
    return {
      id: this.id.value,
      title: this.title,
      duration: this.duration,
      artistId: this.artistId.value,
      albumId: this.albumId?.value,
      filePath: this.filePath,
      metadata: this.metadata,
      isPublic: this.isPublic,
      playCount: this.playCount,
      likeCount: this.likeCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt
    };
  }
}