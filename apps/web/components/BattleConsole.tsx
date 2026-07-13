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

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const CATEGORY_ORDER = ["Edge", "Detection", "Agents", "Runtime", "Data", "Ops"];
const TIMELINE_LIMIT = 1000;

export function BattleConsole() {
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
          <p className="eyebrow">Agentic Defense Matrix · Live</p>
          <h2>⚔️ ADM Battle Console</h2>
          <p className="bc-sub">
            Autonomous red-team vs. blue-team battles running against the live gateway — real attacks,
            real blocks, streamed as they happen.
          </p>
        </div>
        <div className={`bc-conn bc-conn-${connected === true ? "live" : connected === false ? "down" : "idle"}`}>
          <span />
          {connected === true ? "Live" : connected === false ? "Unreachable" : "Connecting…"}
        </div>
      </div>

      <div className="bc-tiles">
        <Tile k="Attacks" v={stats ? String(stats.attacks) : "–"} tone="critical" />
        <Tile k="Block rate" v={stats ? pct(stats.block_rate) : "–"} tone="good" />
        <Tile k="Detection rate" v={stats ? pct(stats.detection_rate) : "–"} tone="good" />
        <Tile k="Landed" v={stats ? String(stats.landed) : "–"} tone="critical" />
        <Tile k="Remediations" v={stats ? String(stats.remediations) : "–"} tone="good" />
        <Tile
          k="MTTR"
          v={stats ? (stats.mttr_seconds == null ? "–" : `${stats.mttr_seconds.toFixed(1)}s`) : "–"}
          tone="warning"
        />
        <Tile k="Residual risk" v={stats ? String(stats.residual_risk) : "–"} tone="warning" />
        <Tile k="Blocked / Landed" v={stats ? `${blockedRows.length} / ${landedRows.length}` : "–"} tone="good" />
      </div>

      <div className="bc-grid2">
        <section>
          <h3 className="bc-section">Live battle feed</h3>
          <div className="bc-panel bc-tall">
            {events.length === 0 && (
              <div className="bc-row bc-muted">
                {connected === false ? "No live stream." : "Waiting for battle events…"}
              </div>
            )}
            {events.map((ev, i) => (
              <EventRow key={ev.id ?? i} ev={ev} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="bc-section">By technique</h3>
          <div className="bc-panel bc-tall">
            <div className="bc-legend">
              <span>
                <i style={{ background: "var(--brand-500)" }} />
                Blocked
              </span>
              <span>
                <i style={{ background: "var(--critical)" }} />
                Landed
              </span>
            </div>
            {(stats?.by_technique ?? []).map((tech) => (
              <TechRow key={tech.technique} name={tech.technique} blocked={tech.blocked} landed={tech.landed} />
            ))}
            {!stats && <div className="bc-row bc-muted">Loading…</div>}
          </div>
        </section>
      </div>

      <h3 className="bc-section">System status</h3>
      <div className="bc-status-grid">
        {services.length === 0 && <div className="bc-status-card bc-muted">Checking services…</div>}
        {CATEGORY_ORDER.flatMap((cat) => services.filter((s) => s.category === cat)).map((s) => (
          <ServiceCard key={s.name} svc={s} />
        ))}
      </div>

      <h3 className="bc-section">LLM providers</h3>
      <div className="bc-status-grid">
        {llm ? llm.providers.map((p) => <LlmCard key={p.role} p={p} />) : <div className="bc-status-card bc-muted">Checking…</div>}
      </div>

      <h3 className="bc-section">Recent sessions</h3>
      <div className="bc-panel">
        <div className="bc-row bc-row-head">
          <span style={{ width: 96 }}>Technique</span>
          <span style={{ width: 96 }}>Target</span>
          <span>Attack</span>
          <span className="bc-out">Remediation</span>
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
                  ? "not needed"
                  : "pending"}
            </span>
          </div>
        ))}
        {sessions.length === 0 && <div className="bc-row bc-muted">No sessions yet.</div>}
      </div>

      <h3 className="bc-section">Red-team attack matrix (30 techniques)</h3>
      <div className="bc-panel bc-matrix-wrap">
        <table className="bc-matrix">
          <thead>
            <tr>
              <th>ID</th>
              <th>Attack</th>
              <th>Technique</th>
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

      <Settings cfg={cfg} />
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

function ServiceCard({ svc }: { svc: SystemService }) {
  const tone = svc.status === "up" ? "good" : svc.status === "disabled" ? "warning" : "critical";
  const icon = svc.status === "up" ? "✓" : svc.status === "disabled" ? "○" : "✕";
  const word = svc.status === "up" ? "Operational" : svc.status === "disabled" ? "Disabled" : "Down";
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

function LlmCard({ p }: { p: LlmStatus["providers"][number] }) {
  const standby = p.status === "up" && !p.active;
  const tone = p.status === "up" ? "good" : p.status === "unconfigured" ? "warning" : "critical";
  const icon = p.active ? "▶" : p.status === "up" ? "✓" : p.status === "unconfigured" ? "○" : "✕";
  const word = p.active ? "In use" : standby ? "Standby" : p.status === "unconfigured" ? "Not configured" : "Down";
  return (
    <div className="bc-status-card">
      <span className={`bc-pill bc-pill-${tone}`}>{icon}</span>
      <div>
        <div className="bc-svc-name">
          {p.name} <span className="bc-svc-tech">{p.role}</span>
          {p.active && <span className="bc-tag bc-tag-green" style={{ marginLeft: 6 }}>active</span>}
        </div>
        <div className={`bc-svc-word bc-${tone}`}>{word}</div>
      </div>
    </div>
  );
}

function Settings({ cfg }: { cfg: ApiConfig | null }) {
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
      <h3 className="bc-section">Endpoints</h3>
      <div className="bc-settings">
        <input value={analysis} onChange={(e) => setAnalysis(e.target.value)} placeholder="Analysis API URL" />
        <input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="Gateway URL" />
        <button
          onClick={() => {
            setConfig(analysis.trim(), gateway.trim());
            window.location.search = "";
          }}
        >
          Save
        </button>
        <span className="bc-muted">Or append ?api=…&amp;gw=… to the URL.</span>
      </div>
    </>
  );
}
