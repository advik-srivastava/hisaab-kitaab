import { NextResponse } from "next/server";

import { getServerConfiguration, integrationStatus } from "@/server/config";

export async function GET() {
  const configuration = getServerConfiguration();
  const integrations = integrationStatus(configuration);
  const healthy = configuration.appMode === "LOCAL_DEMO"
    || (integrations.database === "CONFIGURED" && integrations.authentication !== "CONFIGURATION_REQUIRED");
  return NextResponse.json({
    status: healthy ? "healthy" : "degraded",
    application: "healthy",
    mode: configuration.appMode,
    integrations,
  }, { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}
