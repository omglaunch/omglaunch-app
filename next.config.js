/** @type {import('next').NextConfig} */
const nextConfig = {
  // sonner: keep a single client module so toast() and <Toaster /> share state
  transpilePackages: ['@google/genai', 'sonner'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: [
      '@prisma/client',
      '@google/genai',
      'cheerio',
      'puppeteer-core',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
      '@sparticuz/chromium',
      '@mohtasham/md-to-docx',
      'marked',
    ],
  },
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };

    // Route handlers must load Prisma from node_modules at runtime — not a stale webpack bundle.
    if (isServer) {
      config.externals = [...(config.externals ?? []), '@prisma/client', '.prisma/client'];
    }

    return config;
  },
};

module.exports = nextConfig;
