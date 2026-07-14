"use client";

// ERH fairness audit as a rolling terminal log. The button kicks off the REAL
// evaluateWithErh() call against the ERH engine; while it runs we narrate the
// evaluation steps derived from the actual scenario (one line per persona and
// its barriers), then print the engine's real numbers. The narration is
// client-side theatre over a real verdict — labelled as such. Switching the
// scenario tabs changes which personas appear in the next audit run.

import { useRef, useState } from "react";
import {
  assessUseCase,
  evaluateWithErh,
  safetySignals,
  type ErhEvaluation,
  type Locale,
  type OpenDataRowMeasurement,
  type PublicServiceUseCase,
} from "@iatg/shared";

const copy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    run: string;
    running: string;
    caption: string;
    satisfied: string;
    violated: string;
    boot: string;
    correlate: (n: number) => string;
    exponent: string;
    verdict: (risk: number, alpha: number) => string;
    primes: (p: number, n: number) => string;
    persona: (label: string, barriers: string) => string;
    done: string;
    engineDown: (msg: string) => string;
    fallbackNote: string;
    scenesHint: string;
    resultTitle: string;
    riskLabel: string;
    alphaLabel: string;
    samplesLabel: string;
    riskExplain: string;
    alphaExplain: string;
    bandLow: string;
    bandMed: string;
    bandHigh: string;
  }
> = {
  en: {
    eyebrow: "ERH fairness engine",
    title: "Equity audit — streaming log",
    run: "Run fairness audit",
    running: "Auditing…",
    caption: "Log steps are narrated in the browser; the verdict card below is the live ERH engine response.",
    satisfied: "ERH SATISFIED — error growth within the fairness bound",
    violated: "ERH VIOLATED — structural error growth detected",
    boot: "Booting Ethic-Latex evaluator…",
    correlate: (n) => `Correlating decision drift across ${n} persona samples…`,
    exponent: "Estimating ethical error-growth exponent α…",
    verdict: (risk, alpha) => `Risk score ${Math.round(risk)}/100 · α = ${alpha.toFixed(3)}`,
    primes: (p, n) => `${p} of ${n} samples flagged as structurally critical`,
    persona: (label, barriers) => `Analyzing persona "${label}" — barriers: ${barriers}`,
    done: "Audit complete.",
    engineDown: (msg) => `ERH engine unreachable (${msg}) — falling back to the deterministic evaluator`,
    fallbackNote:
      "Figures below are the deterministic fallback (same logic the gateway uses when the engine is down), not live engine output.",
    scenesHint: "Want more scenes? Switch Care / Disaster / Education in Service Scenarios, then run again.",
    resultTitle: "Engine verdict",
    riskLabel: "Fairness risk",
    alphaLabel: "Error-growth α",
    samplesLabel: "Critical samples",
    riskExplain:
      "0–100, higher = riskier. ≤33 Low, ≤66 Medium, >66 High. Built from how often persona judgments violate the ERH fairness bound.",
    alphaExplain:
      "Exponent in |E(x)| ~ x^α. Healthy systems stay near α ≈ 0.5 (Riemann-like bound). Values much above 0.5 mean ethical error grows too fast with decision complexity.",
    bandLow: "Low risk band",
    bandMed: "Medium risk band",
    bandHigh: "High risk band",
  },
  "zh-TW": {
    eyebrow: "ERH 公平性引擎",
    title: "平權審計 — 即時日誌流",
    run: "執行平權審計",
    running: "審計中…",
    caption: "日誌步驟由前端敘述；下方「引擎判定」卡片為 ERH 引擎即時回傳結果。",
    satisfied: "ERH 通過 — 誤差成長在公平界線內",
    violated: "ERH 未通過 — 偵測到結構性誤差成長",
    boot: "啟動 Ethic-Latex 評估器…",
    correlate: (n) => `跨 ${n} 個人物誌樣本關聯決策漂移…`,
    exponent: "估計倫理誤差成長指數 α…",
    verdict: (risk, alpha) => `風險分數 ${Math.round(risk)}/100 · α = ${alpha.toFixed(3)}`,
    primes: (p, n) => `${n} 個樣本中有 ${p} 個被標記為結構性關鍵`,
    persona: (label, barriers) => `分析人物誌「${label}」— 障礙：${barriers}`,
    done: "審計完成。",
    engineDown: (msg) => `ERH 引擎無法連線（${msg}）— 改用確定性備援評估器`,
    fallbackNote: "以下數值為確定性備援（與引擎離線時閘道採用的邏輯相同），非引擎即時輸出。",
    scenesHint: "要換情境？先在「服務情境」切換照護／災防／教育，再按一次執行平權審計。",
    resultTitle: "引擎判定",
    riskLabel: "公平風險",
    alphaLabel: "誤差成長 α",
    samplesLabel: "結構性關鍵樣本",
    riskExplain:
      "0–100，越高越危險。≤33 低、≤66 中、>66 高。依人物誌樣本違反 ERH 公平界線的程度計算。",
    alphaExplain:
      "誤差成長指數，模型為 |E(x)| ~ x^α。健康系統約 α ≈ 0.5；明顯高於 0.5 代表決策越複雜，倫理誤差成長越快。",
    bandLow: "低風險區間",
    bandMed: "中風險區間",
    bandHigh: "高風險區間",
  },
};

