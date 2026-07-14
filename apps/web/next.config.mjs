/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // packages/shared là TypeScript nguồn thuần (workspace:*), cần transpile qua Next.js.
  transpilePackages: ["@field-notes/shared"],
};

export default nextConfig;
