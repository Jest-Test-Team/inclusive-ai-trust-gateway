"use client";

// React port of the original trust dashboard (apps/demo). Offline mode uses
// @iatg/shared sample data and scoring; when NEXT_PUBLIC_API_BASE_URL is
// set, the ADM panel switches to live gateway events over WebSocket.

import { useEffect, useMemo, useState } from "react";
import {
  assessUseCase,
  evaluateWithErh,
  formatScore,
  probeEngines,
  probeGateway,
  safetySignals,
  sdgPriorities,
  useCases,
  type EngineProbeResult,
  type ErhEvaluation,
  type GatewayProbeResult,
  type LiveSafetyEvent,
  type PublicServiceUseCase,
} from "@iatg/shared";
import { apiBaseURL, apiKey, gateway, liveMode, openLiveFeed } from "../lib/api";

type Locale = "en" | "zh-TW";

const copy = {
  en: {
    eyebrow: "2026 Presidential Hackathon - International Track",
    title: "Inclusive AI Trust Gateway",
    intro:
      "A public-service AI evaluation and protection platform that audits fairness, explains risk, and protects AI agents from misuse so governments can deploy AI services safely and inclusively.",
    scenarios: "Service Scenarios",
    targetUsers: "Target Users",
    safeguards: "Safeguards",
    purposeEyebrow: "What this repo does",
    purposeTitle: "One trust core for public-service AI",
    purpose:
      "The gateway turns policy concerns into testable API evidence: inclusion scoring, fairness-risk checks, open-data readiness, ADM agent-safety telemetry, and trust-gated UCP commerce flows.",
    apiTitle: "Live Integration Status",
    swagger: "Swagger",
    runCheck: "Run API check",
    sendEvent: "Send ADM event",
    createAssessment: "Create assessment",
    erhRole: "Ethic-Latex / ERH Role",
    admRole: "ADM Safety Role",
    nextSteps: "Next Build Steps",
    knownGaps: "Known Gaps",
    connected: "Connected",
    checkRequired: "Check required",
    sdgTitle: "Priority Implementation List",
    enginesTitle: "Engine Deployments (Back4App)",
    enginesIntro:
      "The ADM stack and ERH engine run as their own containers; the dashboard reaches them through the /api/adm and /api/erh proxies.",
    runErh: "Run ERH fairness evaluation",
    erhResult: "ERH verdict for this scenario",
    erhHealthy: "within the ERH bound",
    erhUnhealthy: "structural error growth detected",
  },
  "zh-TW": {
    eyebrow: "2026 總統盃黑客松 - 國際組",
    title: "包容式 AI 信任閘道",
    intro:
      "一個面向公共服務的 AI 評估與防護平台，用 API 證據檢查公平性、解釋風險，並保護 AI 代理不被濫用。",
    scenarios: "服務情境",
    targetUsers: "目標使用者",
    safeguards: "防護措施",
    purposeEyebrow: "這個 repo 能做什麼",
    purposeTitle: "公共服務 AI 的信任核心",
    purpose:
      "此閘道把政策疑慮轉成可測試的 API 證據：包容性分數、公平風險、開放資料準備度、ADM 代理安全事件，以及 UCP 交易信任把關。",
    apiTitle: "即時 API 整合狀態",
    swagger: "Swagger 文件",
    runCheck: "重新檢查 API",
    sendEvent: "送出 ADM 事件",
    createAssessment: "建立評估",
    erhRole: "Ethic-Latex / ERH 角色",
    admRole: "ADM 安全角色",
    nextSteps: "下一步建置",
    knownGaps: "已知缺口",
    connected: "已連線",
    checkRequired: "需要檢查",
    sdgTitle: "優先實作清單",
    enginesTitle: "引擎部署狀態（Back4App）",
    enginesIntro: "ADM 與 ERH 引擎各自以容器部署；儀表板透過 /api/adm 與 /api/erh 代理連線。",
    runErh: "執行 ERH 公平性評估",
    erhResult: "此情境的 ERH 評估結果",
    erhHealthy: "在 ERH 健康界線內",
    erhUnhealthy: "偵測到結構性錯誤成長",
  },
} satisfies Record<Locale, Record<string, string>>;

