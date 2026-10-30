/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 'standalone' produces a self-contained Node.js server in .next/standalone/
  // which is what the Docker image copies and runs via `node server.js`.
  // See: https://nextjs.org/docs/pages/api-reference/next-config-js/output
  output: 'standalone',

  // In production the Nginx reverse proxy handles /api/* routing to Django,
  // so the rewrites below only apply in local development (where there is no
  // Nginx and Next.js dev server proxies directly to Gunicorn / Django).
  async rewrites() {
    return process.env.NODE_ENV === 'production'
      ? [] // Nginx handles routing in production — no rewrites needed
      : [
          {
            source: '/api/:path*',
            destination: `${process.env.INTERNAL_API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
          },
        ];
  },
};

export default nextConfig;