interface LogLine {
  text: string;
  tone: "info" | "ok" | "warn" | "bad";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function localFallback(useCase: PublicServiceUseCase): ErhEvaluation {
  const local = assessUseCase(useCase, safetySignals);
  const numSamples = Math.max(1, useCase.personas.length);
  const risk = local.fairnessRisk === "High" ? 78 : local.fairnessRisk === "Medium" ? 52 : 24;
  const numPrimes =
    local.fairnessRisk === "High" ? numSamples : local.fairnessRisk === "Medium" ? Math.ceil(numSamples / 2) : 0;
  return {
    erh_satisfied: local.fairnessRisk !== "High",
    risk_score: risk,
    estimated_exponent: 1 + (100 - local.inclusionScore) / 100,
    violation_rate: numPrimes / numSamples,
    num_samples: numSamples,
    num_primes: numPrimes,
  };
}

function riskBand(risk: number): "good" | "warning" | "critical" {
  if (risk <= 33) return "good";
  if (risk <= 66) return "warning";
  return "critical";
}

export function ErhAuditLog({
  useCase,
  locale,
  openDataMeasurements,
}: {
  useCase: PublicServiceUseCase;
  locale: Locale;
  openDataMeasurements?: OpenDataRowMeasurement[];
}) {
  const t = copy[locale];
  const [lines, setLines] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  const [evaluation, setEvaluation] = useState<ErhEvaluation | null>(null);
  const runId = useRef(0);

  async function run() {
    const myRun = ++runId.current;
    setBusy(true);
    setFellBack(false);
    setEvaluation(null);
    setLines([]);
    const push = (line: LogLine) => {
      if (runId.current === myRun) setLines((prev) => [...prev, line]);
    };

    const evalPromise = evaluateWithErh("/api/erh", useCase, fetch, openDataMeasurements).catch(
      (err: unknown) => err as Error,
    );

    push({ text: t.boot, tone: "info" });
    await sleep(280);
    const rows = (openDataMeasurements ?? []).reduce((n, m) => n + (m.rowsSampled || 0), 0);
    if (rows > 0) {
      push({
        text:
          locale === "zh-TW"
            ? `串接開放資料 CSV 量測：抽樣 ${rows} 列，調整人物誌 judgment`
            : `Open-data CSV metrics: ${rows} rows sampled — adjusting persona judgments`,
        tone: "ok",
      });
      await sleep(240);
    }
    for (const persona of useCase.personas) {
      push({ text: t.persona(persona.label, persona.barriers.join(", ") || "—"), tone: "info" });
      await sleep(240);
    }
    push({ text: t.correlate(Math.max(1, useCase.personas.length)), tone: "info" });
    await sleep(300);
    push({ text: t.exponent, tone: "info" });
    await sleep(300);

    const result = await evalPromise;
    if (runId.current !== myRun) return;

    const next = result instanceof Error ? localFallback(useCase) : (result as ErhEvaluation);
    if (result instanceof Error) {
      push({ text: t.engineDown(result.message.slice(0, 80)), tone: "warn" });
    }
    push({ text: t.verdict(next.risk_score, next.estimated_exponent), tone: "warn" });
    push({ text: t.primes(next.num_primes, next.num_samples), tone: "warn" });
    push({
      text: next.erh_satisfied ? t.satisfied : t.violated,
      tone: next.erh_satisfied ? "ok" : "bad",
    });
    push({ text: t.done, tone: "info" });
    setEvaluation(next);
    setFellBack(result instanceof Error);
    setBusy(false);
  }

  const band = evaluation ? riskBand(evaluation.risk_score) : null;
  const bandLabel =
    band === "good" ? t.bandLow : band === "warning" ? t.bandMed : band === "critical" ? t.bandHigh : "";

  return (
    <section className="api-band card">
      <div className="api-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
        </div>
      </div>
      <p className="api-empty">{t.scenesHint}</p>
      <div className="api-actions">
        <button onClick={run} disabled={busy}>
          {busy ? t.running : t.run}
        </button>
      </div>

      <div className="erh-term" role="log" aria-live="polite">
        {lines.length === 0 && <div className="erh-line erh-info">$ erh evaluate --scenario {useCase.id}</div>}
        {lines.map((line, i) => (
          <div key={i} className={`erh-line erh-${line.tone}`}>
            <span className="erh-prompt">›</span> {line.text}
          </div>
        ))}
      </div>

      {evaluation && (
        <div className={`erh-verdict api-card ${evaluation.erh_satisfied ? "api-ok" : "api-fail"}`} aria-live="polite">
          <div className="erh-verdict-head">
            <span>{t.resultTitle}</span>
            <strong>{evaluation.erh_satisfied ? t.satisfied : t.violated}</strong>
          </div>
          <div className="erh-verdict-grid">
            <div>
              <span className="stat-label">{t.riskLabel}</span>
              <div className="stat-value">
                {Math.round(evaluation.risk_score)}/100
                <small>{bandLabel}</small>
              </div>
              <p>{t.riskExplain}</p>
            </div>
            <div>
              <span className="stat-label">{t.alphaLabel}</span>
              <div className="stat-value">α {evaluation.estimated_exponent.toFixed(2)}</div>
              <p>{t.alphaExplain}</p>
            </div>
            <div>
              <span className="stat-label">{t.samplesLabel}</span>
              <div className="stat-value">
                {evaluation.num_primes}/{evaluation.num_samples}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="api-empty erh-caption">{fellBack ? t.fallbackNote : t.caption}</p>
    </section>
  );
}
