"use client";

// Live ADM Battle Console, ported from the standalone Agentic-Defense-Matrix
// dashboard into the unified trust-gateway app. Real data: polls the analysis
// API for stats/timeline/system/LLM every few seconds and streams battle
// events over Server-Sent Events. Restyled with the app's design tokens.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  admApi,
  getConfig,
  setConfig,
  RED_TEAM_ATTACKS,
  TECH_NAME,
  type ApiConfig,
  type BattleEvent,
  type LlmStatus,
  type SessionRow,
  type Stats,
  type SystemService,
} from "../lib/admConsole";
import { readLocale, subscribeLocale } from "../lib/locale";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const CATEGORY_ORDER = ["Edge", "Detection", "Agents", "Runtime", "Data", "Ops"];
const TIMELINE_LIMIT = 1000;

type Lang = "en" | "zh-TW";

interface Dict {
  eyebrow: string;
  title: string;
  sub: string;
  live: string;
  unreachable: string;
  connecting: string;
  attacks: string;
  blockRate: string;
  detectionRate: string;
  landed: string;
  remediations: string;
  mttr: string;
  residualRisk: string;
  blockedLanded: string;
  liveFeed: string;
  noStream: string;
  waiting: string;
  byTechnique: string;
  blocked: string;
  landedLegend: string;
  loading: string;
  systemStatus: string;
  checkingServices: string;
  llmProviders: string;
  checking: string;
  recentSessions: string;
  colTechnique: string;
  colTarget: string;
  colAttack: string;
  colRemediation: string;
  notNeeded: string;
  pending: string;
  noSessions: string;
  matrix: string;
  matrixId: string;
  matrixAttack: string;
  matrixTechnique: string;
  endpoints: string;
  save: string;
  endpointHint: string;
  operational: string;
  disabled: string;
  down: string;
  inUse: string;
  standby: string;
  notConfigured: string;
  active: string;
}

const DICT: Record<Lang, Dict> = {
  en: {
    eyebrow: "Agentic Defense Matrix · Live",
    title: "⚔️ ADM Battle Console",
    sub: "Autonomous red-team vs. blue-team battles running against the live gateway — real attacks, real blocks, streamed as they happen.",
    live: "Live",
    unreachable: "Unreachable",
    connecting: "Connecting…",
    attacks: "Attacks",
    blockRate: "Block rate",
    detectionRate: "Detection rate",
    landed: "Landed",
    remediations: "Remediations",
    mttr: "MTTR",
    residualRisk: "Residual risk",
    blockedLanded: "Blocked / Landed",
    liveFeed: "Live battle feed",
    noStream: "No live stream.",
    waiting: "Waiting for battle events…",
    byTechnique: "By technique",
    blocked: "Blocked",
    landedLegend: "Landed",
    loading: "Loading…",
    systemStatus: "System status",
    checkingServices: "Checking services…",
    llmProviders: "LLM providers",
    checking: "Checking…",
    recentSessions: "Recent sessions",
    colTechnique: "Technique",
    colTarget: "Target",
    colAttack: "Attack",
    colRemediation: "Remediation",
    notNeeded: "not needed",
    pending: "pending",
    noSessions: "No sessions yet.",
    matrix: "Red-team attack matrix (30 techniques)",
    matrixId: "ID",
    matrixAttack: "Attack",
    matrixTechnique: "Technique",
    endpoints: "Endpoints",
    save: "Save",
    endpointHint: "Or append ?api=…&gw=… to the URL.",
    operational: "Operational",
    disabled: "Disabled",
    down: "Down",
    inUse: "In use",
    standby: "Standby",
    notConfigured: "Not configured",
    active: "active",
  },
  "zh-TW": {
    eyebrow: "代理防禦矩陣 · 即時",
    title: "⚔️ ADM 對抗主控台",
    sub: "自主紅隊對藍隊在即時閘道上實戰 — 真實攻擊、真實攔截，即時串流呈現。",
    live: "連線中",
    unreachable: "無法連線",
    connecting: "連線中…",
    attacks: "攻擊次數",
    blockRate: "攔截率",
    detectionRate: "偵測率",
    landed: "命中",
    remediations: "修復次數",
    mttr: "平均修復時間",
    residualRisk: "殘餘風險",
    blockedLanded: "攔截／命中",
    liveFeed: "即時對抗串流",
    noStream: "無即時串流。",
    waiting: "等待對抗事件…",
    byTechnique: "各攻擊技術",
    blocked: "已攔截",
    landedLegend: "已命中",
    loading: "載入中…",
    systemStatus: "系統狀態",
    checkingServices: "檢查服務中…",
    llmProviders: "LLM 供應商",
    checking: "檢查中…",
    recentSessions: "最近的對抗",
    colTechnique: "技術",
    colTarget: "目標",
    colAttack: "攻擊",
    colRemediation: "修復",
    notNeeded: "無需修復",
    pending: "處理中",
    noSessions: "尚無對抗紀錄。",
    matrix: "紅隊攻擊矩陣（30 種技術）",
    matrixId: "編號",
    matrixAttack: "攻擊",
    matrixTechnique: "技術",
    endpoints: "端點設定",
    save: "儲存",
    endpointHint: "或在網址加上 ?api=…&gw=… 參數。",
    operational: "運作中",
    disabled: "已停用",
    down: "已離線",
    inUse: "使用中",
    standby: "待命",
    notConfigured: "未設定",
    active: "使用中",
  },
};

