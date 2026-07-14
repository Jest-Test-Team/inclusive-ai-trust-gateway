"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGatewayClient,
  getOpenDataSources,
  provenanceEventDetail,
  type OpenDataRowMeasurement,
  type PublicServiceUseCase,
} from "@iatg/shared";

/**
 * Fetches CSV row measurements for every LIVE dataset in the scenario, then
 * optionally posts one ADM provenance event so agent-safety telemetry reflects
 * grounded open-data evidence.
 */
export function useOpenDataMeasurements(
  scenarioId: string,
  options?: {
    ingestProvenance?: boolean;
    gatewayBaseURL?: string;
    gatewayApiKey?: string;
  },
) {
  const [measurements, setMeasurements] = useState<OpenDataRowMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const ingestedFor = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sources = getOpenDataSources(scenarioId).filter((s) => s.datasetId);

    (async () => {
      const results = await Promise.all(
        sources.map(async (src) => {
          try {
            const res = await fetch(`/api/opendata/metrics/${src.datasetId}`);
            if (!res.ok) throw new Error(String(res.status));
            return (await res.json()) as OpenDataRowMeasurement;
          } catch (error) {
            return {
              datasetId: src.datasetId!,
              catalogId: src.id,
              scenarioId,
              title: src.name.en,
              rowsSampled: 0,
              columnCount: 0,
              schemaFields: [],
              equityTokenHits: [],
              equityCoverage: 0,
              fillRate: 0,
              schemaGap: true,
              qualityScore: 0,
              measuredAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : String(error),
            } satisfies OpenDataRowMeasurement;
          }
        }),
      );
      if (!cancelled) {
        setMeasurements(results);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scenarioId]);

  useEffect(() => {
    if (!options?.ingestProvenance) return;
    if (loading || measurements.length === 0) return;
    const ok = measurements.filter((m) => !m.error && m.rowsSampled > 0);
    if (ok.length === 0) return;
    const key = `${scenarioId}:${ok.map((m) => m.datasetId).join(",")}`;
    if (ingestedFor.current === key) return;
    ingestedFor.current = key;

    const baseURL = options.gatewayBaseURL ?? "/api/gateway";
    const apiKey = options.gatewayApiKey ?? process.env.NEXT_PUBLIC_GATEWAY_API_KEY ?? "dev-key";
    const client = createGatewayClient({ baseURL, apiKey });
    void client
      .ingestSafetyEvent({
        eventType: "provenance",
        severity: "low",
        detail: provenanceEventDetail(ok),
        sessionId: `opendata-${scenarioId}`,
      })
      .catch(() => {
        /* gateway may be offline in local demos */
      });
  }, [loading, measurements, options?.ingestProvenance, options?.gatewayApiKey, options?.gatewayBaseURL, scenarioId]);

  return { measurements, loading };
}

/** Convenience: measure for the use-case's scenario id. */
export function useCaseOpenDataMeasurements(
  useCase: PublicServiceUseCase,
  options?: Parameters<typeof useOpenDataMeasurements>[1],
) {
  return useOpenDataMeasurements(useCase.id, options);
}
