import { NextResponse, type NextRequest } from "next/server";

import { EnvironmentDemoAuthProvider, EntraAuthenticationProvider, SESSION_COOKIE, createSessionToken } from "@/server/auth";
import { getServerConfiguration, requireServerSecret } from "@/server/config";
import { apiHandler } from "@/server/http";
import { getPlatformRepository } from "@/server/platform";

export async function POST(request: NextRequest) {
  return apiHandler(request, async () => {
    const configuration = getServerConfiguration();
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } }, { status: 400 });
    }
    const provider = configuration.authProvider === "entra"
      ? new EntraAuthenticationProvider()
      : new EnvironmentDemoAuthProvider(process.env.DEMO_AUTH_USERS_JSON);
    const principal = await provider.authenticate({ email: body.email, password: body.password });
    if (!principal) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid credentials." } }, { status: 401 });
    const repository = getPlatformRepository();
    const timestamp = new Date().toISOString();
    await Promise.all([
      repository.putOrganization({ id: principal.organizationId, name: principal.organizationName, createdAt: timestamp }),
      repository.putUser({
        id: principal.userId, organizationId: principal.organizationId, email: principal.email,
        displayName: principal.displayName, role: principal.role, active: true, createdAt: timestamp,
      }),
      repository.appendAudit({
        id: crypto.randomUUID(), organizationId: principal.organizationId, timestamp,
        actorId: principal.userId, actorRole: principal.role, action: "LOGIN",
      }),
    ]);
    const response = NextResponse.json({ user: principal });
    response.cookies.set(SESSION_COOKIE, createSessionToken(principal, requireServerSecret(configuration)), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60,
    });
    return response;
  });
}