export function BattleConsole() {
  const [lang, setLang] = useState<Lang>("en");
  const t = DICT[lang];
  useEffect(() => {
    setLang(readLocale());
    return subscribeLocale(setLang);
  }, []);

  const [cfg, setCfg] = useState<ApiConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [services, setServices] = useState<SystemService[]>([]);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const blockedRows = sessions.filter((s) => s.attack_outcome === "blocked");
  const landedRows = sessions.filter((s) => s.attack_outcome && s.attack_outcome !== "blocked");

  useEffect(() => {
    setCfg(getConfig());
  }, []);

  const refresh = useCallback(async () => {
    if (!cfg) return;
    try {
      setStats(await admApi.stats(cfg));
      setConnected(true);
    } catch {
      setConnected(false);
    }
    try {
      const tl = await admApi.timeline(cfg, TIMELINE_LIMIT);
      setSessions(tl.sessions ?? []);
    } catch {
      /* keep prior sessions */
    }
  }, [cfg]);

  const refreshSystem = useCallback(async () => {
    if (!cfg) return;
    try {
      setServices((await admApi.system(cfg)).services ?? []);
    } catch {
      setServices([]);
    }
    try {
      setLlm(await admApi.llm(cfg));
    } catch {
      setLlm(null);
    }
  }, [cfg]);

  useEffect(() => {
    if (!cfg) return;
    refresh();
    refreshSystem();
    const a = setInterval(refresh, 3000);
    const b = setInterval(refreshSystem, 8000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [cfg, refresh, refreshSystem]);

  useEffect(() => {
    if (!cfg) return;
    try {
      const es = new EventSource(`${cfg.analysis}/api/stream`);
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          setEvents((prev) => [JSON.parse(e.data) as BattleEvent, ...prev].slice(0, 120));
        } catch {
          /* ignore malformed frame */
        }
      };
      return () => es.close();
    } catch {
      return;
    }
  }, [cfg]);

  return (
    <div className="bc-root">
      <div className="bc-head">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
          <p className="bc-sub">{t.sub}</p>
        </div>
        <div className="bc-head-tools">
          <div className={`bc-conn bc-conn-${connected === true ? "live" : connected === false ? "down" : "idle"}`}>
            <span />
            {connected === true ? t.live : connected === false ? t.unreachable : t.connecting}
          </div>
        </div>
      </div>

      <div className="bc-tiles">
        <Tile k={t.attacks} v={stats ? String(stats.attacks) : "–"} tone="critical" />
        <Tile k={t.blockRate} v={stats ? pct(stats.block_rate) : "–"} tone="good" />
        <Tile k={t.detectionRate} v={stats ? pct(stats.detection_rate) : "–"} tone="good" />
        <Tile k={t.landed} v={stats ? String(stats.landed) : "–"} tone="critical" />
        <Tile k={t.remediations} v={stats ? String(stats.remediations) : "–"} tone="good" />
        <Tile
          k={t.mttr}
          v={stats ? (stats.mttr_seconds == null ? "–" : `${stats.mttr_seconds.toFixed(1)}s`) : "–"}
          tone="warning"
        />
        <Tile k={t.residualRisk} v={stats ? String(stats.residual_risk) : "–"} tone="warning" />
        <Tile k={t.blockedLanded} v={stats ? `${blockedRows.length} / ${landedRows.length}` : "–"} tone="good" />
      </div>

      <div className="bc-grid2">
        <section>
          <h3 className="bc-section">{t.liveFeed}</h3>
          <div className="bc-panel bc-tall">
            {events.length === 0 && (
              <div className="bc-row bc-muted">{connected === false ? t.noStream : t.waiting}</div>
            )}
            {events.map((ev, i) => (
              <EventRow key={ev.id ?? i} ev={ev} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="bc-section">{t.byTechnique}</h3>
          <div className="bc-panel bc-tall">
            <div className="bc-legend">
              <span>
                <i style={{ background: "var(--brand-500)" }} />
                {t.blocked}
              </span>
              <span>
                <i style={{ background: "var(--critical)" }} />
                {t.landedLegend}
              </span>
            </div>
            {(stats?.by_technique ?? []).map((tech) => (
              <TechRow key={tech.technique} name={tech.technique} blocked={tech.blocked} landed={tech.landed} />
            ))}
            {!stats && <div className="bc-row bc-muted">{t.loading}</div>}
          </div>
        </section>
      </div>

      <h3 className="bc-section">{t.systemStatus}</h3>
      <div className="bc-status-grid">
        {services.length === 0 && <div className="bc-status-card bc-muted">{t.checkingServices}</div>}
        {CATEGORY_ORDER.flatMap((cat) => services.filter((s) => s.category === cat)).map((s) => (
          <ServiceCard key={s.name} svc={s} t={t} />
        ))}
      </div>

      <h3 className="bc-section">{t.llmProviders}</h3>
      <div className="bc-status-grid">
        {llm ? llm.providers.map((p) => <LlmCard key={p.role} p={p} t={t} />) : <div className="bc-status-card bc-muted">{t.checking}</div>}
      </div>

      <h3 className="bc-section">{t.recentSessions}</h3>
      <div className="bc-panel">
        <div className="bc-row bc-row-head">
          <span style={{ width: 96 }}>{t.colTechnique}</span>
          <span style={{ width: 96 }}>{t.colTarget}</span>
          <span>{t.colAttack}</span>
          <span className="bc-out">{t.colRemediation}</span>
        </div>
        {sessions.slice(0, 20).map((s) => (
          <div className="bc-row" key={s.session_id}>
            <span className="bc-tech" style={{ width: 96 }}>
              {s.technique}
            </span>
            <span className="bc-muted" style={{ width: 96 }}>
              {s.target || "—"}
            </span>
            <span className={`bc-out bc-out-${s.attack_outcome}`}>{s.attack_outcome}</span>
            <span className="bc-out">
              {s.remediation_outcome
                ? `${s.remediation_outcome}${s.mttr_seconds != null ? ` · ${s.mttr_seconds.toFixed(1)}s` : ""}`
                : s.attack_outcome === "blocked"
                  ? t.notNeeded
                  : t.pending}
            </span>
          </div>
        ))}
        {sessions.length === 0 && <div className="bc-row bc-muted">{t.noSessions}</div>}
      </div>

      <h3 className="bc-section">{t.matrix}</h3>
      <div className="bc-panel bc-matrix-wrap">
        <table className="bc-matrix">
          <thead>
            <tr>
              <th>{t.matrixId}</th>
              <th>{t.matrixAttack}</th>
              <th>{t.matrixTechnique}</th>
            </tr>
          </thead>
          <tbody>
            {RED_TEAM_ATTACKS.map((row) => (
              <tr key={row.id}>
                <td className="bc-matrix-id">{row.id}</td>
                <td>{row.attack}</td>
                <td className="bc-muted">{row.technique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Settings cfg={cfg} t={t} />
    </div>
  );
}

function Tile({ k, v, tone }: { k: string; v: string; tone: "good" | "warning" | "critical" }) {
  return (
    <div className={`bc-tile bc-tile-${tone}`}>
      <span className="bc-tile-k">{k}</span>
      <strong className="bc-tile-v">{v}</strong>
    </div>
  );
}

function TechRow({ name, blocked, landed }: { name: string; blocked: number; landed: number }) {
  const total = Math.max(1, blocked + landed);
  const landedPct = landed > 0 ? Math.max(6, (landed / total) * 100) : 0;
  return (
    <div className="bc-tech-row">
      <span className="bc-tech-name">{name}</span>
      <span className="bc-bar">
        <span className="bc-bar-blocked" style={{ width: `${100 - landedPct}%` }} />
        <span className="bc-bar-landed" style={{ width: `${landedPct}%` }} />
      </span>
      <span className="bc-cnt">
        <b>{blocked}</b> ▏ <span className={landed > 0 ? "bc-crit" : ""}>{landed}</span>
      </span>
    </div>
  );
}

function EventRow({ ev }: { ev: BattleEvent }) {
  const team = (ev.team || "?").toLowerCase();
  const tag = team === "red" ? "red" : team === "green" ? "green" : "blue";
  const name = ev.technique ? TECH_NAME[ev.technique] ?? "" : "";
  const variant = ev.variant || ev.technique || ev.kind || "";
  const mutation = ev.labels?.mutation;
  return (
    <div className="bc-row" title={ev.detail || ""}>
      <span className={`bc-tag bc-tag-${tag}`}>{(ev.team || "?").toUpperCase()}</span>
      <span className="bc-tech" style={{ whiteSpace: "nowrap" }}>
        {variant}
      </span>
      <span className="bc-detail">
        {name || ev.detail || ""}
        {mutation ? <span className="bc-muted"> · {mutation}</span> : ""}
      </span>
      <span className={`bc-out bc-out-${ev.outcome || ""}`}>{ev.outcome || ""}</span>
    </div>
  );
}

function ServiceCard({ svc, t }: { svc: SystemService; t: Dict }) {
  const tone = svc.status === "up" ? "good" : svc.status === "disabled" ? "warning" : "critical";
  const icon = svc.status === "up" ? "✓" : svc.status === "disabled" ? "○" : "✕";
  const word = svc.status === "up" ? t.operational : svc.status === "disabled" ? t.disabled : t.down;
  return (
    <div className="bc-status-card">
      <span className={`bc-pill bc-pill-${tone}`}>{icon}</span>
      <div>
        <div className="bc-svc-name">
          {svc.name} <span className="bc-svc-tech">{svc.tech}</span>
        </div>
        <div className="bc-svc-detail">{svc.detail}</div>
        <div className={`bc-svc-word bc-${tone}`}>{word}</div>
      </div>
    </div>
  );
}

function LlmCard({ p, t }: { p: LlmStatus["providers"][number]; t: Dict }) {
  const standby = p.status === "up" && !p.active;
  const tone = p.status === "up" ? "good" : p.status === "unconfigured" ? "warning" : "critical";
  const icon = p.active ? "▶" : p.status === "up" ? "✓" : p.status === "unconfigured" ? "○" : "✕";
  const word = p.active ? t.inUse : standby ? t.standby : p.status === "unconfigured" ? t.notConfigured : t.down;
  return (
    <div className="bc-status-card">
      <span className={`bc-pill bc-pill-${tone}`}>{icon}</span>
      <div>
        <div className="bc-svc-name">
          {p.name} <span className="bc-svc-tech">{p.role}</span>
          {p.active && <span className="bc-tag bc-tag-green" style={{ marginLeft: 6 }}>{t.active}</span>}
        </div>
        <div className={`bc-svc-word bc-${tone}`}>{word}</div>
      </div>
    </div>
  );
}

function Settings({ cfg, t }: { cfg: ApiConfig | null; t: Dict }) {
  const [analysis, setAnalysis] = useState("");
  const [gateway, setGateway] = useState("");
  useEffect(() => {
    if (cfg) {
      setAnalysis(cfg.analysis);
      setGateway(cfg.gateway);
    }
  }, [cfg]);
  return (
    <>
      <h3 className="bc-section">{t.endpoints}</h3>
      <div className="bc-settings">
        <input value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Analysis API URL" />
        <input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="Gateway URL" />
        <button
          onClick={() => {
            setConfig(analysis.trim(), gateway.trim());
            window.location.search = "";
          }}
        >
          {t.save}
        </button>
        <span className="bc-muted">{t.endpointHint}</span>
      </div>
    </>
  );
}
