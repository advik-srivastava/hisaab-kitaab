export const ACTIVE_POLICY_REQUIRED = "ACTIVE_POLICY_REQUIRED" as const;

export class ActivePolicyRequiredError extends Error {
  readonly code = ACTIVE_POLICY_REQUIRED;

  constructor() {
    super("Activate a company finance policy before analyzing invoices.");
    this.name = "ActivePolicyRequiredError";
  }
}

export function isActivePolicyRequiredError(
  error: unknown,
): error is ActivePolicyRequiredError {
  return error instanceof ActivePolicyRequiredError
    || (typeof error === "object" && error !== null && "code" in error
      && error.code === ACTIVE_POLICY_REQUIRED);
}
