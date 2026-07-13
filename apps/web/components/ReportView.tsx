"use client";

// Printable one-page compliance report for a single scenario. Composes the
// scenario, its ERH fairness verdict (real engine call when live, deterministic
// fallback otherwise), the ADM control inventory, and PASS/FAIL badges, then
// offers browser print-to-PDF. Designed to fit one A4 page via @media print.

import { useEffect, useMemo, useState } from "react";
import {
  assessUseCase,
  evaluateWithErh,
  formatScore,
  getSafetySignals,
  getUseCases,
  localizeAssessment,
  safetySignals,
  useCases,
  type ErhEvaluation,
  type Locale,
} from "@iatg/shared";
import { liveMode } from "../lib/api";

const copy: Record<Locale, Record<string, string>> = {
  en: {
    doc: "AI Trust Compliance Report",
    generated: "Generated",
    scenario: "Public-service scenario",
    domain: "Domain",
    verdict: "Dual-check verdict",
    erhPass: "ERH fairness: PASS",
    erhFail: "ERH fairness: REVIEW",
    admPass: "ADM safety controls: PASS",
    admReview: "ADM safety controls: PARTIAL",
    inclusion: "Inclusion score",
    fairness: "Fairness risk",
    openData: "Open-data readiness",
    agentSafety: "Agent-safety readiness",
    erhSection: "ERH fairness evaluation",
    riskScore: "Risk score",
    alpha: "Error-growth exponent α",
    samples: "Critical samples",
    admSection: "ADM safety control inventory",
    personas: "Inclusion personas checked",
    barriers: "Barriers",
    safeguards: "Safeguards in place",
    print: "Export report (PDF)",
    back: "← Back",
    disclosure:
      "ERH figures are returned by the Ethic-Latex engine when the gateway is live; otherwise a deterministic fallback is shown. This report is auto-generated evidence for audit, not a legal certification.",
    ready: "ready",
    partial: "partial",
    missing: "missing",
  },
  "zh-TW": {
    doc: "AI 信任合規報告",
    generated: "產生時間",
    scenario: "公共服務情境",
    domain: "領域",
    verdict: "雙重檢驗結果",
    erhPass: "ERH 公平性：通過",
    erhFail: "ERH 公平性：需複核",
    admPass: "ADM 安全控制：通過",
    admReview: "ADM 安全控制：部分",
    inclusion: "包容性分數",
    fairness: "公平風險",
    openData: "開放資料準備度",
    agentSafety: "代理安全準備度",
    erhSection: "ERH 公平性評估",
    riskScore: "風險分數",
    alpha: "誤差成長指數 α",
    samples: "關鍵樣本",
    admSection: "ADM 安全控制清單",
    personas: "已檢查之包容性人物誌",
    barriers: "障礙",
    safeguards: "已建置之防護措施",
    print: "匯出報告（PDF）",
    back: "← 返回",
    disclosure:
      "當閘道上線時，ERH 數值由 Ethic-Latex 引擎回傳；否則顯示確定性備援值。本報告為稽核用之自動產生證據，非法律認證。",
    ready: "就緒",
    partial: "部分",
    missing: "缺漏",
  },
};

export function ReportView({ scenarioId, locale }: { scenarioId: string; locale: Locale }) {
  const t = copy[locale];
  const localUseCases = getUseCases(locale);
  const useCase = localUseCases.find((u) => u.id === scenarioId) ?? localUseCases[0];
  const assessment = useMemo(
    () => localizeAssessment(assessUseCase(useCase, safetySignals), locale),
    [useCase, locale],
  );
  const signals = getSafetySignals(locale);
  const [erh, setErh] = useState<ErhEvaluation | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!liveMode) return;
    let cancelled = false;
    evaluateWithErh("/api/erh", useCase)
      .then((r) => !cancelled && setErh(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [useCase]);

  const erhSatisfied = erh ? erh.erh_satisfied : assessment.fairnessRisk !== "High";
  const admReady = signals.every((s) => s.status !== "missing");

  return (
    <div className="report">
      <div className="report-toolbar no-print">
        <a href="/" className="report-back">
          {t.back}
        </a>
        <button onClick={() => window.print()}>{t.print}</button>
      </div>

      <article className="report-page">
        <header className="report-head">
          <div>
            <p className="eyebrow">{t.doc}</p>
            <h1>{useCase.name}</h1>
            <p className="report-meta">
              {t.domain}: {useCase.domain} · {useCase.sdgs.join(", ")}
            </p>
          </div>
          <div className="report-stamp">
            <span>{t.generated}</span>
            <strong>{now.toISOString().replace("T", " ").slice(0, 19)} UTC</strong>
          </div>
        </header>

        <section className="report-badges">
          <span className={`report-badge ${erhSatisfied ? "report-pass" : "report-review"}`}>
            {erhSatisfied ? t.erhPass : t.erhFail}
          </span>
          <span className={`report-badge ${admReady ? "report-pass" : "report-review"}`}>
            {admReady ? t.admPass : t.admReview}
          </span>
        </section>

        <p className="report-summary">{useCase.summary}</p>

        <section className="report-metrics">
          <ReportMetric label={t.inclusion} value={`${formatScore(assessment.inclusionScore)}/100`} />
          <ReportMetric label={t.fairness} value={assessment.fairnessRisk} />
          <ReportMetric label={t.openData} value={`${formatScore(assessment.openDataReadiness)}/100`} />
          <ReportMetric label={t.agentSafety} value={`${formatScore(assessment.agentSafetyReadiness)}/100`} />
        </section>

        <div className="report-cols">
          <section>
            <h2>{t.erhSection}</h2>
            {erh ? (
              <dl className="report-dl">
                <dt>{t.riskScore}</dt>
                <dd>{Math.round(erh.risk_score)}/100</dd>
                <dt>{t.alpha}</dt>
                <dd>{erh.estimated_exponent.toFixed(3)}</dd>
                <dt>{t.samples}</dt>
                <dd>
                  {erh.num_primes}/{erh.num_samples}
                </dd>
              </dl>
            ) : (
              <dl className="report-dl">
                <dt>{t.fairness}</dt>
                <dd>{assessment.fairnessRisk}</dd>
                <dt>{t.inclusion}</dt>
                <dd>{formatScore(assessment.inclusionScore)}/100</dd>
              </dl>
            )}
          </section>

          <section>
            <h2>{t.admSection}</h2>
            <ul className="report-signals">
              {signals.map((s) => (
                <li key={s.control}>
                  <span className={`report-dot report-dot-${s.status}`} />
                  {s.control} — {t[s.status]}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section>
          <h2>{t.personas}</h2>
          <ul className="report-personas">
            {useCase.personas.map((p) => (
              <li key={p.id}>
                <strong>{p.label}</strong> ({p.ageGroup}, {p.region}) — {t.barriers}: {p.barriers.join(", ") || "—"}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>{t.safeguards}</h2>
          <p className="report-safeguards">{useCase.safeguards.join(" · ")}</p>
        </section>

        <footer className="report-foot">{t.disclosure}</footer>
      </article>
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/** Scenario IDs are locale-independent; exposed for the route's static params. */
export const reportScenarioIds = useCases.map((u) => u.id);
