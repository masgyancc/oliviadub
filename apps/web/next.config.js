const { withPlausibleProxy } = require("next-plausible");

// Suppress specific external package warnings
// Self-hosting: root domain of this instance, regex-escaped (e.g. "lilac-orbit\.com")
const SELF_HOST_ROOT_DOMAIN_RE = (process.env.NEXT_PUBLIC_APP_DOMAIN || "app.dub.co")
  .replace(/^app\./, "")
  .replace(/[.]/g, "[.]");

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  const message = args.join(" ");
  if (
    message.includes("Package mongodb can't be external") ||
    message.includes("Package pg can't be external") ||
    message.includes("Package sqlite3 can't be external") ||
    message.includes("Package typeorm can't be external") ||
    message.includes("matches serverExternalPackages") ||
    message.includes("Try to install it into the project directory")
  ) {
    return; // Suppress these warnings
  }
  originalConsoleWarn.apply(console, args);
};

/** @type {import('next').NextConfig} */
module.exports = withPlausibleProxy({
  src: "https://plausible.io/js/pa-T9BPIqC3D0XQFZnP1vHfN.js",
  scriptPath: "/_proxy/plausible/script.js",
  apiPath: "/_proxy/plausible/event",
})({
  reactStrictMode: false,
  transpilePackages: [
    "prettier",
    "shiki",
    "@dub/email",
    "@boxyhq/saml-jackson",
  ],
  outputFileTracingIncludes: {
    "/api/auth/saml/token": [
      "./node_modules/jose/**/*",
      "./node_modules/openid-client/**/*",
    ],
  },
  // Self-hosting: Vercel Hobby build machines (basic) hit OOM during the
  // "Linting and checking validity of types" phase of this monorepo. Both
  // checks run locally (tsc --noEmit / next lint) before pushing, so skip
  // them inside the Vercel build.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Self-hosting: limit static-generation workers and trim webpack memory;
    // the default worker count OOMs on 8 GB Vercel build machines.
    cpus: 1,
    staticGenerationMaxConcurrency: 2,
    // run webpack in a separate process so its heap is released before the
    // static-generation phase starts
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    optimizePackageImports: [
      "@dub/email",
      "@dub/ui",
      // Disabled: causes "Module not found: chunk-WKSJXYEU.mjs" on Vercel due to tsup's chunked output
      // "@dub/utils",
      "@team-plain/typescript-sdk",
    ],
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  webpack: (config, { webpack, isServer }) => {
    if (isServer) {
      config.plugins.push(
        // mute errors for unused typeorm deps
        new webpack.IgnorePlugin({
          resourceRegExp:
            /(^@google-cloud\/spanner|^@mongodb-js\/zstd|^aws-crt|^aws4$|^pg-native$|^mongodb-client-encryption$|^@sap\/hana-client$|^@sap\/hana-client\/extension\/Stream$|^snappy$|^react-native-sqlite-storage$|^bson-ext$|^cardinal$|^kerberos$|^hdb-pool$|^sql.js$|^sqlite3$|^better-sqlite3$|^ioredis$|^typeorm-aurora-data-api-driver$|^pg-query-stream$|^oracledb$|^mysql$|^snappy\/package\.json$|^cloudflare:sockets$)/,
        }),
      );
    }

    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    return config;
  },
  images: {
    remotePatterns: [
      // self-hosting: allow images from the configured storage bucket
      ...(process.env.STORAGE_BASE_URL
        ? [{ hostname: new URL(process.env.STORAGE_BASE_URL).hostname }]
        : []),
      {
        hostname: "assets.dub.co", // for Dub's static assets
      },
      {
        hostname: "dubassets.com", // for Dub's user generated images
      },
      {
        hostname: "dev.dubassets.com", // dev bucket
      },
      {
        hostname: "www.google.com",
      },
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "faisalman.github.io",
      },
      {
        hostname: "api.dicebear.com",
      },
      {
        hostname: "pbs.twimg.com",
      },
      {
        hostname: "lh3.googleusercontent.com",
      },
      {
        hostname: "avatars.githubusercontent.com",
      },
      {
        hostname: "media.cleanshot.cloud", // only for staging purposes
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer-when-downgrade",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/api/:path*",
        missing: [
          {
            type: "host",
            // Self-hosting: also allow the instance's own root domain
            // (derived from NEXT_PUBLIC_APP_DOMAIN), otherwise every
            // /api/* request (incl. NextAuth) is redirected to "/".
            value: `.*(\\.dub\\.co|localhost|\\.${SELF_HOST_ROOT_DOMAIN_RE})`,
          },
        ],
        destination: "/",
        permanent: false,
      },
      {
        source: "/",
        has: [
          {
            type: "host",
            value: "app.dub.sh",
          },
        ],
        destination: "https://app.dub.co",
        permanent: true,
        statusCode: 301,
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "app.dub.sh",
          },
        ],
        destination: "https://app.dub.co/:path*",
        permanent: true,
        statusCode: 301,
      },
    ];
  },
  async rewrites() {
    return [
      // for dub proxy
      {
        source: "/_proxy/dub/script.js",
        destination: "https://www.dubcdn.com/analytics/script.js",
      },
      {
        source: "/_proxy/dub/track/:path*",
        destination: "https://api.dub.co/track/:path*",
      },
    ];
  },
});
