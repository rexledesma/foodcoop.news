import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    if (!config.resolve.extensions?.includes('.svelte')) {
      config.resolve.extensions = [...(config.resolve.extensions ?? []), '.svelte'];
    }

    config.resolve.mainFields = Array.from(
      new Set(['svelte', ...(config.resolve.mainFields ?? [])]),
    );
    config.resolve.conditionNames = Array.from(
      new Set(['svelte', ...(config.resolve.conditionNames ?? [])]),
    );

    config.module.rules.push(
      {
        test: /\.(svelte|svelte\.js)$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: {
              dev: process.env.NODE_ENV !== 'production',
            },
          },
        },
      },
      {
        test: /node_modules[\\/]svelte[\\/].*\.mjs$/,
        resolve: {
          fullySpecified: false,
        },
      },
    );

    return config;
  },
};

export default nextConfig;
