"use client";

// React port of the original trust dashboard (apps/demo). Offline mode uses
// @iatg/shared sample data and scoring; when NEXT_PUBLIC_API_BASE_URL is
// set, the ADM panel switches to live gateway events over WebSocket.

import { useEffect, useMemo, useState } from "react";
import {
  assessUseCase,
  evaluateWithErh,
  formatScore,
  getSafetySignals,
  getSdgPriorities,
  getUseCases,
  localizeAssessment,
  probeEngines,
  probeGateway,
  safetySignals,
  useCases,
  type EngineProbeResult,
  type ErhEvaluation,
  type GatewayProbeResult,
  type LiveSafetyEvent,
  type Locale,
  type PublicServiceUseCase,
} from "@iatg/shared";
import { apiBaseURL, apiKey, gateway, liveMode, openLiveFeed } from "../lib/api";
import { Playground } from "./Playground";
import { AttackSimulator } from "./AttackSimulator";
import { ErhAuditLog } from "./ErhAuditLog";
import { OpenDataPanel } from "./OpenDataPanel";

const copy = {
  en: {
    eyebrow: "2026 Presidential Hackathon - International Track",
    title: "Inclusive AI Trust Gateway",
    intro:
      "A public-service AI evaluation and protection platform that audits fairness, explains risk, and protects AI agents from misuse so governments can deploy AI services safely and inclusively.",
    heroChips: ["ERH fairness engine", "ADM agent safety", "Trust-gated UCP commerce", "Open-data evidence"],
    nav: [
      ["overview", "Overview"],
      ["scenarios", "Scenarios"],
      ["evidence", "Trust Evidence"],
      ["open-data", "Open Data"],
      ["sdg", "SDGs"],
      ["console", "Live Console"],
    ],
    scenarios: "Service Scenarios",
    scenariosIntro:
      "Pick a public-service scenario to see who it serves, what safeguards it needs, and how the trust scores react.",
    targetUsers: "Target Users",
    safeguards: "Safeguards",
    purposeEyebrow: "What this repo does",
    purposeTitle: "One trust core for public-service AI",
    purpose:
      "The gateway turns policy concerns into testable API evidence: inclusion scoring, fairness-risk checks, open-data readiness, ADM agent-safety telemetry, and trust-gated UCP commerce flows.",
    consoleEyebrow: "Live Console",
    consoleTitle: "Talk to the running gateway",
    consoleIntro:
      "Everything below hits live services: probe the gateway APIs, replay demo requests in the playground, and check the deployed ADM and ERH engine containers.",
    evidenceEyebrow: "Trust Evidence",
    evidenceTitle: "How the two engines back the scores",
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
    sdgIntro:
      "P0/P1 goals are directly served by the current gateway. P2/P3 goals are extension tracks that reuse the same assessment, open-data, and safety APIs with new domain data.",
    proof: "Proof",
    implemented: "Implemented",
    needs: "Needs",
    barriers: "Barriers",
    metricInclusion: "Inclusion score",
    metricFairness: "Fairness risk",
    metricOpenData: "Open data readiness",
    metricAgentSafety: "Agent safety readiness",
    riskLabels: { Low: "Low", Medium: "Medium", High: "High" } as Record<string, string>,
    erhRoleDetail:
      "Converts service outcomes into comparable samples, scores fairness and ethical-error growth, and surfaces where AI decisions may structurally exclude vulnerable groups.",
    admWaiting: "Connected to the gateway - waiting for live ADM events.",
    purposeCards: [
      ["Evaluate services", "Create assessments from personas, safeguards, and open-data sources."],
      ["Monitor agents", "Ingest ADM safety events and stream live evidence to dashboards."],
      ["Gate transactions", "Block or flag delegated commerce when fairness or containment checks fail."],
      ["Share evidence", "Expose Swagger, GraphQL, Connect-RPC, and MCP interfaces for partners."],
    ],
    enginesTitle: "Engine Deployments (Choreo)",
    enginesIntro:
      "The ADM stack and ERH engine run as their own containers; the dashboard reaches them through the /api/adm and /api/erh proxies.",
    runErh: "Run ERH fairness evaluation",
    erhResult: "ERH verdict for this scenario",
    erhHealthy: "within the ERH bound",
    erhUnhealthy: "structural error growth detected",
    liveDefense: "Live Defense",
    footerLeft: "Inclusive AI Trust Gateway — hackathon MVP",
    footerRight: "ERH + ADM engines · REST / WS / Connect-RPC / GraphQL / MQTT / MCP / UCP",
  },
  "zh-TW": {
    eyebrow: "2026 總統盃黑客松 - 國際組",
    title: "包容式 AI 信任閘道",
    intro:
      "一個面向公共服務的 AI 評估與防護平台，用 API 證據檢查公平性、解釋風險，並保護 AI 代理不被濫用。",
    heroChips: ["ERH 公平性引擎", "ADM 代理安全", "UCP 交易信任把關", "開放資料佐證"],
    nav: [
      ["overview", "總覽"],
      ["scenarios", "服務情境"],
      ["evidence", "信任證據"],
      ["open-data", "開放資料"],
      ["sdg", "SDG 對應"],
      ["console", "即時主控台"],
    ],
    scenarios: "服務情境",
    scenariosIntro: "選擇一個公共服務情境，查看服務對象、所需防護措施，以及信任分數的變化。",
    targetUsers: "目標使用者",
    safeguards: "防護措施",
    purposeEyebrow: "這個 repo 能做什麼",
    purposeTitle: "公共服務 AI 的信任核心",
    purpose:
      "此閘道把政策疑慮轉成可測試的 API 證據：包容性分數、公平風險、開放資料準備度、ADM 代理安全事件，以及 UCP 交易信任把關。",
    consoleEyebrow: "即時主控台",
    consoleTitle: "直接操作運行中的閘道",
    consoleIntro:
      "以下皆為即時服務：檢查閘道 API 狀態、在遊樂場重放示範請求，並查看已部署的 ADM 與 ERH 引擎容器。",
    evidenceEyebrow: "信任證據",
    evidenceTitle: "兩個引擎如何支撐這些分數",
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
    sdgIntro:
      "P0/P1 目標由目前的閘道直接支援；P2/P3 是延伸方向，沿用同一套評估、開放資料與安全 API，只需帶入新的領域資料。",
    proof: "佐證",
    implemented: "已實作",
    needs: "需求",
    barriers: "障礙",
    metricInclusion: "包容性分數",
    metricFairness: "公平風險",
    metricOpenData: "開放資料準備度",
    metricAgentSafety: "代理安全準備度",
    riskLabels: { Low: "低", Medium: "中", High: "高" } as Record<string, string>,
    erhRoleDetail:
      "將服務結果轉為可比較的樣本，評估公平性與倫理誤差成長，並指出 AI 決策可能在結構上排除弱勢族群之處。",
    admWaiting: "已連線至閘道，等待即時 ADM 事件。",
    purposeCards: [
      ["評估服務", "由人物誌、防護措施與開放資料來源建立信任評估。"],
      ["監測代理", "接收 ADM 安全事件並將即時證據串流到儀表板。"],
      ["交易把關", "當公平性或圍堵檢查未通過時，阻擋或標記代理代購。"],
      ["共享證據", "對夥伴提供 Swagger、GraphQL、Connect-RPC 與 MCP 介面。"],
    ],
    enginesTitle: "引擎部署狀態（Choreo）",
    enginesIntro: "ADM 與 ERH 引擎各自以容器部署；儀表板透過 /api/adm 與 /api/erh 代理連線。",
    runErh: "執行 ERH 公平性評估",
    erhResult: "此情境的 ERH 評估結果",
    erhHealthy: "在 ERH 健康界線內",
    erhUnhealthy: "偵測到結構性錯誤成長",
    liveDefense: "即時防禦",
    footerLeft: "包容式 AI 信任閘道 — 黑客松 MVP",
    footerRight: "ERH + ADM 引擎 · REST / WS / Connect-RPC / GraphQL / MQTT / MCP / UCP",
  },
};

