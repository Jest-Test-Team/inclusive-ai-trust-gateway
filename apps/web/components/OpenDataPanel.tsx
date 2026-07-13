"use client";

// Open-data module: for each curated Taiwan dataset the gateway reasons about,
// shows what it is used for, the bias it introduces if fed to an AI raw, the
// machine-readable field fixes we recommend to the agency, and what we publish
// back. Datasets powering the currently selected scenario are highlighted.

import { getOpenDataSources, type Locale, type OpenDataSource } from "@iatg/shared";

const copy: Record<Locale, {
  eyebrow: string;
  title: string;
  intro: string;
  usedFor: string;
  bias: string;
  recommend: string;
  provision: string;
  powers: string;
  view: string;
}> = {
  en: {
    eyebrow: "Open data",
    title: "Sources, bias findings & feedback to publishers",
    intro:
      "Every dataset below is a real Taiwan open-data source. For each one the gateway flags the bias that appears if an AI consumes it unmodified, and proposes concrete machine-readable fields for the publishing agency.",
    usedFor: "Used for",
    bias: "Bias if fed to AI raw",
    recommend: "Recommended fields to add",
    provision: "What we publish back",
    powers: "Powers this scenario",
    view: "data.gov.tw",
  },
  "zh-TW": {
    eyebrow: "開放資料",
    title: "資料來源、偏差發現與對資料機關的回饋",
    intro:
      "以下每個資料集皆為真實的台灣開放資料。閘道會標示 AI 若直接使用會產生的偏差，並向資料機關提出具體、機器可讀的欄位建議。",
    usedFor: "用途",
    bias: "直接餵給 AI 的偏差",
    recommend: "建議新增欄位",
    provision: "我們回饋的內容",
    powers: "支援此情境",
    view: "data.gov.tw",
  },
};

export function OpenDataPanel({ locale, scenarioId }: { locale: Locale; scenarioId: string }) {
  const t = copy[locale];
  const sources = getOpenDataSources();

  return (
    <section className="section" id="open-data">
      <div className="section-head">
        <p className="eyebrow">{t.eyebrow}</p>
        <h2>{t.title}</h2>
        <p>{t.intro}</p>
      </div>
      <div className="opendata-grid">
        {sources.map((src) => (
          <SourceCard key={src.id} src={src} locale={locale} t={t} active={src.scenarioId === scenarioId} />
        ))}
      </div>
    </section>
  );
}

function SourceCard({
  src,
  locale,
  t,
  active,
}: {
  src: OpenDataSource;
  locale: Locale;
  t: (typeof copy)["en"];
  active: boolean;
}) {
  return (
    <article className={`opendata-card card ${active ? "opendata-active" : ""}`}>
      <div className="opendata-head">
        <div>
          <h3>{src.name[locale]}</h3>
          <p className="opendata-agency">
            {src.agency[locale]} · {src.format}
          </p>
        </div>
        <a href={src.sourceUrl} target="_blank" rel="noreferrer" className="opendata-link">
          {t.view} ↗
        </a>
      </div>
      {active && <span className="opendata-flag">{t.powers}</span>}

      <dl className="opendata-dl">
        <dt>{t.usedFor}</dt>
        <dd>{src.usedFor[locale]}</dd>
        <dt className="opendata-bias-dt">{t.bias}</dt>
        <dd className="opendata-bias">{src.biasNote[locale]}</dd>
        <dt>{t.recommend}</dt>
        <dd>
          <ul className="opendata-fields">
            {src.recommendedFields[locale].map((f) => (
              <li key={f}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </dd>
        <dt className="opendata-give-dt">{t.provision}</dt>
        <dd>{src.provision[locale]}</dd>
      </dl>
    </article>
  );
}
