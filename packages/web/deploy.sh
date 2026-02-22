#!/bin/bash
# Deploy GearShelf frontend to web hosting container

set -e

echo "🚀 Deploying GearShelf frontend to web container..."

# Configuration
WEB_HOST="root@192.168.1.53"
WEB_CONTAINER_PATH="/var/lib/lxc/120/rootfs/var/www/apps"
APP_NAME="gearshelf-web"
DOMAIN="gearshelf.dullvoid.com"

# Build production version
echo "📦 Building production version..."
npm run build

# Create deployment package
echo "📁 Creating deployment package..."
mkdir -p dist-deploy
cp -r .next dist-deploy/
cp -r public dist-deploy/ 2>/dev/null || true
cp package.json dist-deploy/
cp next.config.js dist-deploy/

# Create production package.json
cat > dist-deploy/package.json << EOF
{
  "name": "gearshelf-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "next start -p 3002"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  }
}
EOF

# Copy to web container
echo "📤 Copying to web container..."
ssh $WEB_HOST "mkdir -p $WEB_CONTAINER_PATH/$APP_NAME"
rsync -avz --delete dist-deploy/ $WEB_HOST:$WEB_CONTAINER_PATH/$APP_NAME/

# Create systemd service
echo "⚙️ Creating systemd service..."
ssh $WEB_HOST "pct exec 120 -- bash -c 'cat > /etc/systemd/system/gearshelf-web.service << \"EOF\"
[Unit]
Description=GearShelf Web Frontend
Documentation=https://gearshelf.io
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/apps/gearshelf-web
Environment=NODE_ENV=production
Environment=NEXT_PUBLIC_API_URL=https://gearshelf.io
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3002
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=gearshelf-web

[Install]
WantedBy=multi-user.target
EOF'"

# Install dependencies and start service
echo "📦 Installing dependencies..."
ssh $WEB_HOST "pct exec 120 -- bash -c 'cd /var/www/apps/gearshelf-web && npm install --production'"

echo "🔄 Starting service..."
ssh $WEB_HOST "pct exec 120 -- systemctl daemon-reload"
ssh $WEB_HOST "pct exec 120 -- systemctl enable gearshelf-web"
ssh $WEB_HOST "pct exec 120 -- systemctl restart gearshelf-web"

# Create nginx configuration
echo "🌐 Configuring nginx..."
ssh $WEB_HOST "pct exec 115 -- bash -c 'cat > /etc/nginx/sites-available/gearshelf-web << \"EOF\"
server {
    listen 80;
    server_name gearshelf.dullvoid.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gearshelf.dullvoid.com;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/gearshelf.dullvoid.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gearshelf.dullvoid.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Proxy to Next.js app
    location / {
        proxy_pass http://192.168.1.120:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # API proxy (to backend)
    location /api/ {
        proxy_pass https://gearshelf.io/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF'"

# Enable site and reload nginx
ssh $WEB_HOST "pct exec 115 -- ln -sf /etc/nginx/sites-available/gearshelf-web /etc/nginx/sites-enabled/"
ssh $WEB_HOST "pct exec 115 -- nginx -t && systemctl reload nginx"

echo "✅ Deployment complete!"
echo "🌐 Frontend available at: https://gearshelf.dullvoid.com"
echo "📊 Service status:"
ssh $WEB_HOST "pct exec 120 -- systemctl status gearshelf-web --no-pager"

# Clean up
rm -rf dist-deploy

echo "🎉 GearShelf frontend deployed successfully!"