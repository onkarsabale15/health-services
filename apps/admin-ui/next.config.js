/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hs/config', '@/lib/sdk/generated'],
  // Speed up builds by skipping lint + type check (turbo handles these separately)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    const workflowUiOrigin = process.env.NEXT_PUBLIC_WORKFLOW_UI_URL || 'http://localhost:3005';
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Allow workflow-ui to iframe the signin page for session-expired re-login
          { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${workflowUiOrigin}` },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
