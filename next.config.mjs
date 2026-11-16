/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mongodb", "node-cron"],
  // people.yaml is read at runtime through a path built from PEOPLE_FILE, so Next's file
  // tracing cannot see it. Without this a serverless bundle ships with no team list and
  // every request dies with ENOENT.
  outputFileTracingIncludes: { "/**": ["./people.yaml"] },
};
export default nextConfig;
