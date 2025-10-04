/**
 * Album Entity
 * Represents an album in the music system
 */

import { AlbumId } from './value-objects/AlbumId';
import { ArtistId } from './value-objects/ArtistId';
import { SongId } from './value-objects/SongId';
import { Genre, GenreValidator } from './enums/Genre';

export interface AlbumProps {
  readonly id: AlbumId;
  readonly title: string;
  readonly artistId: ArtistId;
  readonly description: string;
  readonly genre: Genre;
  readonly releaseDate: Date;
  readonly coverImageUrl?: string;
  readonly songIds: SongId[];
  readonly isPublic: boolean;
  readonly totalDuration: number; // in seconds
  readonly playCount: number;
  readonly likeCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export class Album {
  private static readonly MAX_TITLE_LENGTH = 200;
  private static readonly MAX_DESCRIPTION_LENGTH = 1000;
  private static readonly MAX_SONGS = 50;

  private constructor(private readonly props: AlbumProps) {
    this.validate();
  }

  public static create(params: {
    title: string;
    artistId: ArtistId;
    description?: string;
    genre: string;
    releaseDate: Date;
    coverImageUrl?: string;
    isPublic?: boolean;
  }): Album {
    const now = new Date();
    
    const albumProps: AlbumProps = {
      id: AlbumId.create(),
      title: this.validateTitle(params.title),
      artistId: params.artistId,
      description: this.validateDescription(params.description || ''),
      genre: GenreValidator.fromString(params.genre),
      releaseDate: this.validateReleaseDate(params.releaseDate),
      coverImageUrl: params.coverImageUrl ? this.validateImageUrl(params.coverImageUrl) : undefined,
      songIds: [],
      isPublic: params.isPublic ?? false,
      totalDuration: 0,
      playCount: 0,
      likeCount: 0,
      createdAt: now,
      updatedAt: now
    };

    return new Album(albumProps);
  }

  public static fromPersistence(props: AlbumProps): Album {
    return new Album(props);
  }

  private validate(): void {
    if (!this.props.id) {
      throw new Error('Album ID is required');
    }
    
    if (!this.props.artistId) {
      throw new Error('Artist ID is required');
    }
    
    if (!this.props.title || this.props.title.trim().length === 0) {
      throw new Error('Album title is required');
    }

    if (!Object.values(Genre).includes(this.props.genre)) {
      throw new Error('Invalid genre');
    }

    if (this.props.songIds.length > Album.MAX_SONGS) {
      throw new Error(`Album cannot have more than ${Album.MAX_SONGS} songs`);
    }

    if (this.props.totalDuration < 0) {
      throw new Error('Total duration cannot be negative');
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
      throw new Error('Album title must be a non-empty string');
    }

    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length === 0) {
      throw new Error('Album title cannot be empty');
    }

    if (trimmedTitle.length > this.MAX_TITLE_LENGTH) {
      throw new Error(`Album title cannot exceed ${this.MAX_TITLE_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedTitle)) {
      throw new Error('Album title contains invalid characters');
    }

    return trimmedTitle;
  }

  private static validateDescription(description: string): string {
    if (typeof description !== 'string') {
      throw new Error('Description must be a string');
    }

    const trimmedDescription = description.trim();
    
    if (trimmedDescription.length > this.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedDescription)) {
      throw new Error('Description contains invalid characters');
    }

    return trimmedDescription;
  }

  private static validateReleaseDate(releaseDate: Date): Date {
    if (!(releaseDate instanceof Date) || isNaN(releaseDate.getTime())) {
      throw new Error('Release date must be a valid date');
    }

    const now = new Date();
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(now.getFullYear() + 2); // Allow up to 2 years in the future

    if (releaseDate > maxFutureDate) {
      throw new Error('Release date cannot be more than 2 years in the future');
    }

    const minDate = new Date('1900-01-01');
    if (releaseDate < minDate) {
      throw new Error('Release date cannot be before 1900');
    }

    return releaseDate;
  }

  private static validateImageUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error('Image URL must be a non-empty string');
    }

    try {
      const urlObj = new URL(url);
      
      // Only allow HTTPS URLs for security
      if (urlObj.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed for images');
      }

      // Check for common image file extensions
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const hasValidExtension = allowedExtensions.some(ext => 
        urlObj.pathname.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        throw new Error('Image URL must point to a valid image file');
      }

      return url;
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTPS')) {
        throw error;
      }
      throw new Error('Invalid image URL format');
    }
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

  // Getters
  public get id(): AlbumId {
    return this.props.id;
  }

  public get title(): string {
    return this.props.title;
  }

  public get artistId(): ArtistId {
    return this.props.artistId;
  }

  public get description(): string {
    return this.props.description;
  }

  public get genre(): Genre {
    return this.props.genre;
  }

  public get releaseDate(): Date {
    return this.props.releaseDate;
  }

  public get coverImageUrl(): string | undefined {
    return this.props.coverImageUrl;
  }

  public get songIds(): SongId[] {
    return [...this.props.songIds]; // Return copy to prevent mutation
  }

  public get isPublic(): boolean {
    return this.props.isPublic;
  }

  public get totalDuration(): number {
    return this.props.totalDuration;
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
  public updateTitle(newTitle: string): Album {
    const title = Album.validateTitle(newTitle);
    
    return new Album({
      ...this.props,
      title,
      updatedAt: new Date()
    });
  }

  public updateDescription(newDescription: string): Album {
    const description = Album.validateDescription(newDescription);
    
    return new Album({
      ...this.props,
      description,
      updatedAt: new Date()
    });
  }

  public updateGenre(newGenre: string): Album {
    const genre = GenreValidator.fromString(newGenre);
    
    return new Album({
      ...this.props,
      genre,
      updatedAt: new Date()
    });
  }

  public updateReleaseDate(newReleaseDate: Date): Album {
    const releaseDate = Album.validateReleaseDate(newReleaseDate);
    
    return new Album({
      ...this.props,
      releaseDate,
      updatedAt: new Date()
    });
  }

  public updateCoverImage(newImageUrl: string): Album {
    const coverImageUrl = Album.validateImageUrl(newImageUrl);
    
    return new Album({
      ...this.props,
      coverImageUrl,
      updatedAt: new Date()
    });
  }

  public removeCoverImage(): Album {
    return new Album({
      ...this.props,
      coverImageUrl: undefined,
      updatedAt: new Date()
    });
  }

  public addSong(songId: SongId, songDuration: number): Album {
    if (this.props.songIds.length >= Album.MAX_SONGS) {
      throw new Error(`Album cannot have more than ${Album.MAX_SONGS} songs`);
    }

    if (this.hasSong(songId)) {
      throw new Error('Song is already in the album');
    }

    if (songDuration < 0) {
      throw new Error('Song duration cannot be negative');
    }

    return new Album({
      ...this.props,
      songIds: [...this.props.songIds, songId],
      totalDuration: this.props.totalDuration + songDuration,
      updatedAt: new Date()
    });
  }

  public removeSong(songId: SongId, songDuration: number): Album {
    if (!this.hasSong(songId)) {
      throw new Error('Song is not in the album');
    }

    if (songDuration < 0) {
      throw new Error('Song duration cannot be negative');
    }

    const filteredSongIds = this.props.songIds.filter(id => !id.equals(songId));
    const newTotalDuration = Math.max(0, this.props.totalDuration - songDuration);

    return new Album({
      ...this.props,
      songIds: filteredSongIds,
      totalDuration: newTotalDuration,
      updatedAt: new Date()
    });
  }

  public reorderSongs(newSongIds: SongId[]): Album {
    // Validate that the new order contains the same songs
    if (newSongIds.length !== this.props.songIds.length) {
      throw new Error('New song order must contain the same number of songs');
    }

    const currentSongIdStrings = this.props.songIds.map(id => id.value).sort();
    const newSongIdStrings = newSongIds.map(id => id.value).sort();

    if (JSON.stringify(currentSongIdStrings) !== JSON.stringify(newSongIdStrings)) {
      throw new Error('New song order must contain the same songs');
    }

    return new Album({
      ...this.props,
      songIds: [...newSongIds],
      updatedAt: new Date()
    });
  }

  public makePublic(): Album {
    return new Album({
      ...this.props,
      isPublic: true,
      updatedAt: new Date()
    });
  }

  public makePrivate(): Album {
    return new Album({
      ...this.props,
      isPublic: false,
      updatedAt: new Date()
    });
  }

  public incrementPlayCount(): Album {
    return new Album({
      ...this.props,
      playCount: this.props.playCount + 1,
      updatedAt: new Date()
    });
  }

  public incrementLikeCount(): Album {
    return new Album({
      ...this.props,
      likeCount: this.props.likeCount + 1,
      updatedAt: new Date()
    });
  }

  public decrementLikeCount(): Album {
    const newCount = Math.max(0, this.props.likeCount - 1);
    
    return new Album({
      ...this.props,
      likeCount: newCount,
      updatedAt: new Date()
    });
  }

  public softDelete(): Album {
    return new Album({
      ...this.props,
      isPublic: false,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Query methods
  public hasSong(songId: SongId): boolean {
    return this.props.songIds.some(id => id.equals(songId));
  }

  public getSongCount(): number {
    return this.props.songIds.length;
  }

  public isEmpty(): boolean {
    return this.props.songIds.length === 0;
  }

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

  // Utility methods
  public getTotalDurationFormatted(): string {
    const hours = Math.floor(this.totalDuration / 3600);
    const minutes = Math.floor((this.totalDuration % 3600) / 60);
    const seconds = this.totalDuration % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  public equals(other: Album): boolean {
    return this.id.equals(other.id);
  }

  public toPlainObject(): Record<string, unknown> {
    return {
      id: this.id.value,
      title: this.title,
      artistId: this.artistId.value,
      description: this.description,
      genre: this.genre,
      releaseDate: this.releaseDate,
      coverImageUrl: this.coverImageUrl,
      songIds: this.songIds.map(id => id.value),
      isPublic: this.isPublic,
      totalDuration: this.totalDuration,
      playCount: this.playCount,
      likeCount: this.likeCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt
    };
  }
}