export function Dashboard() {
  const [selected, setSelected] = useState<PublicServiceUseCase>(useCases[0]);
  const [locale, setLocale] = useState<Locale>("en");
  const assessment = useMemo(() => assessUseCase(selected, safetySignals), [selected]);
  const t = copy[locale];

  return (
    <>
      <section className="assessment-band">
        <div className="assessment-copy">
          <div className="hero-tools" aria-label="Language">
            <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")}>
              EN
            </button>
            <button className={locale === "zh-TW" ? "is-active" : ""} onClick={() => setLocale("zh-TW")}>
              繁中
            </button>
          </div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
        <div className="metrics-grid">
          <Metric label="Inclusion score" value={formatScore(assessment.inclusionScore)} tone="green" />
          <Metric label="Fairness risk" value={assessment.fairnessRisk} tone="amber" />
          <Metric label="Open data" value={formatScore(assessment.openDataReadiness)} tone="blue" />
          <Metric label="Agent safety" value={formatScore(assessment.agentSafetyReadiness)} tone="red" />
        </div>
      </section>

      <section className="workspace">
        <aside className="service-panel">
          <h2>{t.scenarios}</h2>
          <div className="service-tabs">
            {useCases.map((useCase) => (
              <button
                key={useCase.id}
                className={`service-tab ${useCase.id === selected.id ? "is-active" : ""}`}
                onClick={() => setSelected(useCase)}
              >
                <span>{useCase.domain}</span>
                {useCase.name}
              </button>
            ))}
          </div>
        </aside>

        <section className="detail-panel">
          <div className="detail-header">
            <div>
              <p className="eyebrow">{selected.domain}</p>
              <h2>{selected.name}</h2>
            </div>
            <div className="sdg-row">
              {selected.sdgs.map((sdg) => (
                <span key={sdg}>{sdg}</span>
              ))}
            </div>
          </div>
          <p className="summary">{selected.summary}</p>

          <div className="two-column">
            <article>
              <h3>{t.targetUsers}</h3>
              <ul>
                {selected.targetUsers.map((user) => (
                  <li key={user}>{user}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>{t.safeguards}</h3>
              <ul>
                {selected.safeguards.map((safeguard) => (
                  <li key={safeguard}>{safeguard}</li>
                ))}
              </ul>
            </article>
          </div>

          <div className="personas">
            {selected.personas.map((persona) => (
              <article className="persona-card" key={persona.id}>
                <div>
                  <h3>{persona.label}</h3>
                  <p>
                    {persona.ageGroup} - {persona.region}
                  </p>
                </div>
                <dl>
                  <dt>Needs</dt>
                  <dd>{persona.needs.join(", ")}</dd>
                  <dt>Barriers</dt>
                  <dd>{persona.barriers.join(", ")}</dd>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="purpose-band">
        <div>
          <p className="eyebrow">{t.purposeEyebrow}</p>
          <h2>{t.purposeTitle}</h2>
          <p>{t.purpose}</p>
        </div>
        <div className="purpose-grid">
          <PurposeCard title="Evaluate services" detail="Create assessments from personas, safeguards, and open-data sources." />
          <PurposeCard title="Monitor agents" detail="Ingest ADM safety events and stream live evidence to dashboards." />
          <PurposeCard title="Gate transactions" detail="Block or flag delegated commerce when fairness or containment checks fail." />
          <PurposeCard title="Share evidence" detail="Expose Swagger, GraphQL, Connect-RPC, and MCP interfaces for partners." />
        </div>
      </section>

      <section className="evidence-grid">
        <article>
          <h2>{t.erhRole}</h2>
          <p>
            Converts service outcomes into comparable samples, scores fairness and
            ethical-error growth, and surfaces where AI decisions may structurally exclude
            vulnerable groups.
          </p>
          <ul>
            {assessment.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h2>{t.admRole}</h2>
          <SafetyPanel />
        </article>
        <article>
          <h2>{t.nextSteps}</h2>
          <ul>
            {assessment.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h2>{t.knownGaps}</h2>
          <ul>
            {assessment.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <SdgPriorityPanel t={t} />
      <ApiSurfacePanel useCase={selected} t={t} />
      <EnginesPanel useCase={selected} t={t} />
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <article className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PurposeCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className="purpose-card">
      <strong>{title}</strong>
      <p>{detail}</p>
    </article>
  );
}

/**
 * Offline mode lists the static ADM control inventory; live mode streams
 * safety events from the gateway WebSocket.
 */
function SafetyPanel() {
  const [events, setEvents] = useState<LiveSafetyEvent[]>([]);

  useEffect(() => {
    if (!liveMode) return;
    return openLiveFeed((channel, data) => {
      if (channel !== "adm.safety-events") return;
      setEvents((prev) => [data as LiveSafetyEvent, ...prev].slice(0, 20));
    });
  }, []);

  if (!liveMode) {
    return (
      <div className="signal-list">
        {safetySignals.map((signal) => (
          <article className="signal-row" key={signal.control}>
            <span className={`status-dot status-${signal.status}`} aria-label={signal.status} />
            <div>
              <strong>{signal.control}</strong>
              <p>{signal.description}</p>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="signal-list" aria-live="polite">
      {events.length === 0 && <p>Connected to the gateway - waiting for live ADM events.</p>}
      {events.map((event) => (
        <article className="signal-row" key={event.id}>
          <span
            className={`status-dot status-${event.severity === "critical" || event.severity === "high" ? "missing" : "partial"}`}
            aria-label={event.severity}
          />
          <div>
            <strong>{event.eventType}</strong>
            <p>
              {event.severity}
              {event.sessionId ? ` - session ${event.sessionId}` : ""}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ApiSurfacePanel({ useCase, t }: { useCase: PublicServiceUseCase; t: Record<string, string> }) {
  const [results, setResults] = useState<GatewayProbeResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastAction, setLastAction] = useState("");

  const runProbe = () => {
    if (!liveMode) return;
    let cancelled = false;
    setRunning(true);
    probeGateway({ baseURL: apiBaseURL, apiKey }, useCase)
      .then((next) => {
        if (!cancelled) setResults(next);
      })
      .finally(() => {
        if (!cancelled) setRunning(false);
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return runProbe();
  }, [useCase]);

  async function createDemoAssessment() {
    const created = await gateway.createAssessment(useCase);
    setLastAction(`Created ${created.id}`);
    runProbe();
  }

  async function sendDemoEvent() {
    const event = await gateway.ingestSafetyEvent({
      eventType: "prompt_injection",
      severity: "high",
      detail: { source: "web-demo", message: "Demo prompt-injection event" },
    });
    setLastAction(`Sent ${event.eventType}`);
    runProbe();
  }

  return (
    <section className="api-band">
      <div className="api-header">
        <div>
          <p className="eyebrow">Gateway APIs</p>
          <h2>{t.apiTitle}</h2>
        </div>
        {liveMode && (
          <a href={gateway.docsURL} target="_blank" rel="noreferrer">
            {t.swagger}
          </a>
        )}
      </div>
      {liveMode && (
        <div className="api-actions">
          <button onClick={runProbe} disabled={running}>
            {t.runCheck}
          </button>
          <button onClick={createDemoAssessment}>{t.createAssessment}</button>
          <button onClick={sendDemoEvent}>{t.sendEvent}</button>
          {lastAction && <span>{lastAction}</span>}
        </div>
      )}

      {!liveMode ? (
        <p className="api-empty">
          Offline demo mode. Set NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_API_KEY in Vercel to use the gateway APIs.
        </p>
      ) : (
        <div className="api-grid" aria-live="polite">
          {results.map((result) => (
            <article className={`api-card ${result.ok ? "api-ok" : "api-fail"}`} key={result.surface}>
              <span>{result.label}</span>
              <strong>{result.ok ? t.connected : t.checkRequired}</strong>
              <p>{result.detail}</p>
            </article>
          ))}
          {running && results.length === 0 && <p className="api-empty">Checking gateway APIs...</p>}
        </div>
      )}
    </section>
  );
}

/**
 * Live status of the two engine containers (ADM stack, ERH engine) plus an
 * interactive ERH evaluation of the selected scenario. Reaches the engines
 * through the same-origin /api/adm and /api/erh proxies, so it works even
 * before the trust gateway itself is deployed.
 */
function EnginesPanel({ useCase, t }: { useCase: PublicServiceUseCase; t: Record<string, string> }) {
  const [results, setResults] = useState<EngineProbeResult[]>([]);
  const [evaluation, setEvaluation] = useState<ErhEvaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    probeEngines({ admBaseURL: "/api/adm", erhBaseURL: "/api/erh" }, useCase).then((next) => {
      if (!cancelled) setResults(next);
    });
    return () => {
      cancelled = true;
    };
  }, [useCase]);

  async function runErh() {
    setBusy(true);
    setError("");
    try {
      setEvaluation(await evaluateWithErh("/api/erh", useCase));
    } catch (err) {
      setEvaluation(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="api-band">
      <div className="api-header">
        <div>
          <p className="eyebrow">ADM + ERH</p>
          <h2>{t.enginesTitle}</h2>
        </div>
      </div>
      <p className="api-empty">{t.enginesIntro}</p>
      <div className="api-actions">
        <button onClick={runErh} disabled={busy}>
          {t.runErh}
        </button>
        {error && <span>{error}</span>}
      </div>
      <div className="api-grid" aria-live="polite">
        {results.map((result) => (
          <article className={`api-card ${result.ok ? "api-ok" : "api-fail"}`} key={result.label}>
            <span>{result.label}</span>
            <strong>{result.ok ? t.connected : t.checkRequired}</strong>
            <p>{result.detail}</p>
          </article>
        ))}
        {evaluation && (
          <article className={`api-card ${evaluation.erh_satisfied ? "api-ok" : "api-fail"}`}>
            <span>{t.erhResult}</span>
            <strong>
              {Math.round(evaluation.risk_score)}/100 · α {evaluation.estimated_exponent.toFixed(2)}
            </strong>
            <p>
              {evaluation.erh_satisfied ? t.erhHealthy : t.erhUnhealthy} ({evaluation.num_primes} critical of{" "}
              {evaluation.num_samples} samples)
            </p>
          </article>
        )}
      </div>
    </section>
  );
}

function SdgPriorityPanel({ t }: { t: Record<string, string> }) {
  const top = sdgPriorities.filter((item) => item.priority === "P0" || item.priority === "P1");

  return (
    <section className="sdg-band">
      <div className="sdg-priority-header">
        <div>
          <p className="eyebrow">Corresponding SDGs</p>
          <h2>{t.sdgTitle}</h2>
        </div>
        <p>
          P0/P1 goals are directly served by the current gateway. P2/P3 goals are extension
          tracks that reuse the same assessment, open-data, and safety APIs with new domain data.
        </p>
      </div>
      <div className="sdg-priority-grid">
        {top.map((item) => (
          <article className={`sdg-priority-card sdg-${item.priority.toLowerCase()}`} key={item.sdg}>
            <div>
              <span>{item.priority}</span>
              <strong>
                {item.sdg}: {item.name}
              </strong>
            </div>
            <p>{item.repoCanDo}</p>
            <dl>
              <dt>Proof</dt>
              <dd>{item.proofPath}</dd>
              <dt>Implemented</dt>
              <dd>{item.implementation.join(", ")}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
