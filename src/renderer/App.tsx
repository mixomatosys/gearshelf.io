import React, { useState, useEffect } from 'react';

const App: React.FC = () => {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const handleScanPlugins = async () => {
    setIsScanning(true);
    setScanMessage('Scanning your plugin directories...');
    
    try {
      const result = await window.electronAPI.scanPlugins();
      
      if (result.success) {
        setScanMessage(`✅ ${result.message}`);
        
        // Get updated plugin list
        const updatedPlugins = await window.electronAPI.getPlugins();
        setPlugins(updatedPlugins);
        
        if (result.errors && result.errors.length > 0) {
          console.warn('Scan completed with warnings:', result.errors);
        }
      } else {
        setScanMessage(`❌ ${result.message}`);
      }
    } catch (error) {
      setScanMessage('❌ Error scanning plugins: ' + error);
      console.error('Scan error:', error);
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
    <div className="h-screen flex flex-col bg-plugin-bg text-plugin-text">
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
                  <span className="font-mono">{plugins.filter(p => p.type === 'VST3').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Audio Units</span>
                  <span className="font-mono">{plugins.filter(p => p.type === 'AU').length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VST2</span>
                  <span className="font-mono">{plugins.filter(p => p.type === 'VST2').length}</span>
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
        <main className="flex-1 p-6 overflow-y-auto">
          {scanMessage && (
            <div className="mb-4 p-3 bg-plugin-card border border-plugin-border rounded-lg">
              <p className="text-sm">{scanMessage}</p>
            </div>
          )}

          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-xl font-semibold mb-2">Welcome to GearShelf!</h2>
              <p className="text-plugin-text-dim mb-6 max-w-lg leading-relaxed">
                Your universal plugin manager for macOS. I'll scan your system for:
              </p>
              <div className="text-left mb-6 space-y-2 text-sm text-plugin-text-dim max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🔵</span>
                  <span><strong>VST3 Plugins</strong> - ~/Library/Audio/Plug-Ins/VST3</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-400">🟢</span>
                  <span><strong>Audio Units</strong> - ~/Library/Audio/Plug-Ins/Components</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">🟣</span>
                  <span><strong>VST2 Plugins</strong> - ~/Library/Audio/Plug-Ins/VST</span>
                </div>
              </div>
              <button
                onClick={handleScanPlugins}
                disabled={isScanning}
                className="bg-plugin-accent hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                🔍 Get Started - Scan Your Plugins
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold">Your Plugin Collection</h2>
                <p className="text-plugin-text-dim text-sm">{plugins.length} plugins found</p>
              </div>
              
              {/* Plugin List - Scrollable */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 plugin-scroll scroll-container">
                {plugins.map((plugin, index) => (
                  <div key={index} className="bg-plugin-card border border-plugin-border p-4 rounded-lg hover:bg-plugin-hover transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              plugin.type === 'VST3' ? 'bg-blue-900 text-blue-200' :
                              plugin.type === 'AU' ? 'bg-green-900 text-green-200' :
                              plugin.type === 'VST2' ? 'bg-purple-900 text-purple-200' :
                              'bg-gray-900 text-gray-200'
                            }`}>
                              {plugin.type || 'Unknown'}
                            </span>
                          </div>
                          <h3 className="font-semibold text-plugin-text">{plugin.name || 'Unknown Plugin'}</h3>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-plugin-text-dim mb-2">
                          {plugin.manufacturer && (
                            <span className="flex items-center gap-1">
                              <span className="text-plugin-accent">🏢</span>
                              {plugin.manufacturer}
                            </span>
                          )}
                          {plugin.format && (
                            <span className="flex items-center gap-1">
                              <span className="text-plugin-accent">🎵</span>
                              {plugin.format}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-plugin-text-dim font-mono bg-plugin-bg px-2 py-1 rounded truncate">
                          {plugin.path}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 ml-4">
                        <button className="text-plugin-text-dim hover:text-plugin-accent transition-colors">
                          <span className="text-lg">⚙️</span>
                        </button>
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