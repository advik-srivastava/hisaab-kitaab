import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import OpenAI from "openai";

type ExplainRequest = {
  invoiceId?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  status?: string;
  failedRules?: string[];
  duplicateEvidence?: string[];
  matchedRecord?: unknown;
};

export async function explain(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

    if (!endpoint || !apiKey || !deployment) {
      return {
        status: 500,
        jsonBody: {
          error: "Azure OpenAI configuration is missing.",
        },
      };
    }

    const body = (await request.json()) as ExplainRequest;

    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/+$/, "")}/openai/v1/`,
    });

    const evidence = JSON.stringify(
      {
        invoiceId: body.invoiceId,
        vendor: body.vendor,
        amount: body.amount,
        currency: body.currency,
        status: body.status,
        failedRules: body.failedRules ?? [],
        duplicateEvidence: body.duplicateEvidence ?? [],
        matchedRecord: body.matchedRecord ?? null,
      },
      null,
      2
    );

    const response = await client.responses.create({
      model: deployment,

      reasoning: {
        effort: "low",
      },

      instructions: `
You are the explanation assistant for hisaab-kitaab.

The deterministic invoice-checking system has already analysed the invoice.

Your job is only to explain the supplied evidence clearly to a Finance reviewer.

Rules:
- Never invent information.
- Never call an invoice fraudulent.
- Never approve or reject an invoice.
- Never change the system status.
- Never claim that a duplicate candidate is definitely a duplicate unless the supplied evidence explicitly establishes that.
- Explain why human attention may be required.
- Mention matched invoice evidence when available.
- Use clear and professional language.
- Keep the final explanation to 2-4 sentences.
- Base the explanation only on the supplied evidence.
      `,

      input: evidence,

      max_output_tokens: 800,

      store: false,
    });

    const explanation =
      response.output_text?.trim() ||
      "The available evidence indicates that this invoice requires human review. Please examine the listed rule failures and any matched invoice evidence before taking action.";

    return {
      status: 200,

      jsonBody: {
        invoiceId: body.invoiceId,

        explanation,

        decisionSource: "hisaab-kitaab deterministic engine",

        explanationSource: "Microsoft Azure OpenAI",

        deployment,
      },
    };
  } catch (error) {
    context.error("Azure OpenAI explanation failed:", error);

    return {
      status: 500,

      jsonBody: {
        error: "Unable to generate Azure AI explanation.",
      },
    };
  }
}

app.http("explain", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: explain,
});