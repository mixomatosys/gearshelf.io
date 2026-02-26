import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { PluginScanner } from './plugin-scanner';

// Electron app setup

let mainWindow: BrowserWindow | null = null;

const createMainWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    minHeight: 600,
    minWidth: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load the app - TESTING MODE
  if (process.env.NODE_ENV === 'development') {
    // Try to load React app from webpack dev server
    try {
      mainWindow.loadURL('http://localhost:3000');
      console.log('Loading from webpack dev server...');
    } catch (e) {
      console.error('Failed to load from dev server:', e);
    }
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Prevent opening new windows
    return { action: 'deny' };
  });
});

// Initialize plugin scanner
const pluginScanner = new PluginScanner();

// Store plugins in memory for now (will add database later)
let cachedPlugins: any[] = [];

// IPC handlers for plugin scanning
ipcMain.handle('scan-plugins', async () => {
  console.log('🎸 Received scan-plugins request');
  
  try {
    // Perform the plugin scan
    const scanResult = await pluginScanner.scanAllPlugins();
    
    // Cache the results
    cachedPlugins = scanResult.plugins;
    
    console.log(`🎸 Scan completed: ${scanResult.totalScanned} plugins found`);
    
    return {
      success: true,
      message: `Found ${scanResult.totalScanned} plugins in ${scanResult.scanTime}ms`,
      totalPlugins: scanResult.totalScanned,
      scanTime: scanResult.scanTime,
      errors: scanResult.errors,
    };
  } catch (error) {
    console.error('🎸 Plugin scan failed:', error);
    return {
      success: false,
      message: `Scan failed: ${error}`,
      totalPlugins: 0,
    };
  }
});

ipcMain.handle('get-plugins', async () => {
  console.log('🎸 Received get-plugins request');
  return cachedPlugins;
});