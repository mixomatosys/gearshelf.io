# 🔧 Technical Specifications

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 Electron App                     │
├─────────────────────────────────────────────────┤
│  React Frontend (TypeScript + Tailwind)         │
├─────────────────────────────────────────────────┤
│  Main Process (Node.js)                         │
│  ├── Plugin Scanner Service                     │
│  ├── Database Manager (SQLite)                  │
│  ├── File System Monitor                        │
│  └── Update Manager                             │
├─────────────────────────────────────────────────┤
│  Operating System                               │
│  ├── Plugin Directories                         │
│  ├── Registry (Windows)                         │
│  └── Audio Units (macOS)                        │
└─────────────────────────────────────────────────┘
```

## Database Schema (SQLite)

```sql
-- Main plugins table
CREATE TABLE plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display_name TEXT,
    manufacturer TEXT,
    version TEXT,
    plugin_type TEXT, -- VST2, VST3, AU, AAX
    category TEXT,    -- Synth, Effect, Sampler, etc.
    file_path TEXT UNIQUE NOT NULL,
    file_size INTEGER,
    install_date TIMESTAMP,
    last_scanned TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    install_source TEXT, -- Native Access, Splice, Manual, etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scan history for troubleshooting
CREATE TABLE scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_type TEXT, -- full, incremental, manual
    plugins_found INTEGER,
    plugins_new INTEGER,  
    plugins_removed INTEGER,
    scan_duration_ms INTEGER,
    errors_count INTEGER,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Plugin paths to scan
CREATE TABLE scan_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    scan_recursive BOOLEAN DEFAULT true,
    path_type TEXT, -- system, user, custom
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_plugins_manufacturer ON plugins(manufacturer);
CREATE INDEX idx_plugins_type ON plugins(plugin_type);
CREATE INDEX idx_plugins_category ON plugins(category);
CREATE INDEX idx_plugins_name ON plugins(name);
CREATE INDEX idx_plugins_last_used ON plugins(last_used);
```

## Plugin Detection Algorithm

### 1. Discovery Phase

**macOS Plugin Paths:**
```javascript
const MACOS_PATHS = {
  // System-wide Audio Units
  '/Library/Audio/Plug-Ins/Components/',
  
  // System-wide VST
  '/Library/Audio/Plug-Ins/VST/',
  '/Library/Audio/Plug-Ins/VST3/',
  
  // User Audio Units
  '~/Library/Audio/Plug-Ins/Components/',
  '~/Library/Audio/Plug-Ins/VST/',
  '~/Library/Audio/Plug-Ins/VST3/',
  
  // Company-specific paths
  '/Library/Application Support/Native Instruments/',
  '/Applications/Native Instruments/',
  '/Library/Application Support/Splice/',
  '/Library/Application Support/Output/',
  '/Library/Application Support/iZotope/',
  '/Library/Application Support/Plugin Alliance/',
  '/Library/Application Support/Waves/',
  '/Applications/Waves/',
  
  // Common third-party paths
  '/Library/Application Support/FabFilter/',
  '/Library/Application Support/Xfer Records/',
  '/Library/Application Support/Arturia/',
  '/Library/Application Support/u-he/',
  '/Library/Application Support/Spitfire Audio/',
  '/Library/Application Support/Sample Logic/',
  '/usr/local/lib/vst/',
  '/usr/lib/vst/'
};
```

**Windows Plugin Paths:**
```javascript
const WINDOWS_PATHS = {
  // Standard VST paths  
  'C:\\Program Files\\VstPlugins\\',
  'C:\\Program Files (x86)\\VstPlugins\\',
  'C:\\Program Files\\Common Files\\VST2\\',
  'C:\\Program Files\\Common Files\\VST3\\',
  'C:\\Program Files (x86)\\Common Files\\VST3\\',
  
  // Company-specific paths
  'C:\\Program Files\\Native Instruments\\',
  'C:\\Program Files (x86)\\Native Instruments\\',
  'C:\\Program Files\\Splice Sounds\\',
  'C:\\Program Files\\Output\\',
  'C:\\Program Files\\iZotope\\',
  'C:\\Program Files\\Plugin Alliance\\',
  'C:\\Program Files\\Waves\\',
  'C:\\Program Files (x86)\\Waves\\',
  
  // User-specific paths
  '%USERPROFILE%\\AppData\\Roaming\\VST3\\',
  '%APPDATA%\\VST3\\',
  '%LOCALAPPDATA%\\Programs\\',
  
  // Registry-discovered paths
  // HKEY_LOCAL_MACHINE\SOFTWARE\VST
  // HKEY_CURRENT_USER\SOFTWARE\VST
};
```

### 2. Plugin File Analysis

**File Type Detection:**
```javascript
const PLUGIN_EXTENSIONS = {
  '.component': 'AU',     // Audio Units (macOS)
  '.vst': 'VST2',         // VST2 plugins
  '.vst3': 'VST3',        // VST3 plugins  
  '.dll': 'VST2/VST3',    // Windows VST plugins
  '.aax': 'AAX',          // Pro Tools plugins
  '.rtas': 'RTAS',        // Legacy Pro Tools
  '.bundle': 'AU'         // macOS bundles
};

