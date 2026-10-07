import { financePolicySchema, type FinancePolicy } from "../../types/policies";

export function activatePolicySet(
  policies: readonly FinancePolicy[],
  policyId: string,
  activatedAt: string,
): FinancePolicy[] {
  const candidate = policies.find(({ id }) => id === policyId);
  if (!candidate) throw new Error("The selected policy could not be found.");
  financePolicySchema.parse(candidate);

  return policies.map((policy) => {
    if (policy.id === policyId) {
      return { ...policy, status: "ACTIVE", activatedAt };
    }
    return policy.status === "ACTIVE"
      ? { ...policy, status: "ARCHIVED" }
      : policy;
  });
}
