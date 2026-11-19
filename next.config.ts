import type { NextConfig } from 'next';

// Sign in runs on AUTH_ORIGIN (gitgochi.vercel.app) so the GitHub OAuth callback never lands on the custom
// domain; everything else on that host goes back to APP_ORIGIN (accounts design, "Sign-in host").
const app = process.env.APP_ORIGIN;
const auth = process.env.AUTH_ORIGIN;
const authHost = auth ? new URL(auth).host : null;

// Production CSP. Next.js streams inline bootstrap scripts, so scripts allow 'unsafe-inline' but only from this
// origin; nothing on the site renders user HTML. The rest is strict: no framing (clickjacking on keeper
// actions), no plugins, no foreign forms, no base-tag tricks.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // Dev needs eval for fast refresh, so the policy only ships in production builds.
    if (process.env.NODE_ENV !== 'production') return [];
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async redirects() {
    if (!app || !authHost || authHost === new URL(app).host) return [];
    return [
      {
        source: '/:path((?!api/auth/(?:login|callback)$).*)',
        has: [{ type: 'host', value: authHost }],
        destination: `${app}/:path`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
