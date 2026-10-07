import { financePolicySchema, type FinancePolicy } from "../../types/policies";
import { getBrowserPersistence } from "./indexedDb";

export async function getActiveFinancePolicy(): Promise<FinancePolicy | undefined> {
  const persistence = getBrowserPersistence();
  if (!persistence) return undefined;
  return persistence.getActivePolicy();
}

export async function listFinancePolicies(): Promise<FinancePolicy[]> {
  return (await getBrowserPersistence()?.listPolicies()) ?? [];
}

export async function saveFinancePolicyDraft(policy: FinancePolicy): Promise<void> {
  const validated = financePolicySchema.parse({ ...policy, status: "DRAFT", activatedAt: undefined });
  const persistence = getBrowserPersistence();
  if (!persistence) throw new Error("Browser policy storage is unavailable.");
  await persistence.savePolicy(validated);
}

export async function activateFinancePolicy(
  policyId: string,
  activatedAt = new Date().toISOString(),
): Promise<FinancePolicy> {
  const persistence = getBrowserPersistence();
  if (!persistence) throw new Error("Browser policy storage is unavailable.");
  return persistence.activatePolicy(policyId, activatedAt);
}
