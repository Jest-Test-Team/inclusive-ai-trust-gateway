"use client";

// Open-data module. For each Taiwan dataset the gateway reasons about, shows
// what it is used for, the bias it introduces if fed to an AI raw, the field
// fixes we recommend, and what we publish back. Datasets with a datasetId are
// fetched LIVE from data.gov.tw (via the same-origin /api/opendata/:id proxy):
// the real schema, provider, and update cadence are shown, and the missing
// accessibility columns are computed from the actual field list.

import { useEffect, useState } from "react";
import { getOpenDataSources, type Locale, type OpenDataSource } from "@iatg/shared";
import type { LiveDataset } from "../lib/opendata";

const copy: Record<Locale, {
  eyebrow: string;
  title: string;
  intro: string;
  usedFor: string;
  bias: string;
  recommend: string;
  provision: string;
  powers: string;
  view: string;
  live: string;
  fetching: string;
  fetchFailed: string;
  liveSchema: string;
  provider: string;
  gapFound: string;
  gapNone: string;
  columns: (n: number) => string;
}> = {
  en: {
    eyebrow: "Open data",
    title: "Sources, bias findings & feedback to publishers",
    intro:
      "Datasets marked LIVE are fetched from data.gov.tw's open-data API in real time — the schema and accessibility gap below are read straight from the government's own columns, not hand-authored.",
    usedFor: "Used for",
    bias: "Bias if fed to AI raw",
    recommend: "Recommended fields to add",
    provision: "What we publish back",
    powers: "Powers this scenario",
    view: "data.gov.tw",
    live: "LIVE",
    fetching: "Fetching live schema…",
    fetchFailed: "Live fetch unavailable — showing curated analysis",
    liveSchema: "Live schema (data.gov.tw)",
    provider: "Provider",
    gapFound: "No accessibility/language column in the live schema — bias confirmed",
    gapNone: "Live schema already includes an accessibility/language column",
    columns: (n) => `${n} columns`,
  },
  "zh-TW": {
    eyebrow: "開放資料",
    title: "資料來源、偏差發現與對資料機關的回饋",
    intro:
      "標示 LIVE 的資料集為即時串接 data.gov.tw 開放資料 API — 下方的欄位結構與無障礙缺口，直接讀取自政府自身的欄位，並非人工撰寫。",
    usedFor: "用途",
    bias: "直接餵給 AI 的偏差",
    recommend: "建議新增欄位",
    provision: "我們回饋的內容",
    powers: "支援此情境",
    view: "data.gov.tw",
    live: "即時",
    fetching: "讀取即時欄位中…",
    fetchFailed: "即時串接暫時無法使用 — 顯示彙整分析",
    liveSchema: "即時欄位（data.gov.tw）",
    provider: "資料提供機關",
    gapFound: "即時欄位中沒有無障礙／語言欄位 — 偏差已驗證",
    gapNone: "即時欄位已含無障礙／語言欄位",
    columns: (n) => `${n} 個欄位`,
  },
};

type Copy = (typeof copy)["en"];

export function OpenDataPanel({ locale, scenarioId }: { locale: Locale; scenarioId: string }) {
  const t = copy[locale];
  const sources = getOpenDataSources();

  return (
    <section className="section" id="open-data">
      <div className="section-head">
        <p className="eyebrow">{t.eyebrow}</p>
        <h2>{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="opendata-grid">
        {sources.map((src) => (
          <SourceCard key={src.id} src={src} locale={locale} t={t} active={src.scenarioId === scenarioId} />
        ))}
      </div>
    </section>
  );
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: LiveDataset; gap: boolean }
  | { status: "error" };

function SourceCard({
  src,
  locale,
  t,
  active,
}: {
  src: OpenDataSource;
  locale: Locale;
  t: Copy;
  active: boolean;
}) {
  const [live, setLive] = useState<FetchState>({ status: src.datasetId ? "loading" : "idle" });

  useEffect(() => {
    if (!src.datasetId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/opendata/${src.datasetId}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as LiveDataset;
        // Accessibility gap: does any real column match an accessibility token?
        const haystack = data.schemaFields.join(" ").toLowerCase();
        const covered = src.accessibilityTokens.some((tok) => haystack.includes(tok.toLowerCase()));
        if (!cancelled) setLive({ status: "ok", data, gap: !covered });
      } catch {
        if (!cancelled) setLive({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src.datasetId, src.accessibilityTokens]);

  return (
    <article className={`opendata-card card ${active ? "opendata-active" : ""}`}>
      <div className="opendata-head">
        <div>
          <h3>
            {src.name[locale]}
            {src.datasetId && <span className="opendata-live">{t.live}</span>}
          </h3>
          <p className="opendata-agency">
            {src.agency[locale]} · {src.format}
          </p>
        </div>
        <a href={src.sourceUrl} target="_blank" rel="noreferrer" className="opendata-link">
          {t.view} ↗
        </a>
      </div>
      {active && <span className="opendata-flag">{t.powers}</span>}

      {src.datasetId && <LiveMeta state={live} t={t} />}

      <dl className="opendata-dl">
        <dt>{t.usedFor}</dt>
        <dd>{src.usedFor[locale]}</dd>
        <dt className="opendata-bias-dt">{t.bias}</dt>
        <dd className="opendata-bias">{src.biasNote[locale]}</dd>
        <dt>{t.recommend}</dt>
        <dd>
          <ul className="opendata-fields">
            {src.recommendedFields[locale].map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </dd>
        <dt className="opendata-give-dt">{t.provision}</dt>
        <dd>{src.provision[locale]}</dd>
      </dl>
    </article>
  );
}

function LiveMeta({ state, t }: { state: FetchState; t: Copy }) {
  if (state.status === "loading") return <p className="opendata-livemeta opendata-loading">{t.fetching}</p>;
  if (state.status === "error" || state.status === "idle")
    return <p className="opendata-livemeta opendata-loading">{t.fetchFailed}</p>;

  const { data, gap } = state;
  return (
    <div className="opendata-livemeta">
      <div className="opendata-livehead">
        <span>
          {t.provider}: <strong>{data.provider || "—"}</strong>
        </span>
        <span>{t.columns(data.schemaFields.length)}</span>
      </div>
      {data.schemaFields.length > 0 && (
        <>
          <p className="opendata-schema-label">{t.liveSchema}</p>
          <div className="opendata-schema">
            {data.schemaFields.slice(0, 16).map((f) => (
              <code key={f}>{f}</code>
            ))}
          </div>
        </>
      )}
      <p className={`opendata-gap ${gap ? "opendata-gap-bad" : "opendata-gap-ok"}`}>
        {gap ? `✗ ${t.gapFound}` : `✓ ${t.gapNone}`}
      </p>
    </div>
  );
}
