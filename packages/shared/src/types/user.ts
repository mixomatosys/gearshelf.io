export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  plan: UserPlan;
  isVerified: boolean;
  reputation: number;
  createdAt: string;
  updatedAt: string;
}

export enum UserPlan {
  FREE = 'free',
  PRO = 'pro', 
  STUDIO = 'studio',
  ENTERPRISE = 'enterprise'
}

export interface UserSession {
  token: string;
  user: User;
  expiresAt: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  publicProfile: boolean;
  showInstalledPlugins: boolean;
  defaultPluginView: 'grid' | 'list';
  preferredCurrency: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  totalPlugins: number;
  installedPlugins: number;
  reviewsWritten: number;
  helpfulVotes: number;
  collectionValue?: number;
  joinedAt: string;
}