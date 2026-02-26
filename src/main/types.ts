// Shared type definitions for plugin system

export type PluginType = 'VST3' | 'VST2' | 'AU' | 'Unknown';

export interface Plugin {
  name: string;
  path: string;
  type: PluginType;
  manufacturer?: string;
  version?: string;
  format?: string;
}

export interface ScanResult {
  plugins: Plugin[];
  totalScanned: number;
  errors: string[];
  scanTime: number;
}

export interface GroupedPlugin {
  name: string;
  manufacturer?: string;
  types: Array<PluginType>;
  paths: { [key: string]: string }; // type -> path mapping
  formats: string[];
}