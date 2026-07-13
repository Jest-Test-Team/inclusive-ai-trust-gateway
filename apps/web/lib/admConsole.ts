// Live ADM Battle Console client, ported from the standalone
// Agentic-Defense-Matrix dashboard. The analysis API (Rust/axum) and gateway
// are real HTTP services; this talks to them directly from the browser (they
// are CORS-enabled). Endpoints resolve at runtime so the same build can point
// at any deployment:
//   NEXT_PUBLIC_ADM_ANALYSIS_URL / NEXT_PUBLIC_ADM_GATEWAY_URL  (build-time)
//   ?api=https://host&gw=https://host                           (runtime + localStorage)

const DEFAULT_ANALYSIS =
  process.env.NEXT_PUBLIC_ADM_ANALYSIS_URL || "https://api.dennisleehappy.org";
const DEFAULT_GATEWAY =
  process.env.NEXT_PUBLIC_ADM_GATEWAY_URL || "https://api.dennisleehappy.org";

export interface ApiConfig {
  analysis: string;
  gateway: string;
}

export function getConfig(): ApiConfig {
  if (typeof window === "undefined") {
    return { analysis: DEFAULT_ANALYSIS, gateway: DEFAULT_GATEWAY };
  }
  const q = new URLSearchParams(window.location.search);
  const analysis = q.get("api") || window.localStorage.getItem("adm_api") || DEFAULT_ANALYSIS;
  const gateway = q.get("gw") || window.localStorage.getItem("adm_gw") || DEFAULT_GATEWAY;
  if (q.get("api")) window.localStorage.setItem("adm_api", q.get("api")!);
  if (q.get("gw")) window.localStorage.setItem("adm_gw", q.get("gw")!);
  return { analysis: analysis.replace(/\/$/, ""), gateway: gateway.replace(/\/$/, "") };
}

export function setConfig(analysis: string, gateway: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("adm_api", analysis);
  window.localStorage.setItem("adm_gw", gateway);
}

export interface TechniqueStat {
  technique: string;
  blocked: number;
  landed: number;
}

export interface Stats {
  attacks: number;
  blocked: number;
  landed: number;
  detected: number;
  remediations: number;
  residual_risk: number;
  block_rate: number;
  landing_rate: number;
  detection_rate: number;
  mttr_seconds: number | null;
  elastic_enabled: boolean;
  by_technique: TechniqueStat[];
}

export interface SessionRow {
  session_id: string;
  technique: string;
  variant: string;
  target: string;
  severity: number;
  attack_ts: string;
  attack_outcome: string;
  remediation_ts: string | null;
  remediation_outcome: string | null;
  mttr_seconds: number | null;
}

export interface SystemService {
  name: string;
  tech: string;
  category: string;
  detail: string;
  status: "up" | "down" | "disabled";
  hint?: string | null;
}

export interface LlmProvider {
  role: "primary" | "fallback";
  name: string;
  status: "up" | "down" | "unconfigured";
  active: boolean;
}

export interface LlmStatus {
  active: "primary" | "fallback" | "none";
  providers: LlmProvider[];
}

export interface BattleEvent {
  id?: string;
  ts?: string;
  team: string;
  kind: string;
  technique?: string;
  variant?: string;
  session_id?: string;
  target?: string;
  outcome?: string;
  severity?: number;
  latency_ms?: number;
  detail?: string;
  labels?: Record<string, string>;
}

const TIMEOUT = 6000;

async function getJSON<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function probe(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const admApi = {
  stats: (c: ApiConfig) => getJSON<Stats>(`${c.analysis}/api/stats`),
  system: (c: ApiConfig) => getJSON<{ services: SystemService[] }>(`${c.analysis}/api/system`),
  llm: (c: ApiConfig) => getJSON<LlmStatus>(`${c.analysis}/api/llm`),
  timeline: (c: ApiConfig, limit = 40) =>
    getJSON<{ sessions: SessionRow[] }>(`${c.analysis}/api/timeline?limit=${limit}`),
  gatewayHealth: (c: ApiConfig) => probe(`${c.gateway}/v1/health`),
};

// Static red-team catalog (attack id → human name + technique), used for the
// matrix table and to expand technique ids in the live feed.
export const RED_TEAM_ATTACKS = [
  { id: "RT-001", attack: "Prompt Injection", technique: "Indirect injection via RAG context" },
  { id: "RT-002", attack: "Tool Chaining", technique: "read_secret → external_send chain" },
  { id: "RT-003", attack: "RAG Poisoning", technique: "Inject malicious URLs into knowledge base" },
  { id: "RT-004", attack: "Reverse Shell", technique: "bash -i >& /dev/tcp/... via tool call" },
  { id: "RT-005", attack: "Confused Deputy", technique: "Trick agent into privilege escalation" },
  { id: "RT-006", attack: "Token Theft", technique: "Replay captured JWT" },
  { id: "RT-007", attack: "Egress Exfiltration", technique: "DNS tunnel / HTTP POST to external" },
  { id: "RT-008", attack: "Container Escape", technique: "Mount host filesystem attempts" },
  { id: "RT-009", attack: "Rate Abuse", technique: "1000 req/min automated probing" },
  { id: "RT-010", attack: "State Drift", technique: "Modify agent context mid-session" },
  { id: "RT-011", attack: "LLM Supply Chain", technique: "Compromised Ollama model" },
  { id: "RT-012", attack: "Log Injection", technique: "Crafted payloads in user input" },
  { id: "RT-013", attack: "TOCTOU Race", technique: "Race condition in policy check" },
  { id: "RT-014", attack: "DNS Rebinding", technique: "Bypass egress filter via DNS" },
  { id: "RT-015", attack: "Privilege Escalation", technique: "Exploit Watchdog → root" },
  { id: "RT-016", attack: "Indirect Tool Output", technique: "Inject malicious instructions in tool output" },
  { id: "RT-017", attack: "Multi-Turn Context", technique: "Build trust then exploit across turns" },
  { id: "RT-018", attack: "Encoding Injection", technique: "Base64/hex encoded payloads" },
  { id: "RT-019", attack: "Multi-Language", technique: "Injection in multiple languages" },
  { id: "RT-020", attack: "Nested Injection", technique: "Nested system/user/assistant markers" },
  { id: "RT-021", attack: "Social Engineering", technique: "Fake admin/emergency commands" },
  { id: "RT-022", attack: "Payload Obfuscation", technique: "Variable splitting, concatenation" },
  { id: "RT-023", attack: "Supply Chain", technique: "Malicious package installation" },
  { id: "RT-024", attack: "Time-Based", technique: "Delayed trigger injection" },
  { id: "RT-025", attack: "Resource Exhaustion", technique: "Large payloads, concurrent requests" },
  { id: "RT-026", attack: "Memory Poisoning", technique: "Poison agent conversation memory" },
  { id: "RT-027", attack: "Cross-Session", technique: "Contaminate other sessions" },
  { id: "RT-028", attack: "Token Extraction", technique: "Extract API keys/tokens" },
  { id: "RT-029", attack: "Denial of Service", technique: "Excessive token generation" },
  { id: "RT-030", attack: "Side Channel", technique: "Data exfiltration via encoding" },
];

export const TECH_NAME: Record<string, string> = Object.fromEntries(
  RED_TEAM_ATTACKS.map((a) => [a.id, a.attack]),
);
