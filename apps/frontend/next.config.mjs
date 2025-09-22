/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "";
    const ml = process.env.NEXT_PUBLIC_ML_URL || "";
    const rules = [];
    if (backend) {
      rules.push({ source: "/api/:path*", destination: `${backend}/:path*` });
    }
    if (ml) {
      rules.push({ source: "/ml/:path*", destination: `${ml}/:path*` });
    }
    return rules;
  },
};

export default nextConfig;

