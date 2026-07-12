"use client";

// React port of the original trust dashboard (apps/demo). Offline mode uses
// @iatg/shared sample data and scoring; when NEXT_PUBLIC_API_BASE_URL is
// set, the ADM panel switches to live gateway events over WebSocket.

import { useEffect, useMemo, useState } from "react";
import {
  assessUseCase,
  formatScore,
  safetySignals,
  useCases,
  type PublicServiceUseCase,
} from "@iatg/shared";
import { liveMode, openLiveFeed, type LiveSafetyEvent } from "../lib/api";

export function Dashboard() {
  const [selected, setSelected] = useState<PublicServiceUseCase>(useCases[0]);
  const assessment = useMemo(() => assessUseCase(selected, safetySignals), [selected]);

  return (
    <>
      <section className="assessment-band">
        <div className="assessment-copy">
          <p className="eyebrow">2026 Presidential Hackathon - International Track</p>
          <h1>Inclusive AI Trust Gateway</h1>
          <p>
            A public-service AI evaluation and protection platform that audits fairness,
            explains risk, and protects AI agents from misuse so governments can deploy AI
            services safely and inclusively.
          </p>
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
          <h2>Service Scenarios</h2>
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
              <h3>Target Users</h3>
              <ul>
                {selected.targetUsers.map((user) => (
                  <li key={user}>{user}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Safeguards</h3>
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

      <section className="evidence-grid">
        <article>
          <h2>Ethic-Latex / ERH Role</h2>
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
          <h2>ADM Safety Role</h2>
          <SafetyPanel />
        </article>
        <article>
          <h2>Next Build Steps</h2>
          <ul>
            {assessment.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article>
          <h2>Known Gaps</h2>
          <ul>
            {assessment.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
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
