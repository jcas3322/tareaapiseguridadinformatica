/**
 * Genre Enum
 * Defines music genres available in the system
 */

export enum Genre {
  ROCK = 'rock',
  POP = 'pop',
  JAZZ = 'jazz',
  CLASSICAL = 'classical',
  ELECTRONIC = 'electronic',
  HIP_HOP = 'hip_hop',
  COUNTRY = 'country',
  BLUES = 'blues',
  REGGAE = 'reggae',
  FOLK = 'folk',
  METAL = 'metal',
  PUNK = 'punk',
  INDIE = 'indie',
  ALTERNATIVE = 'alternative',
  R_AND_B = 'r_and_b',
  SOUL = 'soul',
  FUNK = 'funk',
  DISCO = 'disco',
  HOUSE = 'house',
  TECHNO = 'techno',
  AMBIENT = 'ambient',
  WORLD = 'world',
  LATIN = 'latin',
  REGGAETON = 'reggaeton',
  OTHER = 'other'
}

export class GenreValidator {
  private static readonly VALID_GENRES = Object.values(Genre);

  public static isValid(genre: string): genre is Genre {
    return this.VALID_GENRES.includes(genre as Genre);
  }

  public static fromString(genre: string): Genre {
    if (!this.isValid(genre)) {
      throw new Error(`Invalid genre: ${genre}`);
    }
    return genre as Genre;
  }

  public static fromStringArray(genres: string[]): Genre[] {
    return genres.map(genre => this.fromString(genre));
  }

  public static getAllGenres(): Genre[] {
    return [...this.VALID_GENRES];
  }

  public static getDisplayName(genre: Genre): string {
    const displayNames = {
      [Genre.ROCK]: 'Rock',
      [Genre.POP]: 'Pop',
      [Genre.JAZZ]: 'Jazz',
      [Genre.CLASSICAL]: 'Classical',
      [Genre.ELECTRONIC]: 'Electronic',
      [Genre.HIP_HOP]: 'Hip Hop',
      [Genre.COUNTRY]: 'Country',
      [Genre.BLUES]: 'Blues',
      [Genre.REGGAE]: 'Reggae',
      [Genre.FOLK]: 'Folk',
      [Genre.METAL]: 'Metal',
      [Genre.PUNK]: 'Punk',
      [Genre.INDIE]: 'Indie',
      [Genre.ALTERNATIVE]: 'Alternative',
      [Genre.R_AND_B]: 'R&B',
      [Genre.SOUL]: 'Soul',
      [Genre.FUNK]: 'Funk',
      [Genre.DISCO]: 'Disco',
      [Genre.HOUSE]: 'House',
      [Genre.TECHNO]: 'Techno',
      [Genre.AMBIENT]: 'Ambient',
      [Genre.WORLD]: 'World Music',
      [Genre.LATIN]: 'Latin',
      [Genre.REGGAETON]: 'Reggaeton',
      [Genre.OTHER]: 'Other'
    };
    
    return displayNames[genre] || genre;
  }
}