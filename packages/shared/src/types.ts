export type SdgCode =
  | "SDG 1"
  | "SDG 2"
  | "SDG 3"
  | "SDG 4"
  | "SDG 5"
  | "SDG 6"
  | "SDG 7"
  | "SDG 8"
  | "SDG 9"
  | "SDG 10"
  | "SDG 11"
  | "SDG 12"
  | "SDG 13"
  | "SDG 14"
  | "SDG 15"
  | "SDG 16"
  | "SDG 17";

export type ServiceDomain =
  | "Care Services"
  | "Disaster Prevention"
  | "Education"
  | "Governance";

export interface InclusionPersona {
  id: string;
  label: string;
  ageGroup: string;
  region: string;
  needs: string[];
  barriers: string[];
}

export interface PublicServiceUseCase {
  id: string;
  name: string;
  domain: ServiceDomain;
  summary: string;
  targetUsers: string[];
  sdgs: SdgCode[];
  openDataSources: string[];
  aiCapabilities: string[];
  safeguards: string[];
  personas: InclusionPersona[];
}

export interface AgentSafetySignal {
  control: string;
  source: "ADM";
  status: "ready" | "partial" | "missing";
  description: string;
}

export interface TrustAssessment {
  inclusionScore: number;
  fairnessRisk: "Low" | "Medium" | "High";
  openDataReadiness: number;
  agentSafetyReadiness: number;
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
}

export interface SdgPriority {
  sdg: SdgCode;
  name: string;
  priority: "P0" | "P1" | "P2" | "P3";
  fit: "core" | "strong" | "adjacent" | "monitor";
  repoCanDo: string;
  proofPath: string;
  implementation: string[];
}
