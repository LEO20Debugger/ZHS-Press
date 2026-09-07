/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zhs/ui', '@zhs/shared'],
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
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
