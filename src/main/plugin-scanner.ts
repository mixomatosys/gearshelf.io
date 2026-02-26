import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Plugin, ScanResult, PluginType } from './types';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class PluginScanner {
  private scanPaths: { [key: string]: string[] } = {
    // macOS standard plugin paths
    VST3: [
      '/Library/Audio/Plug-Ins/VST3',
      '~/Library/Audio/Plug-Ins/VST3',
      '/System/Library/Audio/Plug-Ins/VST3',
    ],
    AU: [
      '/Library/Audio/Plug-Ins/Components',
      '~/Library/Audio/Plug-Ins/Components',
      '/System/Library/Audio/Plug-Ins/Components',
    ],
    VST2: [
      '/Library/Audio/Plug-Ins/VST',
      '~/Library/Audio/Plug-Ins/VST',
      // Common company-specific paths
      '~/Library/Audio/Plug-Ins/VST/Native Instruments',
      '~/Library/Audio/Plug-Ins/VST/Waves',
      '~/Library/Audio/Plug-Ins/VST/FabFilter',
    ],
  };

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(process.env.HOME || '', filePath.slice(2));
    }
    return filePath;
  }

  private async scanDirectory(dirPath: string, type: 'VST3' | 'VST2' | 'AU'): Promise<Plugin[]> {
    const plugins: Plugin[] = [];
    const expandedPath = this.expandPath(dirPath);

    try {
      // Check if directory exists
      const dirStat = await stat(expandedPath);
      if (!dirStat.isDirectory()) {
        return plugins;
      }

      const files = await readdir(expandedPath);
      
      for (const file of files) {
        const fullPath = path.join(expandedPath, file);
        
        try {
          const fileStat = await stat(fullPath);
          
          // Check file extensions and formats
          if (await this.isValidPlugin(fullPath, fileStat, type)) {
            const plugin = await this.createPluginInfo(fullPath, type);
            plugins.push(plugin);
          }
        } catch (error) {
          // Skip files we can't access
          console.warn(`Could not scan file ${fullPath}:`, error);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be accessed
      console.warn(`Could not scan directory ${expandedPath}:`, error);
    }

    return plugins;
  }

  private async isValidPlugin(filePath: string, fileStat: fs.Stats, type: 'VST3' | 'VST2' | 'AU'): Promise<boolean> {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    switch (type) {
      case 'VST3':
        // VST3 plugins are bundles (directories) with .vst3 extension
        return fileStat.isDirectory() && ext === '.vst3';
      
      case 'AU':
        // Audio Units are bundles with .component extension
        return fileStat.isDirectory() && ext === '.component';
      
      case 'VST2':
        // VST2 plugins can be .vst bundles or .dylib files
        return (fileStat.isDirectory() && ext === '.vst') || 
               (fileStat.isFile() && (ext === '.dylib' || ext === '.vst'));
      
      default:
        return false;
    }
  }

  private async createPluginInfo(filePath: string, type: 'VST3' | 'VST2' | 'AU'): Promise<Plugin> {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Try to extract manufacturer from path or filename
    const manufacturer = this.extractManufacturer(filePath, fileName);
    
    return {
      name: fileName,
      path: filePath,
      type: type,
      manufacturer: manufacturer,
      format: this.getFormatDescription(type),
    };
  }

  private extractManufacturer(filePath: string, fileName: string): string | undefined {
    const pathParts = filePath.split(path.sep);
    
    // Look for known manufacturer patterns in the path
    const knownManufacturers = [
      'Native Instruments', 'Waves', 'FabFilter', 'Steinberg', 'Audio Damage',
      'Arturia', 'Spectrasonics', 'Output', 'Splice', 'iZotope', 'Eventide',
      'Valhalla DSP', 'Soundtoys', 'Plugin Alliance', 'Universal Audio'
    ];
    
    for (const manufacturer of knownManufacturers) {
      if (filePath.includes(manufacturer)) {
        return manufacturer;
      }
    }
    
    // Try to extract from filename patterns
    if (fileName.includes('_')) {
      const parts = fileName.split('_');
      if (parts.length > 1) {
        return parts[0];
      }
    }
    
    // Look for manufacturer in parent directory name
    const parentDir = path.basename(path.dirname(filePath));
    if (parentDir && parentDir !== 'VST3' && parentDir !== 'VST' && parentDir !== 'Components') {
      return parentDir;
    }
    
    return undefined;
  }

  private getFormatDescription(type: 'VST3' | 'VST2' | 'AU'): string {
    switch (type) {
      case 'VST3':
        return 'VST3 Plugin';
      case 'VST2':
        return 'VST2 Plugin';
      case 'AU':
        return 'Audio Unit';
      default:
        return 'Unknown';
    }
  }

  public async scanAllPlugins(): Promise<ScanResult> {
    const startTime = Date.now();
    const allPlugins: Plugin[] = [];
    const errors: string[] = [];
    let totalScanned = 0;

    console.log('🎸 Starting plugin scan...');

    // Scan each plugin type
    for (const [pluginType, paths] of Object.entries(this.scanPaths)) {
      console.log(`🔍 Scanning ${pluginType} plugins...`);
      
      for (const scanPath of paths) {
        try {
          const plugins = await this.scanDirectory(scanPath, pluginType as 'VST3' | 'VST2' | 'AU');
          allPlugins.push(...plugins);
          totalScanned += plugins.length;
          
          if (plugins.length > 0) {
            console.log(`  Found ${plugins.length} plugins in ${scanPath}`);
          }
        } catch (error) {
          const errorMsg = `Error scanning ${scanPath}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    const scanTime = Date.now() - startTime;
    console.log(`🎸 Scan complete! Found ${totalScanned} plugins in ${scanTime}ms`);

    return {
      plugins: allPlugins,
      totalScanned,
      errors,
      scanTime,
    };
  }

  public async scanQuick(): Promise<ScanResult> {
    // Quick scan - only check most common locations
    const startTime = Date.now();
    const allPlugins: Plugin[] = [];
    const errors: string[] = [];

    const quickPaths = [
      { type: 'VST3' as const, path: '~/Library/Audio/Plug-Ins/VST3' },
      { type: 'AU' as const, path: '~/Library/Audio/Plug-Ins/Components' },
      { type: 'VST2' as const, path: '~/Library/Audio/Plug-Ins/VST' },
    ];

    for (const { type, path: scanPath } of quickPaths) {
      try {
        const plugins = await this.scanDirectory(scanPath, type);
        allPlugins.push(...plugins);
      } catch (error) {
        errors.push(`Error scanning ${scanPath}: ${error}`);
      }
    }

    const scanTime = Date.now() - startTime;

    return {
      plugins: allPlugins,
      totalScanned: allPlugins.length,
      errors,
      scanTime,
    };
  }
}