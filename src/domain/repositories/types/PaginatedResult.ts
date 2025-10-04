/**
 * PaginatedResult Type
 * Represents paginated query results with metadata
 */

export interface PaginatedResult<T> {
  readonly items: T[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface PaginationOptions {
  readonly page: number;
  readonly pageSize: number;
}

export class PaginationValidator {
  private static readonly MIN_PAGE = 1;
  private static readonly MAX_PAGE_SIZE = 100;
  private static readonly DEFAULT_PAGE_SIZE = 20;

  public static validate(options: Partial<PaginationOptions>): PaginationOptions {
    const page = this.validatePage(options.page);
    const pageSize = this.validatePageSize(options.pageSize);

    return { page, pageSize };
  }

  private static validatePage(page?: number): number {
    if (page === undefined || page === null) {
      return this.MIN_PAGE;
    }

    if (!Number.isInteger(page) || page < this.MIN_PAGE) {
      throw new Error(`Page must be an integer >= ${this.MIN_PAGE}`);
    }

    return page;
  }

  private static validatePageSize(pageSize?: number): number {
    if (pageSize === undefined || pageSize === null) {
      return this.DEFAULT_PAGE_SIZE;
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > this.MAX_PAGE_SIZE) {
      throw new Error(`Page size must be an integer between 1 and ${this.MAX_PAGE_SIZE}`);
    }

    return pageSize;
  }

  public static createResult<T>(
    items: T[],
    totalCount: number,
    options: PaginationOptions
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(totalCount / options.pageSize);
    
    return {
      items,
      totalCount,
      page: options.page,
      pageSize: options.pageSize,
      totalPages,
      hasNextPage: options.page < totalPages,
      hasPreviousPage: options.page > 1
    };
  }
}