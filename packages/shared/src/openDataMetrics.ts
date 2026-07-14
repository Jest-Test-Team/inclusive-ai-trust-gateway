// Row-level open-data measurement: parse CSV samples from data.gov.tw and
// turn them into quality / equity scores that feed openDataReadiness, ERH
// judgment adjustments, and ADM provenance evidence.

import type { AgentSafetySignal } from "./types";

export interface OpenDataRowMeasurement {
  datasetId: string;
  catalogId: string;
  scenarioId: string;
  title: string;
  rowsSampled: number;
  columnCount: number;
  schemaFields: string[];
  equityTokenHits: string[];
  /** 0–1 fraction of accessibility tokens found in headers. */
  equityCoverage: number;
  /** 0–1 average non-empty cell rate across sampled rows. */
  fillRate: number;
  schemaGap: boolean;
  /** 0–100 composite quality from rows + equity + fill. */
  qualityScore: number;
  downloadUrl?: string;
  measuredAt: string;
  error?: string;
}

export interface ScenarioOpenDataSummary {
  scenarioId: string;
  measurements: OpenDataRowMeasurement[];
  measuredOk: number;
  schemaGapCount: number;
  meanQuality: number;
  meanEquityCoverage: number;
  meanFillRate: number;
  totalRowsSampled: number;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Match equity tokens against field names (CJK substring / English word). */
export function matchEquityTokens(fields: string[], tokens: string[]): string[] {
  const normalized = fields.map((f) => f.toLowerCase());
  const hits: string[] = [];
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    const isCjk = /[\u3000-\u9fff]/.test(tok);
    const matched = isCjk
      ? normalized.some((f) => f.includes(t))
      : normalized.some((f) => {
          const parts = f.split(/[^a-z0-9]+/).filter(Boolean);
          return parts.includes(t) || parts.some((p) => t.length >= 4 && p.startsWith(t));
        });
    if (matched) hits.push(tok);
  }
  return hits;
}

/**
 * Minimal CSV parser: handles quoted fields, commas, CRLF. Returns header +
 * up to maxRows data rows. Does not support multiline quoted cells.
 */
export function parseCsv(text: string, maxRows = 500): { headers: string[]; rows: string[][] } {
  const raw = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      pushCell();
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && raw[i + 1] === "\n") i++;
      pushRow();
      if (rows.length > maxRows) break;
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) pushRow();

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  return { headers, rows: rows.slice(1, maxRows + 1) };
}

export function computeFillRate(headers: string[], rows: string[][]): number {
  if (rows.length === 0 || headers.length === 0) return 0;
  let filled = 0;
  let total = 0;
  for (const row of rows) {
    for (let c = 0; c < headers.length; c++) {
      total++;
      if ((row[c] ?? "").trim().length > 0) filled++;
    }
  }
  return total === 0 ? 0 : filled / total;
}

export function qualityScoreFromParts(
  rowsSampled: number,
  equityCoverage: number,
  fillRate: number,
): number {
  if (rowsSampled <= 0) return 0;
  const volume = Math.min(10, Math.log10(rowsSampled + 1) * 5);
  return clampScore(40 + equityCoverage * 35 + fillRate * 15 + volume);
}

export function measureParsedCsv(input: {
  datasetId: string;
  catalogId: string;
  scenarioId: string;
  title: string;
  headers: string[];
  rows: string[][];
  accessibilityTokens: string[];
  downloadUrl?: string;
  measuredAt?: string;
}): OpenDataRowMeasurement {
  const hits = matchEquityTokens(input.headers, input.accessibilityTokens);
  const equityCoverage =
    input.accessibilityTokens.length === 0 ? 0 : hits.length / input.accessibilityTokens.length;
  const fillRate = computeFillRate(input.headers, input.rows);
  const schemaGap = input.accessibilityTokens.length > 0 && hits.length === 0;
  return {
    datasetId: input.datasetId,
    catalogId: input.catalogId,
    scenarioId: input.scenarioId,
    title: input.title,
    rowsSampled: input.rows.length,
    columnCount: input.headers.length,
    schemaFields: input.headers,
    equityTokenHits: hits,
    equityCoverage,
    fillRate,
    schemaGap,
    qualityScore: qualityScoreFromParts(input.rows.length, equityCoverage, fillRate),
    downloadUrl: input.downloadUrl,
    measuredAt: input.measuredAt ?? new Date().toISOString(),
  };
}

