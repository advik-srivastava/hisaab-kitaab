import { scryptSync, timingSafeEqual } from "node:crypto";

import { PlatformError } from "../platform/errors";
import type { AuthenticatedPrincipal, UserRole } from "../platform/types";

export interface CredentialsInput { email: string; password: string }

export interface AuthenticationProvider {
  authenticate(credentials: CredentialsInput): Promise<AuthenticatedPrincipal | undefined>;
}

interface DemoCredential {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: UserRole;
  passwordSalt: string;
  passwordHash: string;
}

export function hashDemoPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export class EnvironmentDemoAuthProvider implements AuthenticationProvider {
  private readonly credentials: DemoCredential[];

  constructor(serializedUsers: string | undefined) {
    try {
      const parsed = serializedUsers ? JSON.parse(serializedUsers) : [];
      this.credentials = Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new PlatformError("CONFIGURATION_REQUIRED", "DEMO_AUTH_USERS_JSON is invalid.", 503);
    }
  }

  async authenticate(input: CredentialsInput): Promise<AuthenticatedPrincipal | undefined> {
    const credential = this.credentials.find(({ email }) => email.toLowerCase() === input.email.trim().toLowerCase());
    if (!credential || !credential.passwordSalt || !credential.passwordHash) return undefined;
    const candidate = Buffer.from(hashDemoPassword(input.password, credential.passwordSalt), "hex");
    const expected = Buffer.from(credential.passwordHash, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return undefined;
    return {
      userId: credential.userId,
      email: credential.email,
      displayName: credential.displayName,
      organizationId: credential.organizationId,
      organizationName: credential.organizationName,
      role: credential.role,
    };
  }
}

export class EntraAuthenticationProvider implements AuthenticationProvider {
  async authenticate(): Promise<AuthenticatedPrincipal | undefined> {
    throw new PlatformError(
      "CONFIGURATION_REQUIRED",
      "Microsoft Entra ID requires tenant, client, redirect, and signing-key configuration.",
      503,
    );
  }
}
