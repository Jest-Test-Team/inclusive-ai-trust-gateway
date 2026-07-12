// Traditional Chinese (zh-TW) localization of the demo content: use cases,
// personas, SDG priority list, purpose cards, and the generated assessment
// strings. English data stays the single structural source of truth; the
// zh-TW variants mirror it id-for-id so scoring is locale-independent.

import { safetySignals, useCases } from "./sampleData";
import { sdgPriorities } from "./sdgPriorities";
import type { AgentSafetySignal, PublicServiceUseCase, SdgPriority, TrustAssessment } from "./types";

export type Locale = "en" | "zh-TW";

const useCasesZh: PublicServiceUseCase[] = [
  {
    ...useCases[0],
    name: "共融照護導航",
    summary: "以 AI 協助長者、照顧者與身心障礙者取得合適的照護服務。",
    targetUsers: ["長者", "家庭照顧者", "身心障礙者", "在地照護個管員"],
    openDataSources: ["公共照護服務名錄", "無障礙交通資料", "區域人口統計指標"],
    aiCapabilities: ["白話文服務媒合", "多語問答", "風險意識轉介摘要"],
    safeguards: ["高風險轉介需人工審核", "每個管道皆做無障礙檢查", "個資最小化"],
    personas: [
      {
        ...useCases[0].personas[0],
        label: "偏鄉長者",
        ageGroup: "65 歲以上",
        region: "偏鄉",
        needs: ["語音優先引導", "交通接送支援", "照護資格判定"],
        barriers: ["數位素養不足", "寬頻涵蓋有限", "表單複雜"],
      },
      {
        ...useCases[0].personas[1],
        label: "上班族照顧者",
        ageGroup: "35-54 歲",
        region: "都會",
        needs: ["下班後也能使用", "福利方案比較", "個案交接"],
        barriers: ["時間受限", "機關各自為政", "下一步不明確"],
      },
    ],
  },
  {
    ...useCases[1],
    name: "無障礙災防支援",
    summary: "以 AI 分流與多語指引協助撤離、收容、物資與復原服務。",
    targetUsers: ["災害高風險區居民", "行動不便者", "移民社群", "在地救災人員"],
    openDataSources: ["氣象警報", "收容所容量資料", "交通中斷資訊", "公開災害潛勢圖"],
    aiCapabilities: ["在地化警報摘要", "資源媒合", "代理協作的救災流程"],
    safeguards: ["回應必須有資料來源", "重大警報升級處理", "代理工具外流管制"],
    personas: [
      {
        ...useCases[1].personas[0],
        label: "行動不便的居民",
        ageGroup: "全年齡",
        region: "沿海",
        needs: ["無障礙撤離路線", "收容所無障礙資訊", "照護物資"],
        barriers: ["資訊變動快", "交通斷點", "與照顧者失散"],
      },
      {
        ...useCases[1].personas[1],
        label: "新住民社群成員",
        ageGroup: "18-64 歲",
        region: "都會",
        needs: ["翻譯後的指示", "可信來源連結", "專線轉接"],
        barriers: ["語言隔閡", "易受謠言影響", "不熟悉政府機關"],
      },
    ],
  },
  {
    ...useCases[2],
    name: "AI 學習近用稽核",
    summary: "稽核 AI 家教與校園支援工具，確保不同需求與地區的學生都能公平使用。",
    targetUsers: ["學生", "教師", "特教個管員", "偏鄉學校"],
    openDataSources: ["校園寬頻涵蓋資料", "公開課綱標準", "輔助科技指引"],
    aiCapabilities: ["學習支援品質檢查", "偏誤與調整需求審查", "給教師的風險摘要"],
    safeguards: ["符合年齡的資料界線", "教師可覆核", "偏誤漂移監測"],
    personas: [
      {
        ...useCases[2].personas[0],
        label: "偏鄉學生",
        ageGroup: "13-18 歲",
        region: "偏鄉",
        needs: ["可離線使用", "低頻寬模式", "可升級請教師協助"],
        barriers: ["共用裝置", "網路不穩", "在地家教資源少"],
      },
      {
        ...useCases[2].personas[1],
        label: "需要學習調整的學生",
        ageGroup: "6-18 歲",
        region: "混合",
        needs: ["支援螢幕閱讀器", "白話文回饋", "個人化進度"],
        barriers: ["格式障礙", "評量偏誤", "隱私疑慮"],
      },
    ],
  },
];

const safetySignalsZh: AgentSafetySignal[] = [
  { ...safetySignals[0], control: "提示注入軌跡監測", description: "跨整個對話偵測意圖漂移，而非只看單一提示。" },
  { ...safetySignals[1], control: "工具呼叫政策管制", description: "阻擋不安全的呼叫鏈，例如未授權讀取後對外傳送。" },
  { ...safetySignals[2], control: "會話層級圍堵", description: "撤銷高風險會話並隔離代理執行；正式環境連接器仍在規劃。" },
  { ...safetySignals[3], control: "開放資料溯源檢查", description: "追蹤來源引用，在面向民眾輸出前標記無依據的回應。" },
];

