import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// A nonce-free, host-allowlist CSP. It lives here (a STATIC header) rather than in
// middleware because the home page is statically prerendered: a per-request nonce
// can't be stamped onto static <script> tags, so a nonce+strict-dynamic policy
// blocks ALL JS in production (the splash freezes at 0%). This policy needs no
// per-request value, so it works on static and dynamic responses alike.
// 'unsafe-inline' is required for Next's inline bootstrap scripts (no nonce);
// 'unsafe-eval' is dev-only (Turbopack). Google Maps + Vercel Speed Insights load
// from the allow-listed hosts.
const isDev = process.env.NODE_ENV === 'development';
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.tile.openstreetmap.org`,
  `connect-src 'self' https://*.googleapis.com https://*.gstatic.com${isDev ? ' ws:' : ''}`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
