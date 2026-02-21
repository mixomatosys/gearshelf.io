# 🛠️ Development Guide

## Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0  
- **PostgreSQL** (for API development)
- **Git**

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/mixomatosys/gearshelf.git
   cd gearshelf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   # Start all services
   npm run dev

   # Or start individual components
   npm run api:dev     # Backend API on port 3001
   npm run web:dev     # Web frontend on port 3000
   npm run desktop:dev # Electron desktop app
   ```

## Project Structure

```
gearshelf/
├── packages/
│   ├── api/              # Backend API
│   │   ├── src/
│   │   │   ├── routes/   # Express routes
│   │   │   ├── models/   # Database models
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── web/              # Web frontend  
│   │   ├── src/
│   │   │   ├── pages/    # Next.js pages
│   │   │   ├── components/
│   │   │   └── styles/
│   │   └── package.json
│   ├── desktop/          # Desktop app
│   │   ├── src/
│   │   │   ├── main.ts   # Electron main process
│   │   │   └── renderer/ # React renderer
│   │   └── package.json
│   ├── mobile/           # Mobile app (future)
│   └── shared/           # Shared code
│       ├── types/        # TypeScript types
│       ├── utils/        # Utility functions
│       └── constants/    # App constants
├── docs/                 # Documentation
├── scripts/              # Build/deploy scripts
└── package.json          # Root package.json
```

## Development Workflow

### 1. Backend API (`packages/api`)

```bash
# Start API server
npm run api:dev

# Database setup (PostgreSQL required)
createdb gearshelf_dev
npm run db:migrate
npm run db:seed
```

### 2. Web Frontend (`packages/web`)

```bash
# Start Next.js dev server
npm run web:dev

# Build for production
cd packages/web && npm run build
```

### 3. Desktop App (`packages/desktop`)

```bash
# Start Electron app
npm run desktop:dev

# Build for distribution
cd packages/desktop && npm run build
```

## Environment Variables

Create `.env` files in each package directory:

### `packages/api/.env`
```
DATABASE_URL=postgresql://localhost:5432/gearshelf_dev
JWT_SECRET=your_jwt_secret_here
PORT=3001
```

### `packages/web/.env.local`  
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Database Schema

The database will include tables for:
- **plugins** - Plugin information  
- **users** - User accounts
- **user_inventories** - Personal plugin collections
- **reviews** - Plugin reviews and ratings
- **categories** - Plugin categories/tags

## Testing

```bash
# Run all tests
npm test

# Run tests for specific package
npm run test -w packages/api
npm run test -w packages/web
```

## Code Style

- **ESLint** for linting
- **Prettier** for formatting
- **TypeScript** for type safety

```bash
# Lint all packages
npm run lint

# Format code
npx prettier --write .
```

## Git Workflow

1. Create feature branch: `git checkout -b feature/plugin-search`
2. Make changes and commit: `git commit -m "Add plugin search functionality"`
3. Push branch: `git push origin feature/plugin-search`
4. Create pull request

## Common Issues

### Port Conflicts
- API: 3001
- Web: 3000
- Make sure these ports are available

### Database Connection
- Ensure PostgreSQL is running
- Check connection string in `.env`

### Electron Issues
- May need to rebuild native modules: `npm run rebuild`

## Deployment

See [Deployment Guide](./deployment.md) for production deployment instructions.