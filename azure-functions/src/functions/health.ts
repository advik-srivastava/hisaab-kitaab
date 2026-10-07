import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function health(
  _request: HttpRequest,
  _context: InvocationContext
): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      service: "hisaab-kitaab-backend",
      status: "healthy",
      platform: "Microsoft Azure Functions",
    },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: health,
});