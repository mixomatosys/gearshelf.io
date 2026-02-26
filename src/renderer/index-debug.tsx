console.log('🎸 DEBUG: React entry point starting...');

import React from 'react';
import { createRoot } from 'react-dom/client';

console.log('🎸 DEBUG: React and createRoot imported successfully');

// Super simple test component
const TestApp = () => {
  console.log('🎸 DEBUG: TestApp component rendering...');
  
  return (
    <div style={{
      height: '100vh',
      backgroundColor: '#1e1e1e',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>🎸 React Test Success!</h1>
      <p style={{ fontSize: '18px', marginBottom: '20px' }}>If you see this, React is working!</p>
      <button 
        style={{
          padding: '12px 24px',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
        onClick={() => alert('React event handlers work!')}
      >
        Test Button
      </button>
    </div>
  );
};

console.log('🎸 DEBUG: Looking for root element...');
const container = document.getElementById('root');

if (!container) {
  console.error('🎸 ERROR: Root element not found!');
  throw new Error('Root element not found');
}

console.log('🎸 DEBUG: Root element found, creating React root...');

try {
  const root = createRoot(container);
  console.log('🎸 DEBUG: React root created, rendering app...');
  
  root.render(<TestApp />);
  console.log('🎸 DEBUG: React app rendered successfully!');
} catch (error) {
  console.error('🎸 ERROR: Failed to render React app:', error);
}