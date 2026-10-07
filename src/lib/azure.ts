export interface AzureBackendHealth {
  status?: string;
  [key: string]: unknown;
}

export interface AzureMatchedRecord {
  id?: string;
  invoiceNumber?: string | null;
  vendorName?: string | null;
  amount?: number | null;
  invoiceDate?: string | null;
}

export interface AzureExplainRequest {
  invoiceId: string;
  vendor?: string | null;
  amount?: number | null;
  currency?: string | null;
  status: string;
  failedRules: string[];
  duplicateEvidence: string[];
  matchedRecord?: AzureMatchedRecord | null;
}

export interface AzureExplainResponse {
  invoiceId?: string;
  explanation: string;
  decisionSource: string;
  explanationSource: string;
  deployment: string;
}

function azureApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AZURE_API_URL?.trim();
  if (!configured) {
    throw new Error("Azure backend is not configured. Set NEXT_PUBLIC_AZURE_API_URL.");
  }
  return configured.replace(/\/+$/, "");
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const value = body as Record<string, unknown>;
      const nestedError = value.error && typeof value.error === "object"
        ? value.error as Record<string, unknown>
        : undefined;
      const message = typeof value.message === "string"
        ? value.message
        : typeof nestedError?.message === "string" ? nestedError.message : undefined;
      if (message) return new Error(`${fallback} ${message}`);
    }
  } catch {
    // Keep the fallback when Azure returns a non-JSON gateway response.
  }
  return new Error(fallback);
}

function parseExplanation(body: unknown): AzureExplainResponse {
  if (!body || typeof body !== "object") {
    throw new Error("Azure AI returned an invalid response.");
  }
  const value = body as Record<string, unknown>;
  if (
    typeof value.explanation !== "string"
    || !value.explanation.trim()
    || typeof value.decisionSource !== "string"
    || typeof value.explanationSource !== "string"
    || typeof value.deployment !== "string"
    || (value.invoiceId !== undefined && typeof value.invoiceId !== "string")
  ) {
    throw new Error("Azure AI returned an incomplete explanation response.");
  }
  return {
    invoiceId: value.invoiceId as string | undefined,
    explanation: value.explanation.trim(),
    decisionSource: value.decisionSource,
    explanationSource: value.explanationSource,
    deployment: value.deployment,
  };
}

export async function checkAzureBackend(): Promise<AzureBackendHealth> {
  const url = `${azureApiBaseUrl()}/health`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new Error("Azure backend is unavailable. Check the connection and try again.");
  }
  if (!response.ok) {
    throw await responseError(response, "Azure backend is unavailable.");
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Azure backend returned an invalid health response.");
  return body as AzureBackendHealth;
}

export async function explainExceptionWithAzure(
  payload: AzureExplainRequest,
): Promise<AzureExplainResponse> {
  const url = `${azureApiBaseUrl()}/explain`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("Azure AI explanation service is unavailable. Check the connection and try again.");
  }
  if (!response.ok) {
    throw await responseError(response, "Azure AI explanation could not be generated.");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Azure AI returned an invalid response.");
  }
  return parseExplanation(body);
}
