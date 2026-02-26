import React from 'react';

const App: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-2xl font-bold">🎸 GearShelf - TEST MODE</h1>
        <p className="text-gray-400 text-sm">Universal Plugin Manager</p>
      </header>
      
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎵</div>
          <h2 className="text-xl font-semibold mb-2">UI Test Successful!</h2>
          <p className="text-gray-400 mb-6">
            If you can see this, React is working properly.
          </p>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg">
            Test Button
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;