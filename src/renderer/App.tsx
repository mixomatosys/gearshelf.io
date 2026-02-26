import React, { useState, useEffect } from 'react';

const App: React.FC = () => {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const handleScanPlugins = async () => {
    setIsScanning(true);
    setScanMessage('Scanning for plugins...');
    
    try {
      const result = await window.electronAPI.scanPlugins();
      setScanMessage(result.message || 'Scan completed!');
      
      // Get updated plugin list
      const updatedPlugins = await window.electronAPI.getPlugins();
      setPlugins(updatedPlugins);
    } catch (error) {
      setScanMessage('Error scanning plugins: ' + error);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    // Load existing plugins on startup
    const loadPlugins = async () => {
      try {
        const existingPlugins = await window.electronAPI.getPlugins();
        setPlugins(existingPlugins);
      } catch (error) {
        console.error('Error loading plugins:', error);
      }
    };

    loadPlugins();
  }, []);

  return (
    <div className="h-full flex flex-col bg-plugin-bg text-plugin-text">
      {/* Header */}
      <header className="bg-plugin-card border-b border-plugin-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-plugin-text">🎸 GearShelf</h1>
            <p className="text-plugin-text-dim text-sm">Universal Plugin Manager</p>
          </div>
          <button
            onClick={handleScanPlugins}
            disabled={isScanning}
            className="bg-plugin-accent hover:bg-blue-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {isScanning ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Scanning...
              </>
            ) : (
              <>
                🔍 Scan Plugins
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-plugin-card border-r border-plugin-border p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-plugin-text-dim mb-2">STATISTICS</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Plugins</span>
                  <span className="font-mono">{plugins.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VST3</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Audio Units</span>
                  <span className="font-mono">0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VST2</span>
                  <span className="font-mono">0</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-plugin-text-dim mb-2">QUICK ACTIONS</h3>
              <div className="space-y-2">
                <button className="w-full text-left text-sm px-3 py-2 rounded bg-plugin-bg hover:bg-plugin-hover transition-colors">
                  📊 Export List
                </button>
                <button className="w-full text-left text-sm px-3 py-2 rounded bg-plugin-bg hover:bg-plugin-hover transition-colors">
                  ⚙️ Settings
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Plugin Area */}
        <main className="flex-1 p-6">
          {scanMessage && (
            <div className="mb-4 p-3 bg-plugin-card border border-plugin-border rounded-lg">
              <p className="text-sm">{scanMessage}</p>
            </div>
          )}

          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-xl font-semibold mb-2">Welcome to GearShelf!</h2>
              <p className="text-plugin-text-dim mb-6 max-w-md">
                Your universal plugin manager. Click "Scan Plugins" to discover all the audio plugins installed on your system.
              </p>
              <button
                onClick={handleScanPlugins}
                disabled={isScanning}
                className="bg-plugin-accent hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                🔍 Get Started - Scan Your Plugins
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Your Plugin Collection</h2>
                <p className="text-plugin-text-dim text-sm">{plugins.length} plugins found</p>
              </div>
              
              {/* Plugin List */}
              <div className="space-y-2">
                {plugins.map((plugin, index) => (
                  <div key={index} className="plugin-row p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{plugin.name || 'Unknown Plugin'}</h3>
                        <p className="text-sm text-plugin-text-dim">
                          {plugin.manufacturer || 'Unknown'} • {plugin.type || 'Unknown Type'}
                        </p>
                      </div>
                      <div className="text-xs text-plugin-text-dim">
                        {plugin.path}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;