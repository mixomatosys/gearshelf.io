// Plugin types
export * from './plugin';
export * from './user';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Search and Filter types
export interface SearchFilters {
  query?: string;
  category?: string;
  vendor?: string;
  format?: string[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  rating?: number;
  tags?: string[];
  isDemo?: boolean;
  sortBy?: 'name' | 'rating' | 'price' | 'releaseDate' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResults<T> {
  results: T[];
  total: number;
  filters: SearchFilters;
  facets?: {
    categories: Array<{ name: string; count: number }>;
    vendors: Array<{ name: string; count: number }>;
    formats: Array<{ name: string; count: number }>;
    priceRanges: Array<{ range: string; count: number }>;
  };
}