import type { NextConfig } from "next";

function configuredAzureApiOrigin(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_AZURE_API_URL?.trim();
  if (!configured) return undefined;
  try {
    return new URL(configured).origin;
  } catch {
    return undefined;
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const azureApiOrigin = configuredAzureApiOrigin();
    const connectSources = ["'self'", azureApiOrigin].filter(Boolean).join(" ");
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; connect-src ${connectSources}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      ],
    }];
  },
};

export default nextConfig;
