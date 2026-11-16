/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: true,
  
  // 1. Hanya sisakan puppeteer-core dan sparticuz
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  
  // 2. Paksa Vercel menyertakan file binary Chromium ke dalam Serverless Function
  outputFileTracingIncludes: {
    '/api/generate-pdf': [
      './node_modules/@sparticuz/chromium/bin/**',
    ],
  },

  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    // serverComponentsExternalPackages sudah dipindah ke root (serverExternalPackages)
  },
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    navigationPreload: false, 
    runtimeCaching: [
      {
        urlPattern: /\/auth\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkOnly', 
      },
      {
        urlPattern: ({ url }) => url.searchParams.has('_rsc'),
        handler: 'StaleWhileRevalidate', 
        options: { 
          cacheName: 'rsc-payloads', 
          expiration: { maxEntries: 50, maxAgeSeconds: 86400 } 
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|json)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'static-assets', expiration: { maxEntries: 50, maxAgeSeconds: 2592000 } },
      },
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
});

module.exports = withPWA(nextConfig);