const analyzePluginFile = async (filePath) => {
  const stats = await fs.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  let pluginInfo = {
    name: path.basename(filePath, ext),
    type: PLUGIN_EXTENSIONS[ext] || 'Unknown',
    path: filePath,
    size: stats.size,
    modified: stats.mtime,
    manufacturer: 'Unknown'
  };
  
  // Extract additional metadata based on file type
  if (ext === '.component' || ext === '.bundle') {
    pluginInfo = await analyzeAudioUnit(filePath, pluginInfo);
  } else if (ext === '.vst3') {
    pluginInfo = await analyzeVST3(filePath, pluginInfo);
  } else if (ext === '.vst' || ext === '.dll') {
    pluginInfo = await analyzeVST2(filePath, pluginInfo);
  }
  
  // Manufacturer detection from path
  pluginInfo.manufacturer = detectManufacturer(filePath);
  pluginInfo.installSource = detectInstallSource(filePath);
  
  return pluginInfo;
};
```

### 3. Manufacturer Detection

**Path-based Detection:**
```javascript
const MANUFACTURER_PATTERNS = {
  'Native Instruments': [
    '/Native Instruments/',
    'Native Instruments\\',
    'NI_'
  ],
  'FabFilter': [
    '/FabFilter/',
    'FabFilter\\',
    'FabFilter Pro'
  ],
  'Waves': [
    '/Waves/',
    'Waves\\',
    'WaveShell'
  ],
  'Splice': [
    '/Splice/',
    'Splice\\',
    'Splice Sounds'
  ],
  'Output': [
    '/Output/',
    'Output\\',
    'Portal_'
  ],
  'iZotope': [
    '/iZotope/',
    'iZotope\\',
    'iZotope_'
  ],
  'Plugin Alliance': [
    '/Plugin Alliance/',
    'Plugin Alliance\\',
    'PA_'
  ],
  'Arturia': [
    '/Arturia/',
    'Arturia\\',
    'Arturia_'
  ],
  'u-he': [
    '/u-he/',
    'u-he\\',
    'u-he_'
  ],
  'Xfer Records': [
    '/Xfer/',
    'Xfer Records\\',
    'Serum',
    'LFOTool'
  ]
};

const detectManufacturer = (filePath) => {
  for (const [manufacturer, patterns] of Object.entries(MANUFACTURER_PATTERNS)) {
    for (const pattern of patterns) {
      if (filePath.includes(pattern)) {
        return manufacturer;
      }
    }
  }
  return 'Unknown';
};
```

### 4. Install Source Detection

**Company App Detection:**
```javascript
const INSTALL_SOURCE_PATTERNS = {
  'Native Access': [
    '/Library/Application Support/Native Instruments/',
    'C:\\Program Files\\Native Instruments\\',
    'Native Instruments Service Center'
  ],
  'Splice Desktop': [
    '/Library/Application Support/Splice/',
    'C:\\Program Files\\Splice Sounds\\',
    'Splice - Sounds'
  ],
  'Waves Central': [
    '/Applications/Waves/',
    'C:\\Program Files\\Waves\\',
    'WaveShell'
  ],
  'Output Portal': [
    '/Library/Application Support/Output/',
    'C:\\Program Files\\Output\\',
    'Portal_'
  ],
  'Plugin Alliance Manager': [
    '/Library/Application Support/Plugin Alliance/',
    'C:\\Program Files\\Plugin Alliance\\',
    'PA_'
  ],
  'Manual Install': [
    // Default for anything not matched above
  ]
};
```

## Background Scanning Service

```javascript
class PluginScanner {
  constructor() {
    this.isScanning = false;
    this.scanProgress = 0;
    this.foundPlugins = [];
    this.scanPaths = [];
  }
  
