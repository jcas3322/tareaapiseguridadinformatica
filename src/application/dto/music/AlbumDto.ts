/**
 * AlbumDto
 * Response DTO for album data
 */

export interface AlbumDto {
  readonly id: string;
  readonly title: string;
  readonly artistId: string;
  readonly description: string;
  readonly genre: string;
  readonly releaseDate: Date;
  readonly coverImageUrl?: string;
  readonly songIds: string[];
  readonly isPublic: boolean;
  readonly totalDuration: number;
  readonly playCount: number;
  readonly likeCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class AlbumDtoMapper {
  public static toDto(album: {
    id: { value: string };
    title: string;
    artistId: { value: string };
    description: string;
    genre: string;
    releaseDate: Date;
    coverImageUrl?: string;
    songIds: Array<{ value: string }>;
    isPublic: boolean;
    totalDuration: number;
    playCount: number;
    likeCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): AlbumDto {
    return {
      id: album.id.value,
      title: album.title,
      artistId: album.artistId.value,
      description: album.description,
      genre: album.genre,
      releaseDate: album.releaseDate,
      coverImageUrl: album.coverImageUrl,
      songIds: album.songIds.map(id => id.value),
      isPublic: album.isPublic,
      totalDuration: album.totalDuration,
      playCount: album.playCount,
      likeCount: album.likeCount,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt
    };
  }
}