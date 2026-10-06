import type { NextConfig } from "next";

// Ensure NEXTAUTH_URL is never empty string or malformed during build time
const rawUrl = process.env.NEXTAUTH_URL?.trim();
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const fallbackUrl = vercelHost
  ? `https://${vercelHost.replace(/^https?:\/\//, '')}`
  : 'http://localhost:3000';

const resolvedAuthUrl =
  rawUrl && rawUrl.length > 0
    ? (rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`)
    : fallbackUrl;

process.env.NEXTAUTH_URL = resolvedAuthUrl;

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: resolvedAuthUrl,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
