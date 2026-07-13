// Curated catalog of Taiwan open-data sources the gateway reasons about, with
// the concrete field fixes we recommend to the publishing agency and the bias
// that appears if the raw dataset is fed to an AI service unmodified. This is a
// hand-verified catalog (not a live data.gov.tw fetch); each record maps to the
// public-service scenario it powers in sampleData.ts.

import type { Locale } from "./i18n";

export interface OpenDataSource {
  id: string;
  scenarioId: string;
  /** Dataset title as published. */
  name: Record<Locale, string>;
  agency: Record<Locale, string>;
  /** data.gov.tw dataset landing page. */
  sourceUrl: string;
  format: string;
  /** How the gateway uses it today. */
  usedFor: Record<Locale, string>;
  /** Bias introduced if fed to an AI service without the fixes below. */
  biasNote: Record<Locale, string>;
  /** Machine-readable fields we ask the agency to add. */
  recommendedFields: Record<Locale, string[]>;
  /** What we publish back (feedback loop the hackathon rewards). */
  provision: Record<Locale, string>;
}

export const openDataSources: OpenDataSource[] = [
  {
    id: "ltc-institutions",
    scenarioId: "care-navigation",
    name: {
      en: "Long-term care institution registry",
      "zh-TW": "長期照顧服務機構名冊",
    },
    agency: { en: "Ministry of Health and Welfare", "zh-TW": "衛生福利部" },
    sourceUrl: "https://data.gov.tw/dataset/6183",
    format: "CSV / JSON",
    usedFor: {
      en: "Grounds the care-navigation assistant so it recommends real, licensed facilities near the citizen.",
      "zh-TW": "作為長照導引助理的依據，推薦民眾附近真實且立案的服務機構。",
    },
    biasNote: {
      en: "Language and accessibility support are free-text or absent, so an AI silently skips facilities that serve minority-language or wheelchair users — excluding the people who most need care.",
      "zh-TW": "語言與無障礙支援為自由文字或缺漏，AI 會默默略過服務少數語言或輪椅使用者的機構，反而排除最需要照顧的族群。",
    },
    recommendedFields: {
      en: ["languages_supported[] (BCP-47 codes)", "wheelchair_access (bool)", "vacancy_status (enum)", "stable_facility_id"],
      "zh-TW": ["languages_supported[]（BCP-47 語言碼）", "wheelchair_access（布林值）", "vacancy_status（列舉）", "穩定機構識別碼"],
    },
    provision: {
      en: "We publish a normalized copy with structured accessibility tags plus a data-quality report flagging rows missing them.",
      "zh-TW": "我們回饋一份標準化副本，補上結構化無障礙標籤，並附上標示缺漏欄位的資料品質報告。",
    },
  },
  {
    id: "accessible-facilities",
    scenarioId: "care-navigation",
    name: {
      en: "Accessible facilities map",
      "zh-TW": "無障礙設施地圖",
    },
    agency: { en: "Ministry of the Interior", "zh-TW": "內政部" },
    sourceUrl: "https://data.gov.tw/dataset/33427",
    format: "CSV / WMTS",
    usedFor: {
      en: "Lets the assistant answer whether a route or venue is wheelchair- and guide-dog-accessible.",
      "zh-TW": "讓助理能回答某路線或場所是否適合輪椅與導盲犬通行。",
    },
    biasNote: {
      en: "Coverage skews to urban districts; an AI trained on it will confidently claim rural areas have no accessible options when they are simply unrecorded.",
      "zh-TW": "資料偏重都會區；以此訓練的 AI 會武斷地宣稱偏鄉沒有無障礙選項，實際上只是未被登錄。",
    },
    recommendedFields: {
      en: ["survey_date", "coverage_confidence", "accessibility_type (ramp/lift/tactile)", "last_verified_by"],
      "zh-TW": ["調查日期", "涵蓋信心度", "無障礙類型（坡道／電梯／導盲磚）", "最後查核單位"],
    },
    provision: {
      en: "We contribute a coverage-gap overlay so downstream models know where 'no data' ≠ 'no access'.",
      "zh-TW": "我們提供涵蓋缺口疊圖，讓下游模型分辨「沒有資料」不等於「沒有無障礙」。",
    },
  },
  {
    id: "cap-alerts",
    scenarioId: "disaster-access",
    name: {
      en: "Disaster prevention alerts (CAP)",
      "zh-TW": "災防告警訊息（CAP）",
    },
    agency: { en: "National Fire Agency", "zh-TW": "內政部消防署" },
    sourceUrl: "https://data.gov.tw/dataset/73242",
    format: "CAP 1.2 XML",
    usedFor: {
      en: "Feeds the disaster-access assistant with live hazard alerts and shelter directions.",
      "zh-TW": "為災害協助助理提供即時災害告警與避難指引。",
    },
    biasNote: {
      en: "Alerts ship in Mandarin only; an AI relaying them verbatim leaves migrant and Indigenous-language communities without evacuation instructions during the exact window that matters.",
      "zh-TW": "告警僅有中文；AI 若原文轉述，會讓移工與原住民語族群在最關鍵的疏散時刻收不到指示。",
    },
    recommendedFields: {
      en: ["message_translations[] (per-locale)", "severity (CAP enum)", "accessible_shelter_ids[]", "valid_until (ISO-8601)"],
      "zh-TW": ["message_translations[]（各語系）", "severity（CAP 列舉）", "accessible_shelter_ids[]", "valid_until（ISO-8601）"],
    },
    provision: {
      en: "We publish machine-translated multilingual alert variants with a human-review flag for high-severity events.",
      "zh-TW": "我們回饋多語系機器翻譯告警版本，並對高嚴重度事件加註人工複核標記。",
    },
  },
  {
    id: "education-resources",
    scenarioId: "education-access",
    name: {
      en: "Education resource distribution",
      "zh-TW": "教育資源分佈",
    },
    agency: { en: "Ministry of Education", "zh-TW": "教育部" },
    sourceUrl: "https://data.gov.tw/dataset/6297",
    format: "CSV / JSON",
    usedFor: {
      en: "Helps the education assistant route students to broadband, devices, and tutoring support.",
      "zh-TW": "協助教育助理將學生導引至寬頻、載具與課輔資源。",
    },
    biasNote: {
      en: "Broadband and device availability are reported at county level, so an AI recommending 'online learning' overlooks rural townships and low-income households inside well-served counties.",
      "zh-TW": "寬頻與載具資料以縣市為單位，AI 推薦「線上學習」時會忽略資源充足縣市內的偏鄉與低收入家庭。",
    },
    recommendedFields: {
      en: ["township_granularity", "device_access_rate", "broadband_mbps_median", "support_service_languages[]"],
      "zh-TW": ["鄉鎮級粒度", "載具普及率", "寬頻中位速率（Mbps）", "支援服務語言[]"],
    },
    provision: {
      en: "We publish a township-level equity index derived from the dataset plus the ERH fairness score per region.",
      "zh-TW": "我們回饋以此資料推導的鄉鎮級平權指數，並附上各地區的 ERH 公平性分數。",
    },
  },
];

export function getOpenDataSources(scenarioId?: string): OpenDataSource[] {
  if (!scenarioId) return openDataSources;
  return openDataSources.filter((s) => s.scenarioId === scenarioId);
}
