export interface User {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'moderator';
  is_verified: boolean;
  is_active: boolean;
  avatar_url?: string;
  bio?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: number;
  user_id: number;
  token_hash: string;
  device_info?: any;
  ip_address?: string;
  expires_at: Date;
  last_used: Date;
  created_at: Date;
}

export interface UserPluginCollection {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  color?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserCollectionPlugin {
  id: number;
  collection_id: number;
  plugin_id: number;
  added_at: Date;
  notes?: string;
  rating?: number;
}

export interface UserPluginReview {
  id: number;
  user_id: number;
  plugin_id: number;
  rating: number;
  review_text?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

// Request/Response DTOs
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

export interface UserProfileUpdateRequest {
  name?: string;
  bio?: string;
  avatar_url?: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  is_public?: boolean;
  color?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  is_public?: boolean;
  color?: string;
}

export interface AddPluginToCollectionRequest {
  plugin_id: number;
  notes?: string;
  rating?: number;
}

export interface CreateReviewRequest {
  plugin_id: number;
  rating: number;
  review_text?: string;
  is_public?: boolean;
}

export interface UpdateReviewRequest {
  rating?: number;
  review_text?: string;
  is_public?: boolean;
}

// Database result types (with joins)
export interface UserWithStats extends User {
  collection_count: number;
  review_count: number;
  total_plugins: number;
}

export interface CollectionWithStats extends UserPluginCollection {
  plugin_count: number;
  total_rating?: number;
  avg_rating?: number;
}

export interface ReviewWithPlugin extends UserPluginReview {
  plugin_name: string;
  plugin_vendor: string;
}

export interface CollectionPluginWithDetails extends UserCollectionPlugin {
  plugin_name: string;
  plugin_vendor: string;
  plugin_categories: string[];
  plugin_formats: string[];
  plugin_is_free: boolean;
}