// Quick demo server to show authentication working
const express = require('express');
const cors = require('cors');
const { setupDatabase } = require('./dist/database/connection');
const authRoutes = require('./dist/routes/auth').default;

const app = express();
const PORT = 3333;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test authentication routes
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'GearShelf Authentication Demo',
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login', 
      'GET /api/auth/me',
      'POST /api/auth/logout'
    ],
    status: 'ready'
  });
});

async function startDemo() {
  try {
    // Set up database connection
    const dbPool = await setupDatabase();
    app.set('db', dbPool);
    
    app.listen(PORT, () => {
      console.log(`🎧 GearShelf Auth Demo running on http://localhost:${PORT}`);
      console.log(`🔐 Test endpoints:`);
      console.log(`   POST http://localhost:${PORT}/api/auth/register`);
      console.log(`   POST http://localhost:${PORT}/api/auth/login`);
      console.log(`   GET  http://localhost:${PORT}/api/auth/me`);
    });
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

startDemo();