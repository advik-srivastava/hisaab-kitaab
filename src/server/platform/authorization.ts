import { PlatformError } from "./errors";
import type { AuthenticatedPrincipal, UserRole } from "./types";

export type Permission =
  | "READ_FINANCE"
  | "REVIEW_EXCEPTION"
  | "ASSIGN_REVIEWER"
  | "MANAGE_POLICY"
  | "MANAGE_USERS"
  | "EXPORT_EXCEPTIONS"
  | "EXPORT_AUDIT";

const rolePermissions: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(["READ_FINANCE", "REVIEW_EXCEPTION", "ASSIGN_REVIEWER", "MANAGE_POLICY", "MANAGE_USERS", "EXPORT_EXCEPTIONS", "EXPORT_AUDIT"]),
  FINANCE_MANAGER: new Set(["READ_FINANCE", "REVIEW_EXCEPTION", "ASSIGN_REVIEWER", "EXPORT_EXCEPTIONS", "EXPORT_AUDIT"]),
  REVIEWER: new Set(["READ_FINANCE", "REVIEW_EXCEPTION", "EXPORT_EXCEPTIONS"]),
  AUDITOR: new Set(["READ_FINANCE", "EXPORT_AUDIT"]),
};

export function authorize(principal: AuthenticatedPrincipal | undefined, permission: Permission): AuthenticatedPrincipal {
  if (!principal) throw new PlatformError("UNAUTHENTICATED", "Authentication is required.", 401);
  if (!rolePermissions[principal.role].has(permission)) {
    throw new PlatformError("FORBIDDEN", "You are not authorized to perform this action.", 403);
  }
  return principal;
}

export function enforceOrganization(principal: AuthenticatedPrincipal, organizationId: string): void {
  if (principal.organizationId !== organizationId) {
    throw new PlatformError("FORBIDDEN", "Cross-organization access is denied.", 403);
  }
}

export function canReviewAssignedException(
  principal: AuthenticatedPrincipal,
  assignedReviewerId?: string,
): boolean {
  return principal.role === "ADMIN"
    || principal.role === "FINANCE_MANAGER"
    || (principal.role === "REVIEWER" && assignedReviewerId === principal.userId);
}
