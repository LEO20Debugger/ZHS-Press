/**
 * Security headers are defined here rather than in vercel.json so they apply
 * wherever this runs — Vercel, a container, or a local `next start`. A header
 * set only in the host's config silently disappears the day you move hosts.
 */
const securityHeaders = [
  // The admin area and checkout must never be framed by another site.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Only meaningful over HTTPS; harmless locally.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zhs/ui', '@zhs/shared'],

  // A failing typecheck must fail the deploy. Next's defaults already do this;
  // stating it means nobody "fixes" a red build by flipping it off.
  typescript: { ignoreBuildErrors: false },
  // ESLint is not configured in this app yet; it runs as its own CI step.
  eslint: { ignoreDuringBuilds: true },

  // Trims the response and stops advertising the framework version.
  poweredByHeader: false,

  images: {
    formats: ['image/avif', 'image/webp'],
    // Widths next/image is allowed to generate. Trimmed to what this design
    // actually uses — every extra entry is another variant to build and cache.
    deviceSizes: [480, 768, 1024, 1280],
    imageSizes: [96, 200, 300, 450],
    // Covers are immutable once published; cache the optimised variants hard.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // When product images move to object storage, add its host here or
    // next/image will refuse to optimise them.
    // remotePatterns: [{ protocol: 'https', hostname: 'assets.zhspress.org' }],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        // Cover artwork is content-addressed by filename and never edited in
        // place, so it can be cached indefinitely.
        source: '/covers/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  async redirects() {
    return [
      // Legacy WooCommerce URLs from the old site. The database-driven
      // redirect table in middleware handles the rest; these two are the
      // structural ones worth pinning here so they survive an empty table.
      { source: '/product/:slug', destination: '/shop/:slug', permanent: true },
      { source: '/product-category/:slug', destination: '/shop', permanent: true },
    ];
  },
};

export default nextConfig;
