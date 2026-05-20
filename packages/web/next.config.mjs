/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  // We import .ts directly from workspace packages; let webpack pick them up.
  transpilePackages: ["@screendeck/core", "@screendeck/renderer"],
  // @napi-rs/canvas ships native .node binaries — Next must keep it external
  // so the server bundle doesn't try to inline it.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
