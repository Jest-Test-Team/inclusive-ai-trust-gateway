"use client";

// ERH fairness audit as a rolling terminal log. The button kicks off the REAL
// evaluateWithErh() call against the ERH engine; while it runs we narrate the
// evaluation steps derived from the actual scenario (one line per persona and
// its barriers), then print the engine's real numbers. The narration is
// client-side theatre over a real verdict — labelled as such.

import { useRef, useState } from "react";
import { evaluateWithErh, type ErhEvaluation, type Locale, type PublicServiceUseCase } from "@iatg/shared";

const copy: Record<Locale, {
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
}> = {
  en: {
    eyebrow: "ERH fairness engine",
    title: "Equity audit — streaming log",
    run: "Run fairness audit",
    running: "Auditing…",
    caption: "Steps narrated client-side; the verdict below is returned by the ERH engine.",
    satisfied: "ERH SATISFIED — error growth within the fairness bound",
    violated: "ERH VIOLATED — structural error growth detected",
    boot: "Booting Ethic-Latex evaluator…",
    correlate: (n) => `Correlating decision drift across ${n} persona samples…`,
    exponent: "Estimating ethical error-growth exponent α…",
    verdict: (risk, alpha) => `Risk score ${Math.round(risk)}/100 · α = ${alpha.toFixed(3)}`,
    primes: (p, n) => `${p} of ${n} samples flagged as structurally critical`,
    persona: (label, barriers) => `Analyzing persona "${label}" — barriers: ${barriers}`,
    done: "Audit complete.",
  },
  "zh-TW": {
    eyebrow: "ERH 公平性引擎",
    title: "平權審計 — 即時日誌流",
    run: "執行平權審計",
    running: "審計中…",
    caption: "各步驟為前端敘述；下方判定結果由 ERH 引擎實際回傳。",
    satisfied: "ERH 通過 — 誤差成長在公平界線內",
    violated: "ERH 未通過 — 偵測到結構性誤差成長",
    boot: "啟動 Ethic-Latex 評估器…",
    correlate: (n) => `跨 ${n} 個人物誌樣本關聯決策漂移…`,
    exponent: "估計倫理誤差成長指數 α…",
    verdict: (risk, alpha) => `風險分數 ${Math.round(risk)}/100 · α = ${alpha.toFixed(3)}`,
    primes: (p, n) => `${n} 個樣本中有 ${p} 個被標記為結構性關鍵`,
    persona: (label, barriers) => `分析人物誌「${label}」— 障礙：${barriers}`,
    done: "審計完成。",
  },
};

interface LogLine {
  text: string;
  tone: "info" | "ok" | "warn" | "bad";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ErhAuditLog({ useCase, locale }: { useCase: PublicServiceUseCase; locale: Locale }) {
  const t = copy[locale];
  const [lines, setLines] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);

  async function run() {
    const myRun = ++runId.current;
    setBusy(true);
    setLines([]);
    const push = (line: LogLine) => {
      if (runId.current === myRun) setLines((prev) => [...prev, line]);
    };

    // Kick off the real evaluation immediately; narrate while it resolves.
    const evalPromise = evaluateWithErh("/api/erh", useCase).catch((err: unknown) => err as Error);

    push({ text: t.boot, tone: "info" });
    await sleep(280);
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

    if (result instanceof Error) {
      push({ text: `ERH engine error: ${result.message}`, tone: "bad" });
    } else {
      const evaluation = result as ErhEvaluation;
      push({ text: t.verdict(evaluation.risk_score, evaluation.estimated_exponent), tone: "warn" });
      push({ text: t.primes(evaluation.num_primes, evaluation.num_samples), tone: "warn" });
      push({
        text: evaluation.erh_satisfied ? t.satisfied : t.violated,
        tone: evaluation.erh_satisfied ? "ok" : "bad",
      });
      push({ text: t.done, tone: "info" });
    }
    setBusy(false);
  }

  return (
    <section className="api-band card">
      <div className="api-header">
        <div>
          <p className="eyebrow">{t.eyebrow}</p>
          <h2>{t.title}</h2>
        </div>
      </div>
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
      <p className="api-empty erh-caption">{t.caption}</p>
    </section>
  );
}