export function summarizeScenarioMeasurements(
  scenarioId: string,
  measurements: OpenDataRowMeasurement[],
): ScenarioOpenDataSummary {
  const scoped = measurements.filter((m) => m.scenarioId === scenarioId || !m.scenarioId);
  const ok = scoped.filter((m) => !m.error && m.rowsSampled > 0);
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    scenarioId,
    measurements: scoped,
    measuredOk: ok.length,
    schemaGapCount: ok.filter((m) => m.schemaGap).length,
    meanQuality: mean(ok.map((m) => m.qualityScore)),
    meanEquityCoverage: mean(ok.map((m) => m.equityCoverage)),
    meanFillRate: mean(ok.map((m) => m.fillRate)),
    totalRowsSampled: ok.reduce((n, m) => n + m.rowsSampled, 0),
  };
}

/**
 * Blend catalog source-count floor with live CSV quality so readiness reflects
 * real row measurements when available, else falls back to sources × 22.
 */
export function scoreOpenDataReadiness(
  sourceCategoryCount: number,
  measurements?: OpenDataRowMeasurement[],
): number {
  const categoryFloor = clampScore(sourceCategoryCount * 22);
  if (!measurements || measurements.length === 0) return categoryFloor;

  const ok = measurements.filter((m) => !m.error && m.rowsSampled > 0);
  if (ok.length === 0) {
    // Attempted measure but all failed — slight penalty vs pure catalog claim.
    return clampScore(categoryFloor * 0.85);
  }

  const meanQuality = ok.reduce((s, m) => s + m.qualityScore, 0) / ok.length;
  const gapPenalty = Math.min(24, ok.filter((m) => m.schemaGap).length * 6);
  const volumeBonus = Math.min(8, Math.log10(ok.reduce((n, m) => n + m.rowsSampled, 0) + 1) * 3);
  const measuredComposite = clampScore(meanQuality + volumeBonus - gapPenalty);

  // 35% catalog claim + 65% measured CSV quality.
  return clampScore(categoryFloor * 0.35 + measuredComposite * 0.65);
}

/** Lower ERH judgment when equity coverage / fill are weak for the scenario. */
export function openDataJudgmentDelta(measurements?: OpenDataRowMeasurement[]): number {
  if (!measurements || measurements.length === 0) return 0;
  const ok = measurements.filter((m) => !m.error && m.rowsSampled > 0);
  if (ok.length === 0) return -0.05;
  const meanEquity = ok.reduce((s, m) => s + m.equityCoverage, 0) / ok.length;
  const meanFill = ok.reduce((s, m) => s + m.fillRate, 0) / ok.length;
  const gapRate = ok.filter((m) => m.schemaGap).length / ok.length;
  return -((1 - meanEquity) * 0.2 + (1 - meanFill) * 0.08 + gapRate * 0.12);
}

export function safetySignalsWithOpenDataProvenance(
  signals: AgentSafetySignal[],
  measurements?: OpenDataRowMeasurement[],
): AgentSafetySignal[] {
  const grounded = (measurements ?? []).some((m) => !m.error && m.rowsSampled > 0);
  if (!grounded) return signals;
  return signals.map((s) =>
    /provenance|open-data provenance/i.test(s.control) ? { ...s, status: "ready" as const } : s,
  );
}

export function provenanceEventDetail(measurements: OpenDataRowMeasurement[]) {
  const ok = measurements.filter((m) => !m.error && m.rowsSampled > 0);
  return {
    grounded: ok.length > 0,
    datasets: ok.map((m) => ({
      datasetId: m.datasetId,
      catalogId: m.catalogId,
      rowsSampled: m.rowsSampled,
      equityCoverage: Number(m.equityCoverage.toFixed(3)),
      fillRate: Number(m.fillRate.toFixed(3)),
      schemaGap: m.schemaGap,
      qualityScore: m.qualityScore,
    })),
    totalRowsSampled: ok.reduce((n, m) => n + m.rowsSampled, 0),
    measuredAt: new Date().toISOString(),
  };
}
