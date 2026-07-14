// Downloads a CSV resource from data.gov.tw (via M2M metadata → resource URL),
// samples rows, and returns equity/quality metrics for ERH/ADM scoring.
// Browser cannot fetch the CSV directly (CORS); this same-origin route does.

import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOpenDataSources,
  measureParsedCsv,
  parseCsv,
  type OpenDataRowMeasurement,
} from "@iatg/shared";

const M2M = "https://data.gov.tw/api/v2/rest/dataset";
const MAX_BYTES = 1_500_000;
const MAX_ROWS = 400;
const FETCH_MS = 18_000;

interface M2MResponse {
  success?: boolean;
  result?: {
    title?: string;
    distribution?: Array<{
      resourceFormat?: string;
      resourceDownloadUrl?: string;
      resourceField?: Array<string | { fieldName?: string; name?: string }>;
    }>;
  };
}

function withTimeout(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function pickCsvUrl(
  distributions: NonNullable<M2MResponse["result"]>["distribution"],
): string | undefined {
  if (!distributions?.length) return undefined;
  const csv = distributions.find((d) =>
    /csv/i.test(d.resourceFormat ?? "") && Boolean(d.resourceDownloadUrl),
  );
  if (csv?.resourceDownloadUrl) return csv.resourceDownloadUrl;
  return distributions.find((d) => d.resourceDownloadUrl)?.resourceDownloadUrl;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "").replace(/[^0-9]/g, "");
  if (!id) {
    res.status(400).json({ error: "numeric dataset id required" });
    return;
  }

  const catalog = getOpenDataSources().find((s) => s.datasetId === id);
  const catalogId = catalog?.id ?? `dataset-${id}`;
  const scenarioId = catalog?.scenarioId ?? String(req.query.scenarioId ?? "");
  const tokens = catalog?.accessibilityTokens ?? [];
  const title = catalog?.name["zh-TW"] ?? catalog?.name.en ?? id;

  const failed = (error: string, extra: Partial<OpenDataRowMeasurement> = {}) => {
    const payload: OpenDataRowMeasurement = {
      datasetId: id,
      catalogId,
      scenarioId,
      title,
      rowsSampled: 0,
      columnCount: 0,
      schemaFields: [],
      equityTokenHits: [],
      equityCoverage: 0,
      fillRate: 0,
      schemaGap: tokens.length > 0,
      qualityScore: 0,
      measuredAt: new Date().toISOString(),
      error,
      ...extra,
    };
    res.status(200).json(payload);
  };

  try {
    const metaRes = await fetch(`${M2M}/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: withTimeout(FETCH_MS),
    });
    if (!metaRes.ok) {
      failed(`data.gov.tw metadata ${metaRes.status}`);
      return;
    }
    const body = (await metaRes.json()) as M2MResponse;
    const downloadUrl = pickCsvUrl(body.result?.distribution);
    if (!downloadUrl) {
      failed("no downloadable CSV resource on dataset");
      return;
    }

    const csvRes = await fetch(downloadUrl, {
      headers: { Accept: "text/csv,text/plain,*/*" },
      cache: "no-store",
      signal: withTimeout(FETCH_MS),
      redirect: "follow",
    });
    if (!csvRes.ok) {
      failed(`CSV download ${csvRes.status}`, { downloadUrl });
      return;
    }

    const buf = await csvRes.arrayBuffer();
    const slice = buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf;
    // Prefer UTF-8; Taiwan CSVs are usually UTF-8 or UTF-8 BOM after open-data portal.
    let text = new TextDecoder("utf-8").decode(slice);
    if (text.includes("\uFFFD") && typeof (globalThis as { TextDecoder?: unknown }).TextDecoder === "function") {
      try {
        text = new TextDecoder("big5").decode(slice);
      } catch {
        /* keep utf-8 best-effort */
      }
    }

    const { headers, rows } = parseCsv(text, MAX_ROWS);
    if (headers.length === 0) {
      failed("CSV parsed with empty header", { downloadUrl });
      return;
    }

    const measurement = measureParsedCsv({
      datasetId: id,
      catalogId,
      scenarioId,
      title: body.result?.title ?? title,
      headers,
      rows,
      accessibilityTokens: tokens,
      downloadUrl,
    });

    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(measurement);
  } catch (error) {
    failed(`measure failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
