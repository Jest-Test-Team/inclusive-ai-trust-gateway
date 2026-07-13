import type { AgentSafetySignal, PublicServiceUseCase, TrustAssessment } from "./types";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function riskScore(
  inclusionScore: number,
  unresolvedGaps: number,
  totalBarriers: number,
  openDataReadiness: number,
): number {
  const inclusionDeficit = (100 - inclusionScore) * 0.5;
  const gapPenalty = Math.min(48, Math.max(0, unresolvedGaps) * 8);
  const barrierLoad = Math.min(25, Math.round(totalBarriers * 2.5));
  const openDataResidual = (100 - openDataReadiness) * 0.15;
  return clampScore(inclusionDeficit + gapPenalty + barrierLoad + openDataResidual);
}

function riskLabelFor(score: number): "Low" | "Medium" | "High" {
  if (score <= 33) return "Low";
  if (score <= 66) return "Medium";
  return "High";
}

export function assessUseCase(
  useCase: PublicServiceUseCase,
  safetySignals: AgentSafetySignal[],
): TrustAssessment {
  const personaCoverage = useCase.personas.length * 12;
  const totalBarriers = useCase.personas.reduce((total, persona) => total + persona.barriers.length, 0);
  const barrierCoverage = totalBarriers * 4;
  const safeguardCoverage = useCase.safeguards.length * 8;
  const openDataReadiness = clampScore(useCase.openDataSources.length * 22);

  const readySafety = safetySignals.filter((signal) => signal.status === "ready").length;
  const partialSafety = safetySignals.filter((signal) => signal.status === "partial").length;
  const agentSafetyReadiness = clampScore(readySafety * 28 + partialSafety * 14);

  const inclusionScore = clampScore(
    18 + personaCoverage + barrierCoverage + safeguardCoverage + openDataReadiness * 0.18,
  );

  const unresolvedGaps = totalBarriers - useCase.safeguards.length;
  const fairnessRisk = riskLabelFor(
    riskScore(inclusionScore, unresolvedGaps, totalBarriers, openDataReadiness),
  );

  return {
    inclusionScore,
    fairnessRisk,
    openDataReadiness,
    agentSafetyReadiness,
    strengths: [
      `${useCase.personas.length} inclusion personas modeled`,
      `${useCase.openDataSources.length} open-data source categories identified`,
      `${readySafety} ADM controls ready for integration`,
    ],
    gaps: [
      "Replace local scoring with ERH engine API results",
      "Add field validation data from real public-service pilots",
      "Publish an open data dictionary for repeatable audits",
    ],
    nextSteps: [
      "Connect ERH fairness and ethical-degree scoring",
      "Connect ADM prompt-injection and tool-chain telemetry",
      "Run a pilot with a care, education, or disaster-response partner",
    ],
  };
}

export function formatScore(score: number): string {
  return `${clampScore(score)}/100`;
}

