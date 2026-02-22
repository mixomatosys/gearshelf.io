#!/bin/bash

# Deploy API to LXC 121 container
echo "🚀 Deploying GearShelf API to LXC 121..."

# Create app directory
echo "📁 Creating app directory..."
ssh root@192.168.1.53 "pct exec 121 -- mkdir -p /opt/gearshelf/api"

# Copy source files
echo "📋 Copying API source files..."
scp -r src/ root@192.168.1.53:/tmp/api-src/
ssh root@192.168.1.53 "cp -r /tmp/api-src/* 121:opt/gearshelf/api/ && rm -rf /tmp/api-src"

# Copy package files
echo "📦 Copying package configuration..."
scp package.json root@192.168.1.53:/tmp/
scp tsconfig.json root@192.168.1.53:/tmp/
scp .env root@192.168.1.53:/tmp/
ssh root@192.168.1.53 "
  cp /tmp/package.json 121:/opt/gearshelf/api/ &&
  cp /tmp/tsconfig.json 121:/opt/gearshelf/api/ &&
  cp /tmp/.env 121:/opt/gearshelf/api/ &&
  rm /tmp/package.json /tmp/tsconfig.json /tmp/.env
"

# Install dependencies in container
echo "📥 Installing dependencies in container..."
ssh root@192.168.1.53 "pct exec 121 -- bash -c 'cd /opt/gearshelf/api && npm install'"

# Build TypeScript
echo "🔨 Building TypeScript..."
ssh root@192.168.1.53 "pct exec 121 -- bash -c 'cd /opt/gearshelf/api && npm run build'"

echo "✅ Deployment complete!"
echo "🎧 Start with: ssh root@192.168.1.53 \"pct exec 121 -- bash -c 'cd /opt/gearshelf/api && npm start'\""