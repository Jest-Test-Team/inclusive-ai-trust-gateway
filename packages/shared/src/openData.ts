// Catalog of Taiwan open-data sources the gateway reasons about, with the
// concrete field fixes we recommend to the publishing agency and the bias that
// appears if the raw dataset is fed to an AI service unmodified. Records with a
// `datasetId` are fetched LIVE from data.gov.tw's M2M API (via /api/opendata/:id)
// so the real schema, provider, and update frequency are shown and the missing
// accessibility fields are computed from the actual columns; records without one
// are curated references. Each record maps to the scenario it powers.

import type { Locale } from "./i18n";

export interface OpenDataSource {
  id: string;
  scenarioId: string;
  /** Numeric data.gov.tw dataset id — when set, the panel fetches it live. */
  datasetId?: string;
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
  /**
   * Case-insensitive substrings that would indicate the equity column this
   * dataset should carry (language, accessibility, connectivity…). If a live
   * dataset's real schema contains none of these, the panel reports the gap as
   * a data-driven finding.
   */
  accessibilityTokens: string[];
  /** Human name of the column checked for, shown in the live gap finding. */
  gapLabel: Record<Locale, string>;
  /** What we publish back (feedback loop the hackathon rewards). */
  provision: Record<Locale, string>;
}

export const openDataSources: OpenDataSource[] = [
  {
    id: "ltc-institutions",
    scenarioId: "care-navigation",
    datasetId: "8572",
    name: {
      en: "National elderly-care facility registry",
      "zh-TW": "全國老人福利機構名冊",
    },
    agency: { en: "Ministry of Health and Welfare (SFAA)", "zh-TW": "衛生福利部社會及家庭署" },
    sourceUrl: "https://data.gov.tw/dataset/8572",
    format: "CSV",
    usedFor: {
      en: "Grounds the care-navigation assistant so it recommends real, licensed facilities near the citizen.",
      "zh-TW": "作為長照導引助理的依據，推薦民眾附近真實且立案的服務機構。",
    },
    biasNote: {
      en: "The live schema (機構名稱, 地址, 收容對象, 核定床數…) carries no language or accessibility column, so an AI silently skips facilities that serve minority-language or wheelchair users — excluding the people who most need care.",
      "zh-TW": "即時欄位（機構名稱、地址、收容對象、核定床數…）沒有語言或無障礙欄位，AI 會默默略過服務少數語言或輪椅使用者的機構，反而排除最需要照顧的族群。",
    },
    recommendedFields: {
      en: ["languages_supported[] (BCP-47 codes)", "wheelchair_access (bool)", "vacancy_status (enum)", "stable_facility_id"],
      "zh-TW": ["languages_supported[]（BCP-47 語言碼）", "wheelchair_access（布林值）", "vacancy_status（列舉）", "穩定機構識別碼"],
    },
    accessibilityTokens: ["language", "lang", "語言", "wheelchair", "accessible", "無障礙", "輪椅", "barrier"],
    gapLabel: { en: "accessibility / language", "zh-TW": "無障礙／語言" },
    provision: {
      en: "We publish a normalized copy with structured accessibility tags plus a data-quality report flagging rows missing them.",
      "zh-TW": "我們回饋一份標準化副本，補上結構化無障礙標籤，並附上標示缺漏欄位的資料品質報告。",
    },
  },
  {
    id: "ltc-abc-sites",
    scenarioId: "care-navigation",
    datasetId: "88270",
    name: {
      en: "Long-term care ABC service sites",
      "zh-TW": "長照 ABC 據點",
    },
    agency: { en: "Ministry of Health and Welfare", "zh-TW": "衛生福利部" },
    sourceUrl: "https://data.gov.tw/dataset/88270",
    format: "CSV",
    usedFor: {
      en: "Lets the care assistant recommend nearby A/B/C contracted sites with coordinates and service types.",
      "zh-TW": "讓照護助理依座標與服務類型，推薦附近長照 2.0 A/B/C 特約據點。",
    },
    biasNote: {
      en: "The live schema has GIS and contract fields but no wheelchair-access or languages-supported column, so an AI can route someone to a site they cannot physically enter or understand.",
      "zh-TW": "即時欄位有 GIS 與特約資訊，卻無輪椅可及或支援語言欄位，AI 可能引導民眾到進不去或聽不懂的據點。",
    },
    recommendedFields: {
      en: ["wheelchair_access (bool)", "languages_supported[]", "step_free_entrance (bool)", "appointment_required (bool)"],
      "zh-TW": ["wheelchair_access（布林值）", "languages_supported[]", "無障礙出入口（布林值）", "是否需預約（布林值）"],
    },
    accessibilityTokens: ["wheelchair", "輪椅", "無障礙", "language", "語言", "accessible"],
    gapLabel: { en: "accessibility / language", "zh-TW": "無障礙／語言" },
    provision: {
      en: "We publish an accessibility-enriched ABC directory overlay and flag sites missing equity fields.",
      "zh-TW": "我們回饋補上無障礙標籤的 ABC 據點疊圖，並標示缺漏平權欄位的據點。",
    },
  },
  {
    id: "disability-institutions",
    scenarioId: "care-navigation",
    datasetId: "12061",
    name: {
      en: "National disability welfare institutions directory",
      "zh-TW": "全國身心障礙福利機構一覽表",
    },
    agency: { en: "Ministry of Health and Welfare (SFAA)", "zh-TW": "衛生福利部社會及家庭署" },
    sourceUrl: "https://data.gov.tw/dataset/12061",
    format: "CSV",
    usedFor: {
      en: "Expands care matching beyond elderly facilities to disability day/residential services.",
      "zh-TW": "把照護媒合從老人機構擴到身心障礙日間／住宿服務。",
    },
    biasNote: {
      en: "Capacity and evaluation grades exist, but no language or transport-access fields — minority-language and rural users are invisible in matching.",
      "zh-TW": "雖有服務人數與評鑑等第，卻無語言或交通可及欄位，少數語言與偏鄉使用者在媒合中被隱形。",
    },
    recommendedFields: {
      en: ["languages_supported[]", "wheelchair_access (bool)", "public_transit_notes", "waitlist_status"],
      "zh-TW": ["languages_supported[]", "wheelchair_access（布林值）", "大眾運輸說明", "候補狀態"],
    },
    accessibilityTokens: ["wheelchair", "輪椅", "無障礙", "language", "語言", "accessible"],
    gapLabel: { en: "accessibility / language", "zh-TW": "無障礙／語言" },
    provision: {
      en: "We return a merged care+disability catalog with equity tags for referral engines.",
      "zh-TW": "我們回饋合併後的照護＋身障機構名冊，並附平權標籤供轉介引擎使用。",
    },
  },
  {
    id: "accessible-facilities",
    scenarioId: "care-navigation",
    datasetId: "128416",
    name: {
      en: "Taipei MRT station accessibility facilities",
      "zh-TW": "臺北捷運車站無障礙設施資料",
    },
    agency: { en: "Taipei Rapid Transit Corp.", "zh-TW": "臺北大眾捷運股份有限公司" },
    sourceUrl: "https://data.gov.tw/dataset/128416",
    format: "CSV",
    usedFor: {
      en: "Lets the assistant answer whether a station is step-free, has disabled toilets, and wheelchair-reserved spaces.",
      "zh-TW": "讓助理能回答某車站是否無障礙、有無障礙廁所與輪椅保留空間。",
    },
    biasNote: {
      en: "The schema is rich on physical accessibility (elevators, wheelchair spaces) but has no language / multilingual field, and covers Taipei metro only — an AI treating it as nationwide tells a rural or non-Mandarin user 'no accessible option' that simply isn't recorded.",
      "zh-TW": "欄位對實體無障礙（電梯、輪椅空間）著墨甚多，卻無語言／多語欄位，且僅涵蓋臺北捷運 — AI 若當成全國資料，會對偏鄉或非華語使用者回答「沒有無障礙選項」，實則只是未登錄。",
    },
    recommendedFields: {
      en: ["languages_supported[] (signage/announcements)", "coverage_region", "survey_date", "step_free_verified_by"],
      "zh-TW": ["languages_supported[]（標示／廣播語言）", "涵蓋區域", "調查日期", "無障礙查核單位"],
    },
    // Avoid short substring "lang" (false-positives inside unrelated English words).
    accessibilityTokens: ["language", "languages", "語言", "多語", "multilingual", "英語", "english", "bilingual"],
    gapLabel: { en: "language / multilingual", "zh-TW": "語言／多語" },
    provision: {
      en: "We contribute a coverage-region tag and a language-of-service field so downstream models know where 'no data' ≠ 'no access'.",
      "zh-TW": "我們補上涵蓋區域標籤與服務語言欄位，讓下游模型分辨「沒有資料」不等於「沒有無障礙」。",
    },
  },
  {
    id: "shelter-points",
    scenarioId: "disaster-access",
    datasetId: "73242",
    name: {
      en: "Evacuation shelter location file",
      "zh-TW": "避難收容處所點位檔",
    },
    agency: { en: "National Fire Agency", "zh-TW": "內政部消防署" },
    sourceUrl: "https://data.gov.tw/dataset/73242",
    format: "CSV",
    usedFor: {
      en: "Feeds the disaster-access assistant with shelter locations, capacity, and applicable hazard types.",
      "zh-TW": "為災害協助助理提供避難處所位置、收容人數與適用災害類別。",
    },
    biasNote: {
      en: "Capacity and coordinates are present, and there is a coarse 'suitable for vulnerable evacuees' flag, but no wheelchair / step-free column — an AI still cannot tell which shelters a wheelchair user can actually enter.",
      "zh-TW": "雖有收容人數、座標與「適合避難弱者安置」，但仍無輪椅／無障礙明確欄位，AI 無法判斷輪椅使用者能否實際進入該避難所。",
    },
    recommendedFields: {
      en: ["wheelchair_accessible (bool)", "languages_supported[]", "medical_support_onsite (bool)", "valid_from/until"],
      "zh-TW": ["wheelchair_accessible（布林值）", "languages_supported[]", "現場醫療支援（布林值）", "生效／截止時間"],
    },
    accessibilityTokens: ["wheelchair", "輪椅", "無障礙", "accessible", "ramp", "坡道", "step-free", "step_free"],
    gapLabel: { en: "wheelchair / step-free access", "zh-TW": "輪椅／無障礙" },
    provision: {
      en: "We publish an accessibility-tagged shelter overlay and a multilingual shelter-name variant for high-severity events.",
      "zh-TW": "我們回饋標註無障礙的避難所疊圖，並為高嚴重度事件提供多語避難所名稱版本。",
    },
  },
  {
    id: "digital-tutoring",
    scenarioId: "education-access",
    datasetId: "31855",
    name: {
      en: "Digital Companion partner-school matching list",
      "zh-TW": "數位學伴計畫夥伴學校媒合清單",
    },
    agency: { en: "Ministry of Education", "zh-TW": "教育部" },
    sourceUrl: "https://data.gov.tw/dataset/31855",
    format: "CSV",
    usedFor: {
      en: "Helps the education assistant see which rural schools are matched to online tutoring and how many students are covered.",
      "zh-TW": "協助教育助理掌握哪些偏鄉學校已媒合線上課輔，以及涵蓋學童人數。",
    },
    biasNote: {
      en: "The list records matched schools and student counts but nothing on connectivity or devices, so an AI recommending 'online tutoring' assumes every listed child can actually get online — the exact digital-divide it is meant to close.",
      "zh-TW": "清單記錄了媒合學校與學童人數，卻沒有連網或載具資訊，AI 推薦「線上課輔」時會假設每位學童都能上網 — 正是它想弭平的數位落差。",
    },
    recommendedFields: {
      en: ["device_access_rate", "broadband_mbps_median", "home_connectivity_flag", "support_service_languages[]"],
      "zh-TW": ["載具普及率", "寬頻中位速率（Mbps）", "居家連網標記", "支援服務語言[]"],
    },
    accessibilityTokens: ["broadband", "寬頻", "device", "載具", "network", "網路", "連網", "language", "語言"],
    gapLabel: { en: "connectivity / device", "zh-TW": "連網／載具" },
    provision: {
      en: "We publish a township-level connectivity-equity index derived from the list plus the ERH fairness score per region.",
      "zh-TW": "我們回饋以此清單推導的鄉鎮級連網平權指數，並附上各地區的 ERH 公平性分數。",
    },
  },
  {
    id: "rural-broadband-subsidy",
    scenarioId: "education-access",
    datasetId: "161777",
    name: {
      en: "Rural broadband infrastructure subsidy progress",
      "zh-TW": "普及偏鄉寬頻接取基礎建設計畫補助辦理情形",
    },
    agency: { en: "National Communications Commission / MOTC lineage", "zh-TW": "數位發展部／相關電信主管機關" },
    sourceUrl: "https://data.gov.tw/dataset/161777",
    format: "CSV",
    usedFor: {
      en: "Grounds education-access audits with where rural broadband build-out funding actually landed.",
      "zh-TW": "以偏鄉寬頻建設補助實際落地處，佐證學習近用稽核。",
    },
    biasNote: {
      en: "County/township subsidy rows exist, but no household device rate or median Mbps — an AI may treat 'subsidized township' as 'students can learn online'.",
      "zh-TW": "雖有縣市／鄉鎮補助列，卻無家戶載具率或中位 Mbps，AI 可能把「有補助的鄉鎮」當成「學生都能線上學習」。",
    },
    recommendedFields: {
      en: ["median_mbps", "device_access_rate", "school_coverage_flag", "languages_of_support[]"],
      "zh-TW": ["中位 Mbps", "載具普及率", "校園涵蓋標記", "支援服務語言[]"],
    },
    accessibilityTokens: ["broadband", "寬頻", "mbps", "device", "載具", "連網", "網路"],
    gapLabel: { en: "connectivity / device", "zh-TW": "連網／載具" },
    provision: {
      en: "We join subsidy geography to school matching lists and publish a connectivity-gap layer for auditors.",
      "zh-TW": "我們把補助地理與學伴媒合名單接合，並發布連網缺口圖層供稽核使用。",
    },
  },
  {
    id: "universal-service-villages",
    scenarioId: "education-access",
    datasetId: "157735",
    name: {
      en: "Universal-service villages for data connectivity",
      "zh-TW": "電信普及服務數據通信特定村里",
    },
    agency: { en: "Telecom universal-service program", "zh-TW": "電信普及服務計畫" },
    sourceUrl: "https://data.gov.tw/dataset/157735",
    format: "CSV",
    usedFor: {
      en: "Identifies designated villages still needing data-connectivity universal service — critical for rural student personas.",
      "zh-TW": "標示仍需數據通信普及服務的指定村里，對偏鄉學生人物誌至關重要。",
    },
    biasNote: {
      en: "Village designation and technology type are listed, but not student device sharing or after-school bandwidth — tutoring AIs overestimate reach.",
      "zh-TW": "雖有村里指定與通訊技術，卻無學生共用裝置或課後頻寬資訊，課輔 AI 會高估可及範圍。",
    },
    recommendedFields: {
      en: ["student_device_share_rate", "after_hours_bandwidth", "school_id_linkage", "support_languages[]"],
      "zh-TW": ["學生共用裝置率", "課後可用頻寬", "學校代碼串接", "支援語言[]"],
    },
    accessibilityTokens: ["broadband", "寬頻", "device", "載具", "連網", "網路", "通訊"],
    gapLabel: { en: "connectivity / device", "zh-TW": "連網／載具" },
    provision: {
      en: "We publish a village↔school join table with equity flags for education AI pilots.",
      "zh-TW": "我們回饋村里↔學校對照表，並附平權標記供教育 AI 試點使用。",
    },
  },
];

export function getOpenDataSources(scenarioId?: string): OpenDataSource[] {
  if (!scenarioId) return openDataSources;
  return openDataSources.filter((s) => s.scenarioId === scenarioId);
}
