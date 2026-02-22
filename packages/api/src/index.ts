import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { setupDatabase } from './database/connection';
import { errorHandler } from './middleware/errorHandler';

// Import route modules
import pluginRoutes from './routes/plugins';
import categoryRoutes from './routes/categories';
import vendorRoutes from './routes/vendors';
import formatRoutes from './routes/formats';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow embedding for frontend
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3002', 
    'https://gearshelf.io',
    'https://gearshelf.dullvoid.com'
  ],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/plugins', pluginRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/formats', formatRoutes);
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'GearShelf.io API Server',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    await setupDatabase();
    
    app.listen(PORT, () => {
      console.log(`🎧 GearShelf API Server running on port ${PORT}`);
      console.log(`📊 Health endpoint: http://localhost:${PORT}/health`);
      console.log(`🔌 Plugins API: http://localhost:${PORT}/api/plugins`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();