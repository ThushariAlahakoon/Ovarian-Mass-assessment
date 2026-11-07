import path from 'node:path';
import type { NextConfig } from 'next';

const root = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@cfwu/engine'],
  turbopack: { root },
  outputFileTracingRoot: root,
  // Prototype: no patient identifiers ever go in URLs; exams are addressed by a random internal id.
  poweredByHeader: false,
};

export default nextConfig;
