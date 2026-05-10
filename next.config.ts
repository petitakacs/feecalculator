import type { NextConfig } from "next";

// Fail fast in production if critical secrets are missing or weak
if (process.env.NODE_ENV === "production") {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET must be at least 32 characters in production. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
}

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Enforce HTTPS for 2 years, including subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Restrict referrer info
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features not needed by the app
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Content Security Policy
  // 'unsafe-inline' for styles is required by Tailwind CSS (no hashes/nonces currently)
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'", // Next.js dev mode needs unsafe-eval; remove in prod builds
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:", // data: for QR codes
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  // Extra XSS filter for older browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
