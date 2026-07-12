import type { PublicServiceUseCase } from "./types";

export type GatewaySurface =
  | "health"
  | "rest"
  | "graphql"
  | "ucp"
  | "connectrpc"
  | "mcp"
  | "mqtt"
  | "websocket"
  | "swagger";

export interface GatewayClientConfig {
  baseURL: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface AssessmentResponse {
  id: string;
  name: string;
  domain: string;
  inclusionScore: number;
  fairnessRisk: number;
  fairnessRiskLabel: string;
  openDataReadiness: number;
  agentSafetyReadiness: number;
  evaluator: string;
  createdAt: string;
}

export interface SafetyEvent {
  id: string;
  eventType: string;
  severity: string;
  detail?: unknown;
  sessionId?: string;
  receivedAt: string;
}

export interface LiveSafetyEvent {
  id: string;
  eventType: string;
  severity: string;
  sessionId?: string;
  receivedAt: string;
}

export interface CommerceSession {
  id: string;
  agentId: string;
  personaId: string;
  status: string;
  startedAt: string;
}

export interface Product {
  sku: string;
  name: string;
  category: string;
  priceTWD: number;
  fairPriceTWD: number;
  accessibleDescription: boolean;
}

export interface TraceEvent {
  id: string;
  sessionId: string;
  ucpAction: string;
  trustVerdict: "allowed" | "flagged" | "blocked";
  reason?: string;
  payload?: unknown;
  createdAt: string;
}

export interface GatewayProbeResult {
  surface: GatewaySurface;
  label: string;
  ok: boolean;
  status?: number;
  detail: string;
}

export function createGatewayClient(config: GatewayClientConfig) {
  const baseURL = trimTrailingSlash(config.baseURL);
  const apiKey = config.apiKey;
  const fetcher = config.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
    if (!baseURL) throw new Error("Gateway API base URL is not configured");
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
    if (auth) headers.set("X-Api-Key", apiKey);
    const res = await fetcher(`${baseURL}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`gateway ${res.status}${text ? `: ${text}` : ""}`);
    }
    return (await res.json()) as T;
  }

  return {
    baseURL,
    apiKey,
    docsURL: baseURL ? `${baseURL}/docs` : "",
    openAPIURL: baseURL ? `${baseURL}/openapi.json` : "",
    websocketURL: baseURL ? `${baseURL.replace(/^http/, "ws")}/ws?api_key=${encodeURIComponent(apiKey)}` : "",

    health() {
      return request<{ status: string }>("/healthz", { method: "GET" }, false);
    },

    createAssessment(useCase: PublicServiceUseCase) {
      return request<AssessmentResponse>("/v1/assessments", {
        method: "POST",
        body: JSON.stringify({ useCase: toRestUseCase(useCase) }),
      });
    },

    listAssessments() {
      return request<{ items: AssessmentResponse[] }>("/v1/assessments");
    },

    getAssessment(id: string) {
      return request<AssessmentResponse>(`/v1/assessments/${encodeURIComponent(id)}`);
    },

    dashboard() {
      return request<Record<string, unknown>>("/v1/dashboard");
    },

    ingestSafetyEvent(event: { eventType: string; severity: string; detail: unknown; sessionId?: string }) {
      return request<SafetyEvent>("/v1/adm/events", {
        method: "POST",
        body: JSON.stringify(event),
      });
    },

    listSafetyEvents() {
      return request<{ items: SafetyEvent[] }>("/v1/adm/events");
    },

    graphql<T = unknown>(query: string, variables?: Record<string, unknown>) {
      return request<{ data?: T; errors?: unknown[] }>("/graphql", {
        method: "POST",
        body: JSON.stringify({ query, variables }),
      });
    },

    openCommerceSession(agentId: string, personaId: string) {
      return request<CommerceSession>("/ucp/v1/sessions", {
        method: "POST",
        body: JSON.stringify({ agentId, personaId }),
      });
    },

    discoverProducts(sessionId: string, query: string) {
      return request<{ products: Product[]; trust: TraceEvent }>("/ucp/v1/discovery", {
        method: "POST",
        body: JSON.stringify({ sessionId, query }),
      });
    },

    createCheckoutIntent(sessionId: string, sku: string, quantity = 1) {
      return request<{ trust: TraceEvent }>("/ucp/v1/checkout-intents", {
        method: "POST",
        body: JSON.stringify({ sessionId, sku, quantity }),
      });
    },

    traceCommerce() {
      return request<{ items: TraceEvent[] }>("/ucp/v1/trace");
    },

    connectListAssessments(limit = 5) {
      return request<{ items: AssessmentResponse[] }>("/iatg.v1.TrustService/ListAssessments", {
        method: "POST",
        body: JSON.stringify({ limit }),
      });
    },

    connectListSafetyEvents(limit = 5) {
      return request<{ items: SafetyEvent[] }>("/iatg.v1.TrustService/ListSafetyEvents", {
        method: "POST",
        body: JSON.stringify({ limit }),
      });
    },

    connectEvaluateService(useCase: PublicServiceUseCase) {
      return request<AssessmentResponse>("/iatg.v1.TrustService/EvaluateService", {
        method: "POST",
        body: JSON.stringify(toConnectUseCase(useCase)),
      });
    },
  };
}

export async function probeGateway(config: GatewayClientConfig, useCase: PublicServiceUseCase): Promise<GatewayProbeResult[]> {
  const client = createGatewayClient(config);
  const results: GatewayProbeResult[] = [];
  let assessmentID = "";
  let sessionID = "";

  await record(results, "health", "Health", async () => {
    const health = await client.health();
    return health.status;
  });

  await record(results, "swagger", "Swagger / OpenAPI", async () => {
    const res = await (config.fetchImpl ?? fetch)(client.openAPIURL);
    if (!res.ok) throw new Error(`openapi ${res.status}`);
    const spec = (await res.json()) as { openapi?: string };
    return spec.openapi ? `OpenAPI ${spec.openapi}` : "OpenAPI loaded";
  });

  await record(results, "rest", "REST assessments", async () => {
    const created = await client.createAssessment(useCase);
    assessmentID = created.id;
    const listed = await client.listAssessments();
    return `${created.name}: ${created.inclusionScore}/100 (${listed.items.length} stored)`;
  });

  await record(results, "graphql", "GraphQL read model", async () => {
    const response = await client.graphql<{ assessments: AssessmentResponse[] }>(
      "query Probe($limit: Int) { assessments(limit: $limit) { id name inclusionScore } }",
      { limit: 3 },
    );
    if (response.errors?.length) throw new Error("GraphQL returned errors");
    return `${response.data?.assessments?.length ?? 0} assessments`;
  });

  await record(results, "ucp", "UCP commerce", async () => {
    const session = await client.openCommerceSession("demo-agent", useCase.personas[0]?.id ?? "persona");
    sessionID = session.id;
    const discovery = await client.discoverProducts(session.id, "care");
    const sku = discovery.products[0]?.sku ?? "CARE-001";
    const checkout = await client.createCheckoutIntent(session.id, sku, 1);
    return `${discovery.products.length} products, checkout ${checkout.trust.trustVerdict}`;
  });

  await record(results, "connectrpc", "Connect-RPC", async () => {
    const listed = await client.connectListAssessments(3);
    await client.connectListSafetyEvents(3);
    return `${listed.items?.length ?? 0} assessments via Connect`;
  });

  await record(results, "mcp", "MCP tools", async () => {
    const res = await (config.fetchImpl ?? fetch)(`${client.baseURL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "probe", method: "tools/list", params: {} }),
    });
    if (!res.ok) throw new Error(`MCP endpoint returned ${res.status}`);
    return `HTTP endpoint reachable (${res.status})`;
  });

  results.push({
    surface: "mqtt",
    label: "MQTT adapter",
    ok: true,
    detail: "Server-side subscriber; browser/mobile clients consume fan-out through WebSocket and REST",
  });

  await record(results, "websocket", "WebSocket", async () => {
    if (!client.websocketURL) throw new Error("WebSocket URL is not configured");
    return sessionID || assessmentID ? "URL ready for live events" : "URL ready";
  });

  return results;
}

async function record(
  results: GatewayProbeResult[],
  surface: GatewaySurface,
  label: string,
  run: () => Promise<string>,
) {
  try {
    results.push({ surface, label, ok: true, detail: await run() });
  } catch (error) {
    results.push({
      surface,
      label,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function toRestUseCase(useCase: PublicServiceUseCase) {
  return {
    name: useCase.name,
    domain: useCase.domain,
    description: useCase.summary,
    targetUsers: useCase.targetUsers,
    sdgs: useCase.sdgs,
    openDataSources: useCase.openDataSources,
    aiCapabilities: useCase.aiCapabilities,
    safeguards: useCase.safeguards,
    personas: useCase.personas.map(({ label, ageGroup, region, needs, barriers }) => ({
      label,
      ageGroup,
      region,
      needs,
      barriers,
    })),
  };
}

function toConnectUseCase(useCase: PublicServiceUseCase) {
  return {
    name: useCase.name,
    domain: useCase.domain,
    description: useCase.summary,
    targetUsers: useCase.targetUsers,
    sdgs: useCase.sdgs,
    openDataSources: useCase.openDataSources,
    aiCapabilities: useCase.aiCapabilities,
    safeguards: useCase.safeguards,
    personas: useCase.personas.map(({ label, ageGroup, region, needs, barriers }) => ({
      label,
      ageGroup,
      region,
      needs,
      barriers,
    })),
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
