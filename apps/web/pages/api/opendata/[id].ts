// Server-side proxy for Taiwan's open-data platform (data.gov.tw) M2M REST API.
// The platform locks CORS to its own origin, so browsers cannot call it from
// our domain — this same-origin route fetches the dataset metadata server-side
// and returns a trimmed, typed shape the OpenDataPanel consumes. No auth needed.

import type { NextApiRequest, NextApiResponse } from "next";
import type { LiveDataset, LiveDatasetResource } from "../../../lib/opendata";

const M2M = "https://data.gov.tw/api/v2/rest/dataset";

interface M2MResponse {
  success?: boolean;
  result?: {
    title?: string;
    dataProvider?: string;
    updateFrequency?: string;
    license?: string;
    modifiedDate?: string;
    distribution?: Array<{
      resourceFormat?: string;
      resourceDownloadUrl?: string;
      resourceCharacterEncoding?: string;
      resourceField?: Array<string | { fieldName?: string; name?: string }>;
    }>;
  };
}

function fieldNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f) => (typeof f === "string" ? f : f?.fieldName ?? f?.name ?? ""))
    .filter((f): f is string => Boolean(f));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "").replace(/[^0-9]/g, "");
  if (!id) {
    res.status(400).json({ error: "numeric dataset id required" });
    return;
  }

  try {
    const upstream = await fetch(`${M2M}/${id}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `data.gov.tw responded ${upstream.status}` });
      return;
    }
    const body = (await upstream.json()) as M2MResponse;
    const result = body.result;
    if (!result) {
      res.status(404).json({ error: "dataset not found" });
      return;
    }

    const resources: LiveDatasetResource[] = (result.distribution ?? [])
      .filter((d) => d.resourceDownloadUrl)
      .map((d) => ({
        format: d.resourceFormat ?? "",
        downloadUrl: d.resourceDownloadUrl ?? "",
        encoding: d.resourceCharacterEncoding,
        fields: fieldNames(d.resourceField),
      }));

    const schemaFields = Array.from(new Set(resources.flatMap((r) => r.fields)));

    const payload: LiveDataset = {
      id,
      title: result.title ?? "",
      provider: result.dataProvider ?? "",
      updateFrequency: result.updateFrequency ?? "",
      license: result.license ?? "",
      modifiedDate: result.modifiedDate ?? "",
      resources: resources.slice(0, 30),
      schemaFields,
    };

    // Cache at the edge briefly; dataset metadata changes rarely.
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: `data.gov.tw unreachable: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
