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
  reassessStale: string;
  reassessing: string;
  reassessDone: string;
  offline: string;
  ucpHint: string;
  resultTitle: string;
  reasonLabel: string;
  productLabel: string;
  productFair: string;
  productGouge: string;
  verdict: Record<string, string>;
  verdictExplain: Record<string, string>;
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
    reassessStale: "Re-score legacy 12/100 rows",
    reassessing: "Re-scoring...",
    reassessDone: "Re-scored",
    offline: "Offline demo mode - the playground needs the live gateway.",
    ucpHint:
      "Tip: fair-priced items (CARE-001~003) should be Allowed. CARE-004 is an intentional price-gouge demo and should be Blocked.",
    resultTitle: "Trust gate result",
    reasonLabel: "Why",
    productLabel: "Product tried",
    productFair: "fair reference",
    productGouge: "overpriced — will be blocked",
    verdict: { allowed: "Allowed — checkout may proceed", flagged: "Flagged — needs human review", blocked: "Blocked — checkout stopped" },
    verdictExplain: {
      allowed: "Price is within the fair open-data reference.",
      flagged: "Price is elevated; the gate asks for review before paying.",
      blocked: "Price is more than 50% above the fair reference, so the trust gate refused the purchase.",
    },
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
    reassessStale: "重算舊版 12/100 評估",
    reassessing: "重算中...",
    reassessDone: "已重算",
    offline: "離線示範模式 - 遊樂場需要連上即時閘道。",
    ucpHint:
      "提示：公平定價商品（CARE-001～003）應顯示「允許」。CARE-004 是故意偏高的示範商品，信任閘道會「阻擋」。",
    resultTitle: "信任把關結果",
    reasonLabel: "原因",
    productLabel: "嘗試結帳的商品",
    productFair: "公平參考",
    productGouge: "偏高，會被擋",
    verdict: { allowed: "允許 — 可以結帳", flagged: "標記 — 需人工審核", blocked: "已阻擋 — 結帳被拒絕" },
    verdictExplain: {
      allowed: "售價落在開放資料的公平參考價範圍內。",
      flagged: "售價偏高，閘道要求先人工確認再付款。",
      blocked: "售價比公平參考價高出超過 50%，信任閘道拒絕這筆購買。",
    },
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
  const [reassessing, setReassessing] = useState(false);
  const [reassessNote, setReassessNote] = useState("");
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

  async function reassessLegacyRows() {
    if (!liveMode) return;
    setReassessing(true);
    setReassessNote("");
    try {
      const result = await gateway.reassessStaleAssessments();
      setReassessNote(`${t.reassessDone}: ${result.updated}`);
      await refreshRecent();
    } catch (err) {
      setReassessNote(err instanceof Error ? err.message : "reassess failed");
    } finally {
      setReassessing(false);
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
        const preferred = discovery.products.find((p) => p.sku !== "CARE-004") ?? discovery.products[0];
        if (preferred) setSku(preferred.sku);
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
          // Prefer an allowed/fair SKU for demo scoring; CARE-004 is the
          // intentional "price gouge" product that the trust gate blocks.
          const checkoutSku = sku || products.find((p) => p.sku !== "CARE-004")?.sku || products[0]?.sku || "";
          if (!checkoutSku) throw new Error("No product available from UCP catalog");
          const product = products.find((p) => p.sku === checkoutSku);
          const checkout = await gateway.createCheckoutIntent(session.id, checkoutSku, quantity);
          setRaw(JSON.stringify(checkout, null, 2));
          const verdict = checkout.trust.trustVerdict;
          const productLine = product
            ? `${product.name} · ${product.priceTWD} TWD（${t.productFair} ${product.fairPriceTWD} TWD）`
            : checkoutSku;
          setCards([
            {
              label: t.resultTitle,
              value: t.verdict[verdict] ?? verdict,
              tone: verdict === "allowed" ? "ok" : verdict === "flagged" ? "warn" : "fail",
            },
            {
              label: t.reasonLabel,
              value: checkout.trust.reason || t.verdictExplain[verdict] || "—",
              tone: verdict === "allowed" ? "ok" : verdict === "flagged" ? "warn" : "fail",
            },
            { label: t.productLabel, value: productLine, tone: "ok" },
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
            <p className="api-empty playground-hint">{t.ucpHint}</p>
            <label>
              {t.product}
              <select value={sku} onChange={(e) => setSku(e.target.value)}>
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku === "CARE-004"
                      ? `${p.name} · ${p.priceTWD} TWD（${t.productGouge}）`
                      : `${p.name} · ${p.priceTWD} TWD（${t.productFair} ${p.fairPriceTWD}）`}
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
          <div className="api-header">
            <h3>{t.recentTitle}</h3>
            <button type="button" className="playground-send" disabled={reassessing} onClick={() => void reassessLegacyRows()}>
              {reassessing ? t.reassessing : t.reassessStale}
            </button>
          </div>
          {reassessNote && <p className="api-empty">{reassessNote}</p>}
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
