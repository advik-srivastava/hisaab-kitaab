import { createHmac, timingSafeEqual } from "node:crypto";

import { PlatformError } from "../platform/errors";
import type { AuthenticatedPrincipal } from "../platform/types";

export const SESSION_COOKIE = "hisaab_session";

interface SessionPayload extends AuthenticatedPrincipal {
  issuedAt: number;
  expiresAt: number;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  principal: AuthenticatedPrincipal,
  secret: string,
  now = new Date(),
  lifetimeSeconds = 8 * 60 * 60,
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = { ...principal, issuedAt, expiresAt: issuedAt + lifetimeSeconds };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = new Date(),
): AuthenticatedPrincipal | undefined {
  if (!token) return undefined;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return undefined;
  const expected = sign(encoded, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.organizationId || !payload.role || payload.expiresAt <= Math.floor(now.getTime() / 1000)) return undefined;
    const { issuedAt: _issuedAt, expiresAt: _expiresAt, ...principal } = payload;
    void _issuedAt;
    void _expiresAt;
    return principal;
  } catch {
    return undefined;
  }
}

export function requireSession(token: string | undefined, secret: string): AuthenticatedPrincipal {
  const principal = verifySessionToken(token, secret);
  if (!principal) throw new PlatformError("UNAUTHENTICATED", "Authentication is required.", 401);
  return principal;
}
