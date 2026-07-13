import { describe, expect, it } from "vitest";
import { assessUseCase, formatScore, riskScore } from "./scoring";
import { safetySignals, useCases } from "./sampleData";
import { trustAssessmentSchema, useCaseInputSchema } from "./schemas";

describe("assessUseCase", () => {
  it("produces a valid assessment for every sample use case", () => {
    for (const useCase of useCases) {
      const assessment = assessUseCase(useCase, safetySignals);
      expect(() => trustAssessmentSchema.parse(assessment)).not.toThrow();
    }
  });

  it("keeps all scores within 0-100", () => {
    const assessment = assessUseCase(useCases[0], safetySignals);
    for (const score of [
      assessment.inclusionScore,
      assessment.openDataReadiness,
      assessment.agentSafetyReadiness,
    ]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("assigns different fairness risk scores across sample use cases", () => {
    const scores = useCases.map((useCase) => {
      const assessment = assessUseCase(useCase, safetySignals);
      const totalBarriers = useCase.personas.reduce((total, persona) => total + persona.barriers.length, 0);
      const unresolvedGaps = totalBarriers - useCase.safeguards.length;
      return riskScore(
        assessment.inclusionScore,
        unresolvedGaps,
        totalBarriers,
        assessment.openDataReadiness,
      );
    });
    expect(new Set(scores).size).toBeGreaterThan(1);
    expect(scores.every((score) => score >= 0 && score <= 100)).toBe(true);
  });

  it("degrades fairness risk when personas and safeguards are removed", () => {
    const stripped = {
      ...useCases[0],
      personas: [
        {
          ...useCases[0].personas[0],
          barriers: ["b1", "b2", "b3", "b4"],
        },
      ],
      safeguards: [],
      openDataSources: [],
    };
    const assessment = assessUseCase(stripped, []);
    expect(assessment.fairnessRisk).toBe("High");
  });
});

describe("formatScore", () => {
  it("clamps and formats", () => {
    expect(formatScore(120)).toBe("100/100");
    expect(formatScore(-5)).toBe("0/100");
  });
});

describe("useCaseInputSchema", () => {
  it("accepts the sample use cases (minus ids)", () => {
    for (const { id: _id, ...rest } of useCases) {
      expect(() => useCaseInputSchema.parse(rest)).not.toThrow();
    }
  });

  it("rejects an unknown domain", () => {
    expect(() =>
      useCaseInputSchema.parse({ name: "x", domain: "Commerce", summary: "y" }),
    ).toThrow();
  });
});
