import type { NextConfig } from 'next';

// Sign in runs on AUTH_ORIGIN (gitgochi.vercel.app) so the GitHub OAuth callback never lands on the custom
// domain; everything else on that host goes back to APP_ORIGIN (accounts design, "Sign-in host").
const app = process.env.APP_ORIGIN;
const auth = process.env.AUTH_ORIGIN;
const authHost = auth ? new URL(auth).host : null;

const nextConfig: NextConfig = {
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