const sdgZh: Record<string, Pick<SdgPriority, "name" | "repoCanDo" | "proofPath" | "implementation">> = {
  "SDG 10": {
    name: "減少不平等",
    repoCanDo: "稽核公共 AI 服務是否因年齡、障礙、語言、地域或數位落差而排除特定族群。",
    proofPath: "REST/Connect 評估、ERH 後備評分與人物誌障礙資料",
    implementation: ["包容性分數", "公平風險等級", "人物誌缺口", "建議緩解措施"],
  },
  "SDG 16": {
    name: "和平正義與健全制度",
    repoCanDo: "為政府 AI 決策與代理安全管控建立可稽核、API 佐證的信任證據。",
    proofPath: "OpenAPI 文件、API 金鑰保護的閘道、ADM 安全事件、Webhook 簽章",
    implementation: ["Swagger/OpenAPI", "ADM 事件接收", "WebSocket 證據串流", "API 金鑰保護"],
  },
  "SDG 9": {
    name: "產業創新與基礎建設",
    repoCanDo: "提供跨 REST、GraphQL、WebSocket、Connect-RPC、MCP、MQTT 與 UCP 的可重用 AI 信任基礎設施。",
    proofPath: "七種協定介接同一個 CQRS 信任核心",
    implementation: ["共用閘道客戶端", "多服務 Back4App 部署根", "Connect-RPC 方法", "MCP 工具"],
  },
  "SDG 11": {
    name: "永續城市與社區",
    repoCanDo: "評估照護導航、災防支援與無障礙運輸等城市服務是否共融交付。",
    proofPath: "照護與災防情境對應開放資料與弱勢人物誌",
    implementation: ["服務情境儀表板", "開放資料整備度", "災防近用情境", "照護導航情境"],
  },
  "SDG 3": {
    name: "健康與福祉",
    repoCanDo: "檢查照護型 AI 的無障礙性、安全轉介與代理代購風險。",
    proofPath: "照護導航情境與 UCP 照護商品信任把關",
    implementation: ["照護人物誌", "UCP 結帳公平把關", "人工審核防護"],
  },
  "SDG 4": {
    name: "優質教育",
    repoCanDo: "稽核 AI 學習工具的近用缺口、調整需求、教師覆核與地區基礎建設障礙。",
    proofPath: "學習近用稽核情境",
    implementation: ["教育情境", "學習調整人物誌", "偏誤漂移防護"],
  },
  "SDG 17": {
    name: "夥伴關係",
    repoCanDo: "提供共通信任 API，讓機關、公民夥伴與 AI 代理不必共享原始敏感資料即可介接。",
    proofPath: "OpenAPI、GraphQL 讀取模型、MCP 工具與共用客戶端套件",
    implementation: ["Swagger 頁面", "GraphQL 評估查詢", "MCP 列表／評估工具", "共用 TypeScript 客戶端"],
  },
  "SDG 12": {
    name: "責任消費與生產",
    repoCanDo: "對代理代購與採購流程把關，阻擋哄抬價格與不無障礙的商品描述。",
    proofPath: "UCP 商務模組",
    implementation: ["UCP 會話", "商品目錄探索", "結帳意圖信任判定"],
  },
};

export function getUseCases(locale: Locale): PublicServiceUseCase[] {
  return locale === "zh-TW" ? useCasesZh : useCases;
}

export function getSafetySignals(locale: Locale): AgentSafetySignal[] {
  return locale === "zh-TW" ? safetySignalsZh : safetySignals;
}

export function getSdgPriorities(locale: Locale): SdgPriority[] {
  if (locale !== "zh-TW") return sdgPriorities;
  return sdgPriorities.map((item) => ({ ...item, ...(sdgZh[item.sdg] ?? {}) }));
}

/**
 * Translates the template strings scoring.ts generates. Structure-preserving:
 * numbers are re-extracted from the English strings.
 */
export function localizeAssessment(assessment: TrustAssessment, locale: Locale): TrustAssessment {
  if (locale !== "zh-TW") return assessment;
  return {
    ...assessment,
    strengths: assessment.strengths.map(localizeGenerated),
    gaps: assessment.gaps.map(localizeGenerated),
    nextSteps: assessment.nextSteps.map(localizeGenerated),
  };
}

const generatedZh: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^(\d+) inclusion personas modeled$/, (m) => `已建模 ${m[1]} 組包容性人物誌`],
  [/^(\d+) open-data source categories identified$/, (m) => `已盤點 ${m[1]} 類開放資料來源`],
  [/^(\d+) ADM controls ready for integration$/, (m) => `${m[1]} 項 ADM 管控已可介接`],
  [/^Replace local scoring with ERH engine API results$/, () => "以 ERH 引擎 API 結果取代本機評分"],
  [/^Add field validation data from real public-service pilots$/, () => "加入真實公共服務試辦的實地驗證資料"],
  [/^Publish an open data dictionary for repeatable audits$/, () => "發布開放資料字典，讓稽核可重複執行"],
  [/^Connect ERH fairness and ethical-degree scoring$/, () => "串接 ERH 公平性與倫理程度評分"],
  [/^Connect ADM prompt-injection and tool-chain telemetry$/, () => "串接 ADM 提示注入與工具鏈遙測"],
  [/^Run a pilot with a care, education, or disaster-response partner$/, () => "與照護、教育或災防夥伴進行試辦"],
];

function localizeGenerated(text: string): string {
  for (const [pattern, translate] of generatedZh) {
    const match = text.match(pattern);
    if (match) return translate(match);
  }
  return text;
}
