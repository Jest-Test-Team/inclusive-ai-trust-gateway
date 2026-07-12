import type { AgentSafetySignal, PublicServiceUseCase, TrustAssessment } from "./types";

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function assessUseCase(
  useCase: PublicServiceUseCase,
  safetySignals: AgentSafetySignal[],
): TrustAssessment {
  const personaCoverage = useCase.personas.length * 12;
  const barrierCoverage = useCase.personas.reduce(
    (total, persona) => total + persona.barriers.length * 4,
    0,
  );
  const safeguardCoverage = useCase.safeguards.length * 8;
  const openDataReadiness = clampScore(useCase.openDataSources.length * 22);

  const readySafety = safetySignals.filter((signal) => signal.status === "ready").length;
  const partialSafety = safetySignals.filter((signal) => signal.status === "partial").length;
  const agentSafetyReadiness = clampScore(readySafety * 28 + partialSafety * 14);

  const inclusionScore = clampScore(
    18 + personaCoverage + barrierCoverage + safeguardCoverage + openDataReadiness * 0.18,
  );

  const unresolvedGaps =
    useCase.personas.reduce((total, persona) => total + persona.barriers.length, 0) -
    useCase.safeguards.length;

  const fairnessRisk =
    inclusionScore >= 82 && unresolvedGaps <= 2
      ? "Low"
      : inclusionScore >= 64
        ? "Medium"
        : "High";

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