  async startScan(scanType = 'full') {
    this.isScanning = true;
    this.scanProgress = 0;
    this.foundPlugins = [];
    
    try {
      // Get scan paths from database
      this.scanPaths = await this.getScanPaths();
      
      // Scan each path
      for (let i = 0; i < this.scanPaths.length; i++) {
        const scanPath = this.scanPaths[i];
        await this.scanDirectory(scanPath);
        
        // Update progress
        this.scanProgress = ((i + 1) / this.scanPaths.length) * 100;
        this.sendProgressUpdate();
      }
      
      // Update database
      await this.updateDatabase();
      
      // Record scan history
      await this.recordScanHistory();
      
    } catch (error) {
      console.error('Scan failed:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }
  
  async scanDirectory(dirPath) {
    if (!await this.pathExists(dirPath.path)) return;
    
    const files = await this.getDirectoryFiles(dirPath.path, dirPath.scan_recursive);
    
    for (const file of files) {
      if (this.isPluginFile(file)) {
        const pluginInfo = await analyzePluginFile(file);
        this.foundPlugins.push(pluginInfo);
      }
    }
  }
  
  isPluginFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return Object.keys(PLUGIN_EXTENSIONS).includes(ext);
  }
  
  sendProgressUpdate() {
    // Send to renderer process
    this.webContents?.send('scan-progress', {
      progress: this.scanProgress,
      found: this.foundPlugins.length,
      isScanning: this.isScanning
    });
  }
}
```

## Performance Optimizations

### 1. Lazy Loading & Virtualization
```javascript
// Only render visible plugins in large lists
const VirtualizedPluginList = () => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  
  return (
    <VirtualList
      height={600}
      itemCount={plugins.length}
      itemHeight={60}
      renderItem={({ index }) => (
        <PluginRow plugin={plugins[index]} />
      )}
    />
  );
};
```

### 2. Background Processing
```javascript
// Use Web Workers for heavy tasks
const scanWorker = new Worker('scan-worker.js');
scanWorker.postMessage({ action: 'scanDirectory', path: '/Library/Audio/Plug-Ins/' });

scanWorker.onmessage = (event) => {
  const { plugins, progress } = event.data;
  updateScanProgress(progress);
  updatePluginList(plugins);
};
```

### 3. Database Optimization
```sql
-- Prepared statements for common queries
PREPARE getPluginsByManufacturer FROM 
'SELECT * FROM plugins WHERE manufacturer = ? ORDER BY name';

PREPARE searchPlugins FROM
'SELECT * FROM plugins WHERE name LIKE ? OR manufacturer LIKE ? ORDER BY name LIMIT 100';

-- Indexes for fast filtering
CREATE INDEX idx_plugins_compound ON plugins(manufacturer, plugin_type, category);
```

## Error Handling & Recovery

### 1. Graceful Degradation
```javascript
const scanWithFallback = async (path) => {
  try {
    return await fullScan(path);
  } catch (error) {
    console.warn(`Full scan failed for ${path}, trying simple scan:`, error);
    try {
      return await simpleScan(path);
    } catch (fallbackError) {
      console.error(`All scan methods failed for ${path}:`, fallbackError);
      return [];
    }
  }
};
```

### 2. Recovery Mechanisms
```javascript
class DatabaseManager {
  async initializeDatabase() {
    try {
      await this.openDatabase();
      await this.validateSchema();
    } catch (error) {
      console.error('Database initialization failed, attempting recovery:', error);
      await this.recoverDatabase();
    }
  }
  
  async recoverDatabase() {
    // Backup current database
    await this.backupDatabase();
    
    // Recreate schema
    await this.recreateSchema();
    
    // Re-import data if possible
    await this.importFromBackup();
  }
}
```

## Security Considerations

### 1. Safe File System Access
```javascript
const safePath = require('path').normalize(userInput);
if (!safePath.startsWith(allowedBasePath)) {
  throw new Error('Path traversal attempt blocked');
}
```

### 2. Plugin Execution Prevention
```javascript
// Never execute plugin files during scanning
// Only read metadata, never load or run plugins
const analyzePluginSafely = async (filePath) => {
  // Read file headers and metadata only
  // No dynamic loading or execution
};
```

## Testing Strategy

### 1. Unit Tests
```javascript
describe('Plugin Scanner', () => {
  test('detects VST3 plugins correctly', async () => {
    const mockPluginPath = '/test/FabFilter Pro-Q 3.vst3';
    const result = await analyzePluginFile(mockPluginPath);
    
    expect(result.type).toBe('VST3');
    expect(result.manufacturer).toBe('FabFilter');
    expect(result.name).toBe('FabFilter Pro-Q 3');
  });
});
```

### 2. Integration Tests
```javascript
describe('Full Scan Integration', () => {
  test('scans test plugin directory completely', async () => {
    const scanner = new PluginScanner();
    const results = await scanner.scanDirectory('/test/plugins/');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(p => p.name && p.type)).toBe(true);
  });
});
```

### 3. Platform-Specific Testing
- Test on macOS 10.15+, 11.x, 12.x, 13.x, 14.x
- Test on Windows 10, Windows 11
- Test with various plugin managers installed
- Test with large plugin collections (1000+ plugins)
- Test with unusual plugin installations

## Distribution & Updates

### 1. Auto-Updates
```javascript
// Use electron-updater for seamless updates
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  // Notify user of available update
});

autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart and install
});
```

### 2. Code Signing
- macOS: Apple Developer Certificate
- Windows: Code Signing Certificate
- Notarization for macOS distribution

### 3. Distribution Channels
- GitHub Releases (primary)
- Direct download from website
- Future: Mac App Store, Windows Store

This technical specification provides the detailed implementation roadmap for building a robust, performant plugin manager that actually works in the real world.