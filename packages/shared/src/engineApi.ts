// Clients for the two engines deployed as separate Back4App container apps:
// the ADM stack (agent-safety telemetry, Go) and the ERH engine (fairness /
// ethical-error evaluation, Python). Browser and mobile code reaches them
// through the web app's /api/adm and /api/erh proxies (or directly via
// EXPO_PUBLIC_* URLs on mobile).

import type { PublicServiceUseCase } from "./types";

export interface EngineProbeResult {
  engine: "adm" | "erh";
  label: string;
  ok: boolean;
  status?: number;
  detail: string;
}

/** Subset of erh_engine's EvaluateResponse consumed by the UIs. */
export interface ErhEvaluation {
  erh_satisfied: boolean;
  risk_score: number;
  estimated_exponent: number;
  violation_rate: number;
  num_samples: number;
  num_primes: number;
}

interface ErhSample {
  id: string;
  complexity: number;
  value: number;
  judgment: number;
  weight: number;
  context?: Record<string, unknown>;
}

/**
 * Mirrors the gateway's Go mapping (services/gateway/internal/erh):
 * one decision sample per persona; complexity grows with barriers,
 * judged service quality degrades with unmitigated barriers.
 */
export function useCaseToErhSamples(useCase: PublicServiceUseCase): ErhSample[] {
  if (useCase.personas.length === 0) {
    return [
      {
        id: "use-case",
        complexity: 1,
        value: 1,
        judgment: 0.8,
        weight: 1,
        context: { name: useCase.name, domain: useCase.domain },
      },
    ];
  }
  return useCase.personas.map((persona, i) => ({
    id: `persona-${i}`,
    complexity: 1 + persona.barriers.length,
    value: 1,
    judgment: Math.max(
      -1,
      Math.min(1, 1 - 0.3 * persona.barriers.length + 0.1 * useCase.safeguards.length),
    ),
    weight: 1,
    context: { persona: persona.label, region: persona.region, barriers: persona.barriers },
  }));
}

export async function evaluateWithErh(
  baseURL: string,
  useCase: PublicServiceUseCase,
  fetchImpl: typeof fetch = fetch,
): Promise<ErhEvaluation> {
  const res = await fetchImpl(`${trim(baseURL)}/v1/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ samples: useCaseToErhSamples(useCase), judge_name: useCase.name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`erh ${res.status}${text ? `: ${text.slice(0, 140)}` : ""}`);
  }
  return (await res.json()) as ErhEvaluation;
}

export async function probeEngines(
  config: { admBaseURL: string; erhBaseURL: string; fetchImpl?: typeof fetch },
  useCase: PublicServiceUseCase,
): Promise<EngineProbeResult[]> {
  const fetcher = config.fetchImpl ?? fetch;
  const results: EngineProbeResult[] = [];

  await record(results, "adm", "ADM stack health", async () => {
    if (!config.admBaseURL) throw new Error("ADM base URL not configured");
    const res = await fetcher(`${trim(config.admBaseURL)}/v1/health`);
    if (!res.ok) throw new Error(`health ${res.status}`);
    const ready = await fetcher(`${trim(config.admBaseURL)}/v1/ready`);
    return ready.ok ? "healthy and ready" : `healthy, ready check ${ready.status}`;
  });

  await record(results, "erh", "ERH engine health", async () => {
    if (!config.erhBaseURL) throw new Error("ERH base URL not configured");
    const res = await fetcher(`${trim(config.erhBaseURL)}/v1/health`);
    if (!res.ok) throw new Error(`health ${res.status}`);
    const body = (await res.json()) as { version?: string };
    return body.version ? `v${body.version}` : "healthy";
  });

  await record(results, "erh", "ERH live evaluation", async () => {
    if (!config.erhBaseURL) throw new Error("ERH base URL not configured");
    const evaluation = await evaluateWithErh(config.erhBaseURL, useCase, fetcher);
    return `risk ${Math.round(evaluation.risk_score)}/100, alpha ${evaluation.estimated_exponent.toFixed(2)}`;
  });

  return results;
}

async function record(
  results: EngineProbeResult[],
  engine: "adm" | "erh",
  label: string,
  run: () => Promise<string>,
) {
  try {
    results.push({ engine, label, ok: true, detail: await run() });
  } catch (error) {
    results.push({
      engine,
      label,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function trim(value: string) {
  return value.replace(/\/+$/, "");
}
