import { z } from "zod";

/**
 * Zod schemas shared by the tRPC router, the Next.js/Expo clients, and the
 * gateway's non-HTTP surfaces (MCP, UCP). HTTP controllers use class-validator
 * DTOs in services/gateway; both layers must stay contract-compatible.
 */

export const sdgCodeSchema = z.enum(["SDG 9", "SDG 10", "SDG 11", "SDG 16"]);

export const serviceDomainSchema = z.enum([
  "Care Services",
  "Disaster Prevention",
  "Education",
  "Governance",
]);

export const inclusionPersonaSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  ageGroup: z.string().min(1),
  region: z.string().min(1),
  needs: z.array(z.string().min(1)),
  barriers: z.array(z.string().min(1)),
});

export const useCaseInputSchema = z.object({
  name: z.string().min(1).max(200),
  domain: serviceDomainSchema,
  summary: z.string().min(1).max(2000),
  targetUsers: z.array(z.string().min(1)).default([]),
  sdgs: z.array(sdgCodeSchema).default([]),
  openDataSources: z.array(z.string().min(1)).default([]),
  aiCapabilities: z.array(z.string().min(1)).default([]),
  safeguards: z.array(z.string().min(1)).default([]),
  personas: z.array(inclusionPersonaSchema).default([]),
});

export const safetyEventSchema = z.object({
  eventType: z.enum(["prompt_injection", "tool_policy", "containment", "provenance"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  detail: z.union([z.string(), z.record(z.string(), z.unknown())]),
  sessionId: z.string().optional(),
});

export const trustAssessmentSchema = z.object({
  inclusionScore: z.number().int().min(0).max(100),
  fairnessRisk: z.enum(["Low", "Medium", "High"]),
  openDataReadiness: z.number().int().min(0).max(100),
  agentSafetyReadiness: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type UseCaseInput = z.infer<typeof useCaseInputSchema>;
export type SafetyEventInput = z.infer<typeof safetyEventSchema>;
