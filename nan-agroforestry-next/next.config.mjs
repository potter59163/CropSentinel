import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// CSP (with per-request nonce) lives in middleware.ts since it needs a fresh
// nonce per request; these are the remaining headers that are the same on
// every response, applied broadly (pages, API routes, and static assets).
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  turbopack: { root },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tile.openstreetmap.org' },
      { protocol: 'https', hostname: '*.tile.openstreetmap.org' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
