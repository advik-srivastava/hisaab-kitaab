import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkAzureBackend,
  explainExceptionWithAzure,
  type AzureExplainRequest,
} from "../../src/lib/azure";

const payload: AzureExplainRequest = {
  invoiceId: "TXN-9",
  vendor: "Contoso",
  amount: 18500,
  currency: "INR",
  status: "HIGH_RISK",
  failedRules: ["Hotel limit: Hotel amount exceeds the configured limit."],
  duplicateEvidence: ["Same normalized vendor", "Same invoice number"],
  matchedRecord: {
    id: "TXN-4",
    invoiceNumber: "INV-100",
    vendorName: "Contoso",
    amount: 18500,
    invoiceDate: "2026-10-01",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Azure Functions frontend client", () => {
  it("checks the configured Azure backend without duplicating /api", async () => {
    vi.stubEnv("NEXT_PUBLIC_AZURE_API_URL", "https://functions.example/api/");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "healthy" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkAzureBackend()).resolves.toEqual({ status: "healthy" });
    expect(fetchMock).toHaveBeenCalledWith("https://functions.example/api/health", {
      headers: { accept: "application/json" },
    });
  });

  it("posts only the supplied deterministic evidence to Azure Functions", async () => {
    vi.stubEnv("NEXT_PUBLIC_AZURE_API_URL", "https://functions.example/api");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      invoiceId: "TXN-9",
      explanation: "The invoice needs review because the deterministic controls found an exact duplicate.",
      decisionSource: "hisaab-kitaab deterministic engine",
      explanationSource: "Azure OpenAI",
      deployment: "hisaab-explainer",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await explainExceptionWithAzure(payload);
    expect(result.explanation).toContain("deterministic controls");
    expect(fetchMock).toHaveBeenCalledWith("https://functions.example/api/explain", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  });

  it("returns a readable error for a failed Azure response", async () => {
    vi.stubEnv("NEXT_PUBLIC_AZURE_API_URL", "https://functions.example/api");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Deployment unavailable." }), {
      status: 503,
      headers: { "content-type": "application/json" },
    })));

    await expect(explainExceptionWithAzure(payload)).rejects.toThrow(
      "Azure AI explanation could not be generated. Deployment unavailable.",
    );
  });

  it("rejects empty or malformed explanations", async () => {
    vi.stubEnv("NEXT_PUBLIC_AZURE_API_URL", "https://functions.example/api");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      explanation: " ",
      decisionSource: "deterministic",
      explanationSource: "Azure OpenAI",
      deployment: "hisaab-explainer",
    }), { status: 200 })));

    await expect(explainExceptionWithAzure(payload)).rejects.toThrow("incomplete explanation response");
  });

  it("fails clearly when the public Azure Function base URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_AZURE_API_URL", "");
    await expect(explainExceptionWithAzure(payload)).rejects.toThrow("NEXT_PUBLIC_AZURE_API_URL");
  });
});
