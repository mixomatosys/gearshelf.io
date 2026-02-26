import * as sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { Plugin, GroupedPlugin } from './types';

export interface DatabasePlugin {
  id: number;
  name: string;
  manufacturer?: string;
  type: string;
  path: string;
  format?: string;
  version?: string;
  fileSize?: number;
  lastModified?: number;
  scanDate: number;
  isActive: boolean; // false if file no longer exists
}

export interface ScanSession {
  id: number;
  scanDate: number;
  totalFiles: number;
  uniquePlugins: number;
  scanTime: number;
  errors?: string;
}

export class PluginDatabase {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // Store database in user data directory
    const userDataPath = app.getPath('userData');
    const dbDir = path.join(userDataPath, 'gearshelf');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'plugins.db');
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to open database:', err);
          reject(err);
          return;
        }
        
        console.log('🎸 Database connected:', this.dbPath);
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const queries = [
      // Plugins table - stores individual plugin files
      `CREATE TABLE IF NOT EXISTS plugins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        manufacturer TEXT,
        type TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        format TEXT,
        version TEXT,
        fileSize INTEGER,
        lastModified INTEGER,
        scanDate INTEGER NOT NULL,
        isActive INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        updated_at INTEGER DEFAULT (strftime('%s','now'))
      )`,
      
      // Scan sessions table - tracks scan history
      `CREATE TABLE IF NOT EXISTS scan_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scanDate INTEGER NOT NULL,
        totalFiles INTEGER NOT NULL,
        uniquePlugins INTEGER NOT NULL,
        scanTime INTEGER NOT NULL,
        errors TEXT,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      )`,
      
      // Indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_plugins_path ON plugins(path)`,
      `CREATE INDEX IF NOT EXISTS idx_plugins_type ON plugins(type)`,
      `CREATE INDEX IF NOT EXISTS idx_plugins_manufacturer ON plugins(manufacturer)`,
      `CREATE INDEX IF NOT EXISTS idx_plugins_active ON plugins(isActive)`,
      `CREATE INDEX IF NOT EXISTS idx_scan_sessions_date ON scan_sessions(scanDate)`,
    ];

    for (const query of queries) {
      await this.runQuery(query);
    }

    console.log('🎸 Database tables created successfully');
  }

  private runQuery(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private getQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  public async savePlugins(plugins: Plugin[], scanTime: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const scanDate = Date.now();
    
    try {
      // Start transaction
      await this.runQuery('BEGIN TRANSACTION');

      // Mark all existing plugins as inactive
      await this.runQuery('UPDATE plugins SET isActive = 0, updated_at = ?', [scanDate]);

      // Insert or update plugins
      for (const plugin of plugins) {
        const fileStats = await this.getFileStats(plugin.path);
        
        // Check if plugin already exists
        const existingPlugins = await this.getQuery<DatabasePlugin>(
          'SELECT * FROM plugins WHERE path = ?',
          [plugin.path]
        );

        if (existingPlugins.length > 0) {
          // Update existing plugin
          await this.runQuery(`
            UPDATE plugins SET
              name = ?, manufacturer = ?, type = ?, format = ?,
              fileSize = ?, lastModified = ?, scanDate = ?,
              isActive = 1, updated_at = ?
            WHERE path = ?
          `, [
            plugin.name, plugin.manufacturer, plugin.type, plugin.format,
            fileStats.size, fileStats.mtime, scanDate, scanDate, plugin.path
          ]);
        } else {
          // Insert new plugin
          await this.runQuery(`
            INSERT INTO plugins (
              name, manufacturer, type, path, format,
              fileSize, lastModified, scanDate, isActive
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
          `, [
            plugin.name, plugin.manufacturer, plugin.type, plugin.path, plugin.format,
            fileStats.size, fileStats.mtime, scanDate
          ]);
        }
      }

      // Save scan session
      const uniquePlugins = await this.countUniquePlugins();
      await this.runQuery(`
        INSERT INTO scan_sessions (scanDate, totalFiles, uniquePlugins, scanTime)
        VALUES (?, ?, ?, ?)
      `, [scanDate, plugins.length, uniquePlugins, scanTime]);

      // Commit transaction
      await this.runQuery('COMMIT');
      
      console.log(`🎸 Saved ${plugins.length} plugins to database`);
    } catch (error) {
      // Rollback on error
      await this.runQuery('ROLLBACK');
      throw error;
    }
  }

  private async getFileStats(filePath: string): Promise<{ size: number; mtime: number }> {
    try {
      const stats = fs.statSync(filePath);
      return {
        size: stats.size,
        mtime: stats.mtime.getTime()
      };
    } catch (error) {
      return { size: 0, mtime: 0 };
    }
  }

  public async getActivePlugins(): Promise<DatabasePlugin[]> {
    return this.getQuery<DatabasePlugin>(
      'SELECT * FROM plugins WHERE isActive = 1 ORDER BY manufacturer, name'
    );
  }

  public async getPluginsByType(type: string): Promise<DatabasePlugin[]> {
    return this.getQuery<DatabasePlugin>(
      'SELECT * FROM plugins WHERE isActive = 1 AND type = ? ORDER BY manufacturer, name',
      [type]
    );
  }

  public async getPluginsByManufacturer(manufacturer: string): Promise<DatabasePlugin[]> {
    return this.getQuery<DatabasePlugin>(
      'SELECT * FROM plugins WHERE isActive = 1 AND manufacturer = ? ORDER BY name',
      [manufacturer]
    );
  }

  public async searchPlugins(query: string): Promise<DatabasePlugin[]> {
    const searchQuery = `%${query.toLowerCase()}%`;
    return this.getQuery<DatabasePlugin>(`
      SELECT * FROM plugins 
      WHERE isActive = 1 AND (
        LOWER(name) LIKE ? OR 
        LOWER(manufacturer) LIKE ?
      )
      ORDER BY manufacturer, name
    `, [searchQuery, searchQuery]);
  }

  public async getStatistics(): Promise<{
    totalPlugins: number;
    uniquePlugins: number;
    vst3Count: number;
    vst2Count: number;
    auCount: number;
    manufacturerCount: number;
    lastScanDate?: number;
  }> {
    const [
      totalResult,
      uniqueResult,
      vst3Result,
      vst2Result,
      auResult,
      manufacturerResult,
      lastScanResult
    ] = await Promise.all([
      this.getQuery<{count: number}>('SELECT COUNT(*) as count FROM plugins WHERE isActive = 1'),
      this.countUniquePlugins(),
      this.getQuery<{count: number}>('SELECT COUNT(*) as count FROM plugins WHERE isActive = 1 AND type = "VST3"'),
      this.getQuery<{count: number}>('SELECT COUNT(*) as count FROM plugins WHERE isActive = 1 AND type = "VST2"'),
      this.getQuery<{count: number}>('SELECT COUNT(*) as count FROM plugins WHERE isActive = 1 AND type = "AU"'),
      this.getQuery<{count: number}>('SELECT COUNT(DISTINCT manufacturer) as count FROM plugins WHERE isActive = 1 AND manufacturer IS NOT NULL'),
      this.getQuery<{scanDate: number}>('SELECT scanDate FROM scan_sessions ORDER BY scanDate DESC LIMIT 1')
    ]);

    return {
      totalPlugins: totalResult[0]?.count || 0,
      uniquePlugins: uniqueResult,
      vst3Count: vst3Result[0]?.count || 0,
      vst2Count: vst2Result[0]?.count || 0,
      auCount: auResult[0]?.count || 0,
      manufacturerCount: manufacturerResult[0]?.count || 0,
      lastScanDate: lastScanResult[0]?.scanDate
    };
  }

  private async countUniquePlugins(): Promise<number> {
    // Count unique plugins by normalized name + manufacturer
    const result = await this.getQuery<{count: number}>(`
      SELECT COUNT(*) as count FROM (
        SELECT DISTINCT 
          LOWER(TRIM(name)) as normalized_name,
          LOWER(COALESCE(manufacturer, 'unknown')) as normalized_manufacturer
        FROM plugins 
        WHERE isActive = 1
      )
    `);
    
    return result[0]?.count || 0;
  }

  public async getScanHistory(limit: number = 10): Promise<ScanSession[]> {
    return this.getQuery<ScanSession>(
      'SELECT * FROM scan_sessions ORDER BY scanDate DESC LIMIT ?',
      [limit]
    );
  }

  public async cleanupInactivePlugins(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    await this.runQuery(
      'DELETE FROM plugins WHERE isActive = 0 AND updated_at < ?',
      [cutoffDate]
    );

    const result = await this.getQuery<{changes: number}>(
      'SELECT changes() as changes'
    );
    
    const deletedCount = result[0]?.changes || 0;
    console.log(`🎸 Cleaned up ${deletedCount} inactive plugin records`);
    
    return deletedCount;
  }

  public async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve) => {
        this.db!.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
          } else {
            console.log('🎸 Database connection closed');
          }
          resolve();
        });
      });
    }
  }
}