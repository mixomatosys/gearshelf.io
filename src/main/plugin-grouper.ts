import { Plugin, GroupedPlugin, PluginType } from './types';

export class PluginGrouper {
  private normalizePluginName(name: string): string {
    // Remove common suffixes and normalize names for grouping
    return name
      .replace(/\s+(VST3?|AU|Component)$/i, '') // Remove format suffixes
      .replace(/\s+\(.*\)$/, '') // Remove parenthetical info
      .replace(/[-_\s]+/g, ' ') // Normalize separators
      .trim()
      .toLowerCase();
  }

  private createGroupKey(plugin: Plugin): string {
    const normalizedName = this.normalizePluginName(plugin.name);
    const manufacturer = plugin.manufacturer?.toLowerCase() || 'unknown';
    return `${manufacturer}::${normalizedName}`;
  }

  public groupPlugins(plugins: Plugin[]): GroupedPlugin[] {
    const groups = new Map<string, GroupedPlugin>();

    for (const plugin of plugins) {
      const groupKey = this.createGroupKey(plugin);
      
      if (groups.has(groupKey)) {
        // Add to existing group
        const existing = groups.get(groupKey)!;
        if (!existing.types.includes(plugin.type)) {
          existing.types.push(plugin.type);
          existing.paths[plugin.type] = plugin.path;
          if (plugin.format) {
            existing.formats.push(plugin.format);
          }
        }
      } else {
        // Create new group
        const newGroup: GroupedPlugin = {
          name: plugin.name, // Use original name for display
          manufacturer: plugin.manufacturer,
          types: [plugin.type],
          paths: { [plugin.type]: plugin.path },
          formats: plugin.format ? [plugin.format] : [],
        };
        groups.set(groupKey, newGroup);
      }
    }

    // Convert map to array and sort
    const groupedPlugins = Array.from(groups.values());
    
    // Sort by manufacturer, then by name
    groupedPlugins.sort((a, b) => {
      const manufacturerA = a.manufacturer?.toLowerCase() || 'zzz';
      const manufacturerB = b.manufacturer?.toLowerCase() || 'zzz';
      
      if (manufacturerA !== manufacturerB) {
        return manufacturerA.localeCompare(manufacturerB);
      }
      
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return groupedPlugins;
  }

  public getStatistics(groupedPlugins: GroupedPlugin[]) {
    const stats = {
      uniquePlugins: groupedPlugins.length,
      totalFiles: 0,
      vst3Count: 0,
      vst2Count: 0,
      auCount: 0,
      multiFormatCount: 0,
      manufacturers: new Set<string>(),
    };

    for (const plugin of groupedPlugins) {
      stats.totalFiles += plugin.types.length;
      
      if (plugin.types.includes('VST3')) stats.vst3Count++;
      if (plugin.types.includes('VST2')) stats.vst2Count++;
      if (plugin.types.includes('AU')) stats.auCount++;
      
      if (plugin.types.length > 1) {
        stats.multiFormatCount++;
      }
      
      if (plugin.manufacturer) {
        stats.manufacturers.add(plugin.manufacturer);
      }
    }

    return stats;
  }

  public getMultiFormatPlugins(groupedPlugins: GroupedPlugin[]): GroupedPlugin[] {
    return groupedPlugins.filter(plugin => plugin.types.length > 1);
  }

  public getPluginsByManufacturer(groupedPlugins: GroupedPlugin[]): { [manufacturer: string]: GroupedPlugin[] } {
    const byManufacturer: { [manufacturer: string]: GroupedPlugin[] } = {};
    
    for (const plugin of groupedPlugins) {
      const manufacturer = plugin.manufacturer || 'Unknown';
      if (!byManufacturer[manufacturer]) {
        byManufacturer[manufacturer] = [];
      }
      byManufacturer[manufacturer].push(plugin);
    }
    
    return byManufacturer;
  }
}