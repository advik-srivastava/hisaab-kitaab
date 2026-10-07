import type { NextRequest } from "next/server";

import { getServerConfiguration, requireServerSecret } from "../config";
import type { AuthenticatedPrincipal } from "../platform/types";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export function principalFromRequest(request: NextRequest): AuthenticatedPrincipal | undefined {
  const configuration = getServerConfiguration();
  if (configuration.appMode !== "SERVER") return undefined;
  const secret = requireServerSecret(configuration);
  return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
}
