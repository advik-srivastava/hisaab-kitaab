import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/server/http";
import { getPlatformService, PlatformError, type PolicyDefinition, type PolicyState } from "@/server/platform";

export async function GET(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => NextResponse.json({ items: await getPlatformService().listPolicies(principal) }));
}

export async function POST(request: NextRequest) {
  return apiHandler(request, async ({ principal }) => {
    const body = await request.json() as { name?: unknown; state?: unknown; definition?: unknown };
    if (typeof body.name !== "string" || !["DRAFT", "ACTIVE", "RETIRED"].includes(String(body.state)) || !body.definition) {
      throw new PlatformError("VALIDATION_ERROR", "Policy name, state, and definition are required.", 400);
    }
    return NextResponse.json(await getPlatformService().savePolicy(principal, {
      name: body.name,
      state: body.state as PolicyState,
      definition: body.definition as PolicyDefinition,
    }), { status: 201 });
  });
}
