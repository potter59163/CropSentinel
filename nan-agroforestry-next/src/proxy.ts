import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Per-request nonce + strict-dynamic CSP (Next.js's documented pattern:
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
// Next.js auto-applies this nonce to its own framework-rendered <script> tags once it
// sees the header below, so no changes are needed in layout.tsx. 'strict-dynamic' also
// extends trust to scripts created at runtime by an already-trusted script — which is
// how both the Google Maps JS loader (GoogleMapPicker.tsx) and @vercel/speed-insights
// inject their <script src=...> tags — so no external host allowlist is required for
// them either. The explicit host sources below are kept only as a fallback for the
// small set of browsers that don't support strict-dynamic.
export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://maps.googleapis.com${isDev ? " 'unsafe-eval'" : ''}`,
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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
