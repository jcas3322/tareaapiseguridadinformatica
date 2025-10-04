/**
 * Domain Entities Index
 * Exports all domain entities and related types
 */

// Value Objects
export { UserId } from './value-objects/UserId';
export { Email } from './value-objects/Email';
export { Username } from './value-objects/Username';
export { HashedPassword } from './value-objects/HashedPassword';
export { ArtistId } from './value-objects/ArtistId';
export { SongId } from './value-objects/SongId';
export { AlbumId } from './value-objects/AlbumId';

// Enums
export { UserRole, UserRoleValidator } from './enums/UserRole';
export { Genre, GenreValidator } from './enums/Genre';

// Types
export { UserProfile, UserProfileValidator } from './types/UserProfile';
export { SongMetadata, SongMetadataValidator } from './types/SongMetadata';

// Entities
export { User, UserProps } from './User';
export { Artist, ArtistProps } from './Artist';
export { Song, SongProps } from './Song';
export { Album, AlbumProps } from './Album';