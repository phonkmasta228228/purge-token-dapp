import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    // Set root to this project to avoid workspace lockfile detection warnings
    root: path.resolve(__dirname),
    resolveAlias: {
      // Node.js built-in polyfills for browser (Solana wallet adapters need these)
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      http: 'stream-http',
      https: 'https-browserify',
      assert: 'assert',
      os: 'os-browserify/browser',
      path: 'path-browserify',
      buffer: 'buffer',
      url: 'url',
      events: 'events',
    },
  },
  // Webpack config for build-time polyfills
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      zlib: require.resolve('browserify-zlib'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      assert: require.resolve('assert'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer'),
      url: require.resolve('url'),
      events: require.resolve('events'),
      process: require.resolve('process/browser'),
      util: require.resolve('util'),
      querystring: require.resolve('querystring-es3'),
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };
    
    // Add buffer polyfill globally
    config.plugins.push(
      new config.constructor.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      })
    );
    
    return config;
  },
};

export default nextConfig;
