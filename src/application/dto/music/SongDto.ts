/**
 * SongDto
 * Response DTO for song data
 */

export interface SongDto {
  readonly id: string;
  readonly title: string;
  readonly duration: number;
  readonly artistId: string;
  readonly albumId?: string;
  readonly filePath: string;
  readonly metadata: SongMetadataDto;
  readonly isPublic: boolean;
  readonly playCount: number;
  readonly likeCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SongMetadataDto {
  readonly genre: string;
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

export class SongDtoMapper {
  public static toDto(song: {
    id: { value: string };
    title: string;
    duration: number;
    artistId: { value: string };
    albumId?: { value: string };
    filePath: string;
    metadata: {
      genre: string;
      year?: number;
      bpm?: number;
      key?: string;
      explicit: boolean;
      language?: string;
      tags: string[];
      fileSize: number;
      bitrate?: number;
      sampleRate?: number;
      format: string;
    };
    isPublic: boolean;
    playCount: number;
    likeCount: number;
    createdAt: Date;
    updatedAt: Date;
  }): SongDto {
    return {
      id: song.id.value,
      title: song.title,
      duration: song.duration,
      artistId: song.artistId.value,
      albumId: song.albumId?.value,
      filePath: song.filePath,
      metadata: {
        genre: song.metadata.genre,
        year: song.metadata.year,
        bpm: song.metadata.bpm,
        key: song.metadata.key,
        explicit: song.metadata.explicit,
        language: song.metadata.language,
        tags: [...song.metadata.tags],
        fileSize: song.metadata.fileSize,
        bitrate: song.metadata.bitrate,
        sampleRate: song.metadata.sampleRate,
        format: song.metadata.format
      },
      isPublic: song.isPublic,
      playCount: song.playCount,
      likeCount: song.likeCount,
      createdAt: song.createdAt,
      updatedAt: song.updatedAt
    };
  }

  public static toPublicDto(song: SongDto): SongDto {
    // Remove sensitive information for public access
    return {
      ...song,
      filePath: '[PROTECTED]' // Hide actual file path for security
    };
  }
}