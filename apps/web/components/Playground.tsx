"use client";

// Interactive API playground: pick an action and payload values from
// dropdowns, invoke the live gateway/engines, and see the response rendered
// as cards plus collapsible raw JSON. Complements the read-only probe panel.

import { useEffect, useState } from "react";
import {
  evaluateWithErh,
  getUseCases,
  useCases,
  type AssessmentResponse,
  type Locale,
  type Product,
} from "@iatg/shared";
import { gateway, liveMode } from "../lib/api";

type Action = "assessment" | "adm-event" | "erh-evaluate" | "ucp-checkout";

interface PlaygroundCopy {
  title: string;
  intro: string;
  actionLabel: string;
  actions: Record<Action, string>;
  scenario: string;
  eventType: string;
  severity: string;
  product: string;
  quantity: string;
  send: string;
  sending: string;
  rawJson: string;
  recentTitle: string;
  colName: string;
  colDomain: string;
  colInclusion: string;
  colFairness: string;
  colEvaluator: string;
  colCreated: string;
  offline: string;
  verdict: Record<string, string>;
}

const playgroundCopy: Record<Locale, PlaygroundCopy> = {
  en: {
    title: "API Playground",
    intro: "Choose an action and payload values, send it to the live gateway, and inspect the rendered response.",
    actionLabel: "Action",
    actions: {
      assessment: "Create trust assessment (REST)",
      "adm-event": "Send ADM safety event",
      "erh-evaluate": "Run ERH fairness evaluation",
      "ucp-checkout": "UCP checkout intent (trust-gated)",
    },
    scenario: "Scenario",
    eventType: "Event type",
    severity: "Severity",
    product: "Product",
    quantity: "Quantity",
    send: "Send request",
    sending: "Sending...",
    rawJson: "Raw JSON response",
    recentTitle: "Recent assessments (live from the gateway)",
    colName: "Name",
    colDomain: "Domain",
    colInclusion: "Inclusion",
    colFairness: "Fairness",
    colEvaluator: "Evaluator",
    colCreated: "Created",
    offline: "Offline demo mode - the playground needs the live gateway.",
    verdict: { allowed: "Allowed", flagged: "Flagged for review", blocked: "Blocked" },
  },
  "zh-TW": {
    title: "API 遊樂場",
    intro: "用下拉選單選擇動作與參數，送出到即時閘道，並檢視渲染後的回應。",
    actionLabel: "動作",
    actions: {
      assessment: "建立信任評估（REST）",
      "adm-event": "送出 ADM 安全事件",
      "erh-evaluate": "執行 ERH 公平性評估",
      "ucp-checkout": "UCP 結帳意圖（信任把關）",
    },
    scenario: "情境",
    eventType: "事件類型",
    severity: "嚴重度",
    product: "商品",
    quantity: "數量",
    send: "送出請求",
    sending: "送出中...",
    rawJson: "原始 JSON 回應",
    recentTitle: "最近的評估（閘道即時資料）",
    colName: "名稱",
    colDomain: "領域",
    colInclusion: "包容性",
    colFairness: "公平風險",
    colEvaluator: "評估器",
    colCreated: "建立時間",
    offline: "離線示範模式 - 遊樂場需要連上即時閘道。",
    verdict: { allowed: "允許", flagged: "標記待人工審核", blocked: "已阻擋" },
  },
};

const eventTypes = ["prompt_injection", "tool_policy", "containment", "provenance"] as const;
const severities = ["low", "medium", "high", "critical"] as const;

interface ResultCard {
  label: string;
  value: string;
  tone: "ok" | "warn" | "fail";
}

export function Playground({ locale }: { locale: Locale }) {
  const t = playgroundCopy[locale];
  const scenarios = getUseCases(locale);

  const [action, setAction] = useState<Action>("assessment");
  const [scenarioId, setScenarioId] = useState(useCases[0].id);
  const [eventType, setEventType] = useState<string>(eventTypes[0]);
  const [severity, setSeverity] = useState<string>("high");
  const [products, setProducts] = useState<Product[]>([]);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [raw, setRaw] = useState("");
  const [recent, setRecent] = useState<AssessmentResponse[]>([]);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  async function refreshRecent() {
    try {
      const listed = await gateway.listAssessments();
      setRecent(listed.items.slice(0, 8));
    } catch {
      // gateway offline; table stays empty
    }
  }

  useEffect(() => {
    if (!liveMode) return;
    void refreshRecent();
  }, []);

  // Populate the product dropdown from the live UCP catalog.
  useEffect(() => {
    if (!liveMode || action !== "ucp-checkout" || products.length > 0) return;
    (async () => {
      try {
        const session = await gateway.openCommerceSession("playground", scenario.personas[0]?.id ?? "persona");
        const discovery = await gateway.discoverProducts(session.id, "");
        setProducts(discovery.products);
        if (discovery.products.length > 0) setSku(discovery.products[0].sku);
      } catch {
        // leave dropdown empty; send will surface the error
      }
    })();
  }, [action]);

  async function send() {
    setBusy(true);
    setCards([]);
    setRaw("");
    try {
      switch (action) {
        case "assessment": {
          const created = await gateway.createAssessment(scenario);
          setRaw(JSON.stringify(created, null, 2));
          setCards([
            { label: t.colName, value: created.name, tone: "ok" },
            { label: t.colInclusion, value: `${created.inclusionScore}/100`, tone: created.inclusionScore >= 64 ? "ok" : "warn" },
            {
              label: t.colFairness,
              value: `${created.fairnessRisk}/100 (${created.fairnessRiskLabel})`,
              tone: created.fairnessRiskLabel === "High" ? "fail" : created.fairnessRiskLabel === "Medium" ? "warn" : "ok",
            },
            { label: t.colEvaluator, value: created.evaluator, tone: created.evaluator === "erh-engine" ? "ok" : "warn" },
          ]);
          await refreshRecent();
          break;
        }
        case "adm-event": {
          const event = await gateway.ingestSafetyEvent({
            eventType,
            severity,
            detail: { source: "playground", scenario: scenario.name },
          });
          setRaw(JSON.stringify(event, null, 2));
          setCards([
            { label: t.eventType, value: event.eventType, tone: "ok" },
            { label: t.severity, value: event.severity, tone: severity === "critical" || severity === "high" ? "fail" : "warn" },
            { label: "ID", value: event.id.slice(0, 8), tone: "ok" },
          ]);
          break;
        }
        case "erh-evaluate": {
          const evaluation = await evaluateWithErh("/api/erh", scenario);
          setRaw(JSON.stringify(evaluation, null, 2));
          setCards([
            {
              label: "risk_score",
              value: `${Math.round(evaluation.risk_score)}/100`,
              tone: evaluation.risk_score > 66 ? "fail" : evaluation.risk_score > 33 ? "warn" : "ok",
            },
            { label: "alpha", value: evaluation.estimated_exponent.toFixed(2), tone: evaluation.erh_satisfied ? "ok" : "warn" },
            { label: "ERH", value: evaluation.erh_satisfied ? "satisfied" : "violated", tone: evaluation.erh_satisfied ? "ok" : "fail" },
            { label: "samples", value: `${evaluation.num_primes}/${evaluation.num_samples} critical`, tone: "ok" },
          ]);
          break;
        }
        case "ucp-checkout": {
          const session = await gateway.openCommerceSession("playground", scenario.personas[0]?.id ?? "persona");
          const checkout = await gateway.createCheckoutIntent(session.id, sku, quantity);
          setRaw(JSON.stringify(checkout, null, 2));
          const verdict = checkout.trust.trustVerdict;
          setCards([
            {
              label: "Verdict",
              value: t.verdict[verdict] ?? verdict,
              tone: verdict === "allowed" ? "ok" : verdict === "flagged" ? "warn" : "fail",
            },
            { label: t.product, value: sku, tone: "ok" },
            ...(checkout.trust.reason ? [{ label: "Reason", value: checkout.trust.reason, tone: "fail" as const }] : []),
          ]);
          break;
        }
      }
    } catch (error) {
      setCards([{ label: "Error", value: error instanceof Error ? error.message : String(error), tone: "fail" }]);
    } finally {
      setBusy(false);
    }
  }

  if (!liveMode) {
    return (
      <section className="api-band">
        <div className="api-header">
          <div>
            <p className="eyebrow">Playground</p>
            <h2>{t.title}</h2>
          </div>
        </div>
        <p className="api-empty">{t.offline}</p>
      </section>
    );
  }

  return (
    <section className="api-band">
      <div className="api-header">
        <div>
          <p className="eyebrow">Playground</p>
          <h2>{t.title}</h2>
        </div>
      </div>
      <p className="api-empty">{t.intro}</p>

      <div className="playground-form">
        <label>
          {t.actionLabel}
          <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
            {(Object.keys(t.actions) as Action[]).map((key) => (
              <option key={key} value={key}>
                {t.actions[key]}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.scenario}
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {action === "adm-event" && (
          <>
            <label>
              {t.eventType}
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.severity}
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {severities.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {action === "ucp-checkout" && (
          <>
            <label>
              {t.product}
              <select value={sku} onChange={(e) => setSku(e.target.value)}>
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name} ({p.priceTWD} TWD)
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.quantity}
              <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <button onClick={send} disabled={busy || (action === "ucp-checkout" && !sku)}>
          {busy ? t.sending : t.send}
        </button>
      </div>

      {cards.length > 0 && (
        <div className="api-grid" aria-live="polite">
          {cards.map((card) => (
            <article
              key={card.label}
              className={`api-card ${card.tone === "ok" ? "api-ok" : card.tone === "warn" ? "api-warn" : "api-fail"}`}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>
      )}

      {raw && (
        <details className="playground-raw">
          <summary>{t.rawJson}</summary>
          <pre>{raw}</pre>
        </details>
      )}

      {recent.length > 0 && (
        <div className="playground-table-wrap">
          <h3>{t.recentTitle}</h3>
          <table className="playground-table">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th>{t.colDomain}</th>
                <th>{t.colInclusion}</th>
                <th>{t.colFairness}</th>
                <th>{t.colEvaluator}</th>
                <th>{t.colCreated}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.domain}</td>
                  <td>{item.inclusionScore}/100</td>
                  <td>
                    {item.fairnessRisk}/100 ({item.fairnessRiskLabel})
                  </td>
                  <td>{item.evaluator}</td>
                  <td>{new Date(item.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
