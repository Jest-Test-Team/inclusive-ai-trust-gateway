export type SdgCode = "SDG 9" | "SDG 10" | "SDG 11" | "SDG 16";

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

