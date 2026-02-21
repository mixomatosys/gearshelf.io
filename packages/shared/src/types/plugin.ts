export interface Plugin {
  id: string;
  name: string;
  vendor: string;
  version?: string;
  description?: string;
  category: PluginCategory;
  subcategory?: string;
  formats: PluginFormat[];
  website?: string;
  price?: number;
  currency?: string;
  releaseDate?: string;
  lastUpdated?: string;
  tags: string[];
  averageRating?: number;
  reviewCount?: number;
  isDemo?: boolean;
  systemRequirements?: SystemRequirements;
  createdAt: string;
  updatedAt: string;
}

export interface PluginCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export enum PluginFormat {
  VST2 = 'VST2',
  VST3 = 'VST3', 
  AU = 'AU',
  AAX = 'AAX',
  RTAS = 'RTAS',
  LV2 = 'LV2',
  CLAP = 'CLAP'
}

export interface SystemRequirements {
  minOSVersion?: {
    windows?: string;
    macOS?: string;
    linux?: string;
  };
  architecture?: ('x64' | 'arm64')[];
  minRAM?: string;
  minStorage?: string;
}

export interface UserPlugin {
  id: string;
  userId: string;
  pluginId: string;
  plugin: Plugin;
  isInstalled: boolean;
  installedVersion?: string;
  installedPath?: string;
  installDate?: string;
  lastUsed?: string;
  rating?: number;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginReview {
  id: string;
  userId: string;
  pluginId: string;
  rating: number; // 1-5
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  isVerifiedPurchase?: boolean;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
}