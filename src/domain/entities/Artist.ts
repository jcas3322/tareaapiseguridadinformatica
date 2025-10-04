/**
 * Artist Entity
 * Represents an artist in the music system
 */

import { ArtistId } from './value-objects/ArtistId';
import { UserId } from './value-objects/UserId';
import { Genre, GenreValidator } from './enums/Genre';

export interface ArtistProps {
  readonly id: ArtistId;
  readonly userId: UserId;
  readonly artistName: string;
  readonly biography: string;
  readonly genres: Genre[];
  readonly isVerified: boolean;
  readonly followerCount: number;
  readonly monthlyListeners: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt?: Date;
}

export class Artist {
  private static readonly MAX_NAME_LENGTH = 100;
  private static readonly MAX_BIO_LENGTH = 1000;
  private static readonly MAX_GENRES = 5;

  private constructor(private readonly props: ArtistProps) {
    this.validate();
  }

  public static create(params: {
    userId: UserId;
    artistName: string;
    biography?: string;
    genres?: string[];
  }): Artist {
    const now = new Date();
    
    const artistProps: ArtistProps = {
      id: ArtistId.create(),
      userId: params.userId,
      artistName: this.validateArtistName(params.artistName),
      biography: this.validateBiography(params.biography || ''),
      genres: this.validateGenres(params.genres || []),
      isVerified: false,
      followerCount: 0,
      monthlyListeners: 0,
      createdAt: now,
      updatedAt: now
    };

    return new Artist(artistProps);
  }

  public static fromPersistence(props: ArtistProps): Artist {
    return new Artist(props);
  }

  private validate(): void {
    if (!this.props.id) {
      throw new Error('Artist ID is required');
    }
    
    if (!this.props.userId) {
      throw new Error('User ID is required');
    }
    
    if (!this.props.artistName || this.props.artistName.trim().length === 0) {
      throw new Error('Artist name is required');
    }

    if (this.props.followerCount < 0) {
      throw new Error('Follower count cannot be negative');
    }

    if (this.props.monthlyListeners < 0) {
      throw new Error('Monthly listeners cannot be negative');
    }

    if (this.props.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this.props.updatedAt < this.props.createdAt) {
      throw new Error('Updated date cannot be before created date');
    }
  }

  private static validateArtistName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('Artist name must be a non-empty string');
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      throw new Error('Artist name cannot be empty');
    }

    if (trimmedName.length > this.MAX_NAME_LENGTH) {
      throw new Error(`Artist name cannot exceed ${this.MAX_NAME_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedName)) {
      throw new Error('Artist name contains invalid characters');
    }

    return trimmedName;
  }

  private static validateBiography(bio: string): string {
    if (typeof bio !== 'string') {
      throw new Error('Biography must be a string');
    }

    const trimmedBio = bio.trim();
    
    if (trimmedBio.length > this.MAX_BIO_LENGTH) {
      throw new Error(`Biography cannot exceed ${this.MAX_BIO_LENGTH} characters`);
    }

    // Check for suspicious patterns
    if (this.containsSuspiciousPatterns(trimmedBio)) {
      throw new Error('Biography contains invalid characters');
    }

    return trimmedBio;
  }

  private static validateGenres(genres: string[]): Genre[] {
    if (!Array.isArray(genres)) {
      throw new Error('Genres must be an array');
    }

    if (genres.length > this.MAX_GENRES) {
      throw new Error(`Maximum ${this.MAX_GENRES} genres allowed`);
    }

    const validatedGenres: Genre[] = [];
    const seenGenres = new Set<string>();

    for (const genre of genres) {
      if (typeof genre !== 'string') {
        throw new Error('All genres must be strings');
      }

      const normalizedGenre = genre.toLowerCase().trim();
      
      if (seenGenres.has(normalizedGenre)) {
        continue; // Skip duplicates
      }

      const validatedGenre = GenreValidator.fromString(normalizedGenre);
      validatedGenres.push(validatedGenre);
      seenGenres.add(normalizedGenre);
    }

    return validatedGenres;
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
  public get id(): ArtistId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get artistName(): string {
    return this.props.artistName;
  }

  public get biography(): string {
    return this.props.biography;
  }

  public get genres(): Genre[] {
    return [...this.props.genres]; // Return copy to prevent mutation
  }

  public get isVerified(): boolean {
    return this.props.isVerified;
  }

  public get followerCount(): number {
    return this.props.followerCount;
  }

  public get monthlyListeners(): number {
    return this.props.monthlyListeners;
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
  public updateArtistName(newName: string): Artist {
    const artistName = Artist.validateArtistName(newName);
    
    return new Artist({
      ...this.props,
      artistName,
      updatedAt: new Date()
    });
  }

  public updateBiography(newBio: string): Artist {
    const biography = Artist.validateBiography(newBio);
    
    return new Artist({
      ...this.props,
      biography,
      updatedAt: new Date()
    });
  }

  public updateGenres(newGenres: string[]): Artist {
    const genres = Artist.validateGenres(newGenres);
    
    return new Artist({
      ...this.props,
      genres,
      updatedAt: new Date()
    });
  }

  public addGenre(genre: string): Artist {
    const currentGenres = this.genres.map(g => g.toString());
    
    if (currentGenres.includes(genre.toLowerCase())) {
      return this; // Genre already exists
    }

    const newGenres = [...currentGenres, genre];
    return this.updateGenres(newGenres);
  }

  public removeGenre(genre: string): Artist {
    const currentGenres = this.genres.map(g => g.toString());
    const filteredGenres = currentGenres.filter(g => g !== genre.toLowerCase());
    
    return this.updateGenres(filteredGenres);
  }

  public verify(): Artist {
    return new Artist({
      ...this.props,
      isVerified: true,
      updatedAt: new Date()
    });
  }

  public unverify(): Artist {
    return new Artist({
      ...this.props,
      isVerified: false,
      updatedAt: new Date()
    });
  }

  public incrementFollowers(): Artist {
    return new Artist({
      ...this.props,
      followerCount: this.props.followerCount + 1,
      updatedAt: new Date()
    });
  }

  public decrementFollowers(): Artist {
    const newCount = Math.max(0, this.props.followerCount - 1);
    
    return new Artist({
      ...this.props,
      followerCount: newCount,
      updatedAt: new Date()
    });
  }

  public updateMonthlyListeners(count: number): Artist {
    if (count < 0) {
      throw new Error('Monthly listeners cannot be negative');
    }
    
    return new Artist({
      ...this.props,
      monthlyListeners: count,
      updatedAt: new Date()
    });
  }

  public softDelete(): Artist {
    return new Artist({
      ...this.props,
      deletedAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Utility methods
  public isOwnedBy(userId: UserId): boolean {
    return this.userId.equals(userId);
  }

  public hasGenre(genre: Genre): boolean {
    return this.genres.includes(genre);
  }

  public equals(other: Artist): boolean {
    return this.id.equals(other.id);
  }

  public toPlainObject(): Record<string, unknown> {
    return {
      id: this.id.value,
      userId: this.userId.value,
      artistName: this.artistName,
      biography: this.biography,
      genres: this.genres,
      isVerified: this.isVerified,
      followerCount: this.followerCount,
      monthlyListeners: this.monthlyListeners,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt
    };
  }
}