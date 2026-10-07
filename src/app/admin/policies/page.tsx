"use client";

import { useCallback, useEffect, useState } from "react";
import { LocalPolicyAdmin } from "@/components/LocalPolicyAdmin";
import { formatINR } from "@/lib/formatting";
import type { PolicyDefinition, PolicySetRecord, PolicyState } from "@/server/platform/types";

const allRequiredFields: PolicyDefinition["requiredFields"] = ["vendorName", "invoiceNumber", "invoiceDate", "amount", "currency"];
const defaultDefinition: PolicyDefinition = {
  supportedCurrencies: ["INR"],
  expenseLimits: { Meals: 2000, Taxi: 3000, Hotel: 10000 },
  purchaseOrderRequiredAbove: 25000,
  requiredFields: allRequiredFields,
};

export default function PoliciesPage() {
  const serverMode = process.env.NEXT_PUBLIC_APP_MODE === "SERVER";
  const [items, setItems] = useState<PolicySetRecord[]>();
  const [name, setName] = useState("Finance Policy");
  const [state, setState] = useState<PolicyState>("DRAFT");
  const [definition, setDefinition] = useState<PolicyDefinition>(defaultDefinition);
  const [message, setMessage] = useState<string>();
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => fetch("/api/policies", { cache: "no-store" })
    .then((response) => response.json())
    .then((body: { items: PolicySetRecord[] }) => setItems(body.items)), []);
  useEffect(() => { if (serverMode) void load(); }, [load, serverMode]);
  if (!serverMode) return <LocalPolicyAdmin />;

  const saveVersion = async () => {
    setSaving(true);
    const response = await fetch("/api/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, state, definition }),
    });
    const body = await response.json() as { error?: { message?: string } };
    setMessage(response.ok ? `${state === "ACTIVE" ? "Active" : "Draft"} policy version saved.` : body.error?.message ?? "Policy could not be saved.");
    if (response.ok) await load();
    setSaving(false);
  };
  const updateLimit = (field: keyof PolicyDefinition["expenseLimits"], value: string) => {
    setDefinition((current) => ({ ...current, expenseLimits: { ...current.expenseLimits, [field]: Number(value) } }));
  };

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-extrabold">Policies</h1><p className="mt-2 text-text-secondary">Create immutable Finance policy versions. Historical batches retain the version used during analysis.</p></div>
      <section className="card p-6 space-y-5" aria-labelledby="policy-editor-title">
        <div className="flex items-center justify-between"><h2 id="policy-editor-title" className="text-xl font-bold">New policy version</h2><span className="text-xs text-text-muted">Admin only</span></div>
        <div className="grid md:grid-cols-3 gap-4">
          <label className="text-sm text-text-secondary">Name<input className="mt-2 w-full rounded-lg bg-surface-primary border border-border-default px-3 py-2 text-text-primary" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="text-sm text-text-secondary">State<select className="mt-2 w-full rounded-lg bg-surface-elevated border border-border-default px-3 py-2 text-text-primary" value={state} onChange={(event) => setState(event.target.value as PolicyState)}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="RETIRED">Retired</option></select></label>
          <label className="text-sm text-text-secondary">Supported currencies<input className="mt-2 w-full rounded-lg bg-surface-primary border border-border-default px-3 py-2 text-text-primary" value={definition.supportedCurrencies.join(", ")} onChange={(event) => setDefinition((current) => ({ ...current, supportedCurrencies: event.target.value.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean) }))} /></label>
          {(["Meals", "Taxi", "Hotel"] as const).map((field) => <label key={field} className="text-sm text-text-secondary">{field} limit<input type="number" min="0" className="mt-2 w-full rounded-lg bg-surface-primary border border-border-default px-3 py-2 text-text-primary" value={definition.expenseLimits[field]} onChange={(event) => updateLimit(field, event.target.value)} /></label>)}
          <label className="text-sm text-text-secondary">PO required above<input type="number" min="0" className="mt-2 w-full rounded-lg bg-surface-primary border border-border-default px-3 py-2 text-text-primary" value={definition.purchaseOrderRequiredAbove} onChange={(event) => setDefinition((current) => ({ ...current, purchaseOrderRequiredAbove: Number(event.target.value) }))} /></label>
        </div>
        <fieldset><legend className="text-sm text-text-secondary mb-2">Required fields</legend><div className="flex flex-wrap gap-4">{allRequiredFields.map((field) => <label key={field} className="flex gap-2 items-center text-sm"><input type="checkbox" checked={definition.requiredFields.includes(field)} onChange={(event) => setDefinition((current) => ({ ...current, requiredFields: event.target.checked ? [...current.requiredFields, field] : current.requiredFields.filter((value) => value !== field) }))} />{field}</label>)}</div></fieldset>
        <button className="btn-primary" disabled={saving} onClick={() => void saveVersion()}>{saving ? "Saving..." : "Save version"}</button>
        {message && <p aria-live="polite" className="text-sm text-text-secondary">{message}</p>}
      </section>
      <section className="card divide-y divide-panel-border" aria-label="Policy history">{items?.map((policy) => <div key={policy.id} className="p-6 flex items-center justify-between gap-4"><div><p className="font-bold">{policy.name}</p><p className="text-sm text-text-secondary">Policy v{policy.version}{policy.effectiveAt ? ` · Effective ${new Date(policy.effectiveAt).toLocaleDateString()}` : ""}</p><p className="text-xs text-text-muted mt-1">INR limits: Meals {formatINR(policy.definition.expenseLimits.Meals)} · Taxi {formatINR(policy.definition.expenseLimits.Taxi)} · Hotel {formatINR(policy.definition.expenseLimits.Hotel)} · PO {formatINR(policy.definition.purchaseOrderRequiredAbove)}</p></div><span className="text-xs font-bold px-3 py-1 rounded-full border border-border-default">{policy.state}</span></div>)}{items?.length === 0 && <p className="p-8 text-text-secondary">No policies configured.</p>}</section>
    </div>
  );
}