type Copy = (typeof copy)["en"];

export function Dashboard() {
  const [selectedId, setSelectedId] = useState<string>(useCases[0].id);
  const [locale, setLocale] = useState<Locale>("en");
  const localUseCases = getUseCases(locale);
  const selected = localUseCases.find((useCase) => useCase.id === selectedId) ?? localUseCases[0];
  // Scores are locale-independent (they count structure, not words), but the
  // generated strength/gap strings are localized for display.
  const assessment = useMemo(
    () => localizeAssessment(assessUseCase(selected, safetySignals), locale),
    [selected, locale],
  );
  const t = copy[locale];

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          {t.title}
        </div>
        <nav className="site-nav" aria-label="Sections">
          {t.nav.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <a className="nav-live" href="/live">
            ⚔️ {t.liveDefense}
          </a>
        </nav>
        <div className="lang-toggle" role="group" aria-label="Language">
          <button className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")}>
            EN
          </button>
          <button className={locale === "zh-TW" ? "is-active" : ""} onClick={() => setLocale("zh-TW")}>
            繁中
          </button>
        </div>
      </header>

      <section className="hero" id="overview">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="hero-intro">{t.intro}</p>
        <div className="hero-chips">
          {t.heroChips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </section>

      <div className="kpi-strip">
        <StatTile label={t.metricInclusion} score={assessment.inclusionScore} />
        <RiskTile label={t.metricFairness} risk={assessment.fairnessRisk} riskLabels={t.riskLabels} />
        <StatTile label={t.metricOpenData} score={assessment.openDataReadiness} />
        <StatTile label={t.metricAgentSafety} score={assessment.agentSafetyReadiness} />
      </div>

      <section className="section" id="scenarios">
        <div className="section-head">
          <p className="eyebrow">{t.scenarios}</p>
          <h2>{selected.name}</h2>
          <p>{t.scenariosIntro}</p>
        </div>
        <div className="workspace">
          <aside className="service-panel card">
            <h3>{t.scenarios}</h3>
            <div className="service-tabs">
              {localUseCases.map((useCase) => (
                <button
                  key={useCase.id}
                  className={`service-tab ${useCase.id === selected.id ? "is-active" : ""}`}
                  onClick={() => setSelectedId(useCase.id)}
                >
                  <span>{useCase.domain}</span>
                  {useCase.name}
                </button>
              ))}
            </div>
          </aside>

          <section className="detail-panel card">
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
                    <dt>{t.needs}</dt>
                    <dd>{persona.needs.join(", ")}</dd>
                    <dt>{t.barriers}</dt>
                    <dd>{persona.barriers.join(", ")}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="section">
        <div className="purpose-band card">
          <div>
            <p className="eyebrow">{t.purposeEyebrow}</p>
            <h2>{t.purposeTitle}</h2>
            <p>{t.purpose}</p>
          </div>
          <div className="purpose-grid">
            {t.purposeCards.map(([title, detail]) => (
              <PurposeCard key={title} title={title} detail={detail} />
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="evidence">
        <div className="section-head">
          <p className="eyebrow">{t.evidenceEyebrow}</p>
          <h2>{t.evidenceTitle}</h2>
        </div>
        <div className="evidence-grid">
          <article className="card">
            <h2>{t.erhRole}</h2>
            <p>{t.erhRoleDetail}</p>
            <ul>
              {assessment.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>{t.admRole}</h2>
            <SafetyPanel locale={locale} t={t} />
          </article>
          <article className="card">
            <h2>{t.nextSteps}</h2>
            <ul>
              {assessment.nextSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="card">
            <h2>{t.knownGaps}</h2>
            <ul>
              {assessment.gaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <div style={{ marginTop: 14 }}>
          <ErhAuditLog useCase={selected} locale={locale} />
        </div>
      </section>

      <OpenDataPanel locale={locale} scenarioId={selected.id} />

      <SdgPriorityPanel locale={locale} t={t} />

      <section className="section" id="console">
        <div className="section-head">
          <p className="eyebrow">{t.consoleEyebrow}</p>
          <h2>{t.consoleTitle}</h2>
          <p>{t.consoleIntro}</p>
        </div>
        <div className="console-stack">
          <ApiSurfacePanel useCase={selected} t={t} />
          <AttackSimulator locale={locale} />
          <Playground locale={locale} />
          <EnginesPanel useCase={selected} t={t} />
        </div>
      </section>

      <footer className="site-footer">
        <span>{t.footerLeft}</span>
        <span>{t.footerRight}</span>
      </footer>
    </>
  );
}

/** Score severity: high scores are healthy, low scores need attention. */
function scoreSeverity(score: number): "good" | "warning" | "critical" {
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "critical";
}

function StatTile({ label, score }: { label: string; score: number }) {
  const severity = scoreSeverity(score);
  return (
    <article className="stat-tile">
      <span className="stat-label">{label}</span>
      <div className="stat-value">
        {formatScore(score)}
        <small>/ 100</small>
      </div>
      <div className={`meter meter-${severity}`} role="img" aria-label={`${label}: ${score} / 100`}>
        <i style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </article>
  );
}

function RiskTile({
  label,
  risk,
  riskLabels,
}: {
  label: string;
  risk: "Low" | "Medium" | "High";
  riskLabels: Record<string, string>;
}) {
  const severity = risk === "Low" ? "good" : risk === "Medium" ? "warning" : "critical";
  return (
    <article className="stat-tile">
      <span className="stat-label">{label}</span>
      <div className="stat-value">{riskLabels[risk] ?? risk}</div>
      <span className={`pill pill-${severity}`}>{riskLabels[risk] ?? risk}</span>
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
function SafetyPanel({ locale, t }: { locale: Locale; t: Copy }) {
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
        {getSafetySignals(locale).map((signal) => (
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
      {events.length === 0 && <p>{t.admWaiting}</p>}
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

function ApiSurfacePanel({ useCase, t }: { useCase: PublicServiceUseCase; t: Copy }) {
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
    <section className="api-band card">
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
function EnginesPanel({ useCase, t }: { useCase: PublicServiceUseCase; t: Copy }) {
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
    <section className="api-band card">
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

function SdgPriorityPanel({ locale, t }: { locale: Locale; t: Copy }) {
  const top = getSdgPriorities(locale).filter((item) => item.priority === "P0" || item.priority === "P1");

  return (
    <section className="section" id="sdg">
      <div className="section-head">
        <p className="eyebrow">Corresponding SDGs</p>
        <h2>{t.sdgTitle}</h2>
        <p>{t.sdgIntro}</p>
      </div>
      <div className="sdg-priority-grid">
        {top.map((item) => (
          <article className={`sdg-priority-card card sdg-${item.priority.toLowerCase()}`} key={item.sdg}>
            <div>
              <span>{item.priority}</span>
              <strong>
                {item.sdg}: {item.name}
              </strong>
            </div>
            <p>{item.repoCanDo}</p>
            <dl>
              <dt>{t.proof}</dt>
              <dd>{item.proofPath}</dd>
              <dt>{t.implemented}</dt>
              <dd>{item.implementation.join(", ")}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
