"use client";

// Quantifiable-benefits board. Reads the gateway's /v1/dashboard snapshot,
// which now returns all-time cumulative counts from Postgres (total assessments
// and safety events grouped by type), and renders them as stat tiles plus a
// by-type bar. Polls every few seconds so the numbers climb live during a demo.

import { useEffect, useState } from "react";
import type { DashboardSnapshot, Locale } from "@iatg/shared";
import { gateway, liveMode } from "../lib/api";

const copy: Record<Locale, {
  eyebrow: string;
  title: string;
  intro: string;
  services: string;
  injections: string;
  toolAbuse: string;
  highRisk: string;
  byType: string;
  source: string;
  offline: string;
  eventTypes: Record<string, string>;
}> = {
  en: {
    eyebrow: "Quantifiable benefits",
    title: "Cumulative impact — live from Postgres",
    intro: "Every assessment and every blocked attack is persisted and counted here — real database totals, not a demo constant.",
    services: "Public services evaluated",
    injections: "Prompt injections blocked",
    toolAbuse: "Tool-abuse / containment events",
    highRisk: "High fairness-risk services flagged",
    byType: "Safety events by type",
    source: "Live from Postgres · refreshes automatically",
    offline: "Offline demo mode — set NEXT_PUBLIC_API_BASE_URL to show live database totals.",
    eventTypes: {
      prompt_injection: "Prompt injection",
      tool_policy: "Tool policy",
      containment: "Containment",
      provenance: "Provenance",
    },
  },
  "zh-TW": {
    eyebrow: "量化效益",
    title: "累計成效 — Postgres 即時統計",
    intro: "每一次評估與每一次攔截都會寫入資料庫並在此累計 — 是真實的資料庫總數，不是示範用的固定值。",
    services: "已評估公共服務",
    injections: "已攔截提示注入",
    toolAbuse: "工具濫用／圍堵事件",
    highRisk: "高公平風險服務標記數",
    byType: "各類安全事件數",
    source: "Postgres 即時資料 · 自動更新",
    offline: "離線示範模式 — 設定 NEXT_PUBLIC_API_BASE_URL 以顯示即時資料庫總數。",
    eventTypes: {
      prompt_injection: "提示注入",
      tool_policy: "工具政策",
      containment: "圍堵",
      provenance: "來源驗證",
    },
  },
};

export function ImpactBoard({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    if (!liveMode) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await gateway.dashboard();
        if (!cancelled) setSnap(data);
      } catch {
        // gateway offline; leave prior snapshot
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!liveMode) {
    return (
      <section className="api-band card">
        <div className="api-header">
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h2>{t.title}</h2>
          </div>
        </div>
        <p className="api-empty">{t.offline}</p>
      </section>
    );
  }

  const byType = snap?.admEventsByType ?? {};
  const injections = byType.prompt_injection ?? 0;
  const toolAbuse = (byType.tool_policy ?? 0) + (byType.containment ?? 0);
  const maxCount = Math.max(1, ...Object.values(byType));
  const dash = (v: number | undefined) => (snap ? String(v ?? 0) : "–");

  return (
    <section className="api-band card">
      <div className="api-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
        </div>
      </div>
      <p className="api-empty">{t.intro}</p>

      <div className="impact-tiles">
        <ImpactTile label={t.services} value={dash(snap?.totalAssessments)} tone="good" />
        <ImpactTile label={t.injections} value={dash(injections)} tone="critical" />
        <ImpactTile label={t.toolAbuse} value={dash(toolAbuse)} tone="warning" />
        <ImpactTile label={t.highRisk} value={dash(snap?.highRiskCount)} tone="warning" />
      </div>

      {Object.keys(byType).length > 0 && (
        <div className="impact-bars">
          <h3 className="impact-bars-title">{t.byType}</h3>
          {Object.entries(byType)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div className="impact-bar-row" key={type}>
                <span className="impact-bar-name">{t.eventTypes[type] ?? type}</span>
                <span className="impact-bar-track">
                  <span className="impact-bar-fill" style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }} />
                </span>
                <span className="impact-bar-count">{count}</span>
              </div>
            ))}
        </div>
      )}

      <p className="impact-source">{t.source}</p>
    </section>
  );
}

function ImpactTile({ label, value, tone }: { label: string; value: string; tone: "good" | "warning" | "critical" }) {
  return (
    <div className={`stat-tile impact-tile-${tone}`}>
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}</div>
    </div>
  );
}
