/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://gearshelf.io/api/:path*' // Proxy to our API
      }
    ]
  }
}

module.exports = nextConfig