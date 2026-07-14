import type { AgentSafetySignal, PublicServiceUseCase } from "./types";

export const useCases: PublicServiceUseCase[] = [
  {
    id: "care-navigation",
    name: "Inclusive Care Navigation",
    domain: "Care Services",
    summary:
      "AI-assisted service guidance for older adults, caregivers, and people with disabilities.",
    targetUsers: [
      "older adults",
      "family caregivers",
      "people with disabilities",
      "local care coordinators",
    ],
    sdgs: ["SDG 10", "SDG 11", "SDG 16"],
    openDataSources: [
      "public care service directories",
      "accessible transportation feeds",
      "regional demographic indicators",
      "long-term care ABC service sites",
    ],
    aiCapabilities: [
      "plain-language service matching",
      "multilingual question answering",
      "risk-aware referral summaries",
    ],
    safeguards: [
      "human review for high-risk referrals",
      "accessibility checks for every channel",
      "personal-data minimization",
    ],
    personas: [
      {
        id: "rural-older-adult",
        label: "Rural older adult",
        ageGroup: "65+",
        region: "rural",
        needs: ["voice-first guidance", "transportation support", "care eligibility"],
        barriers: ["low digital literacy", "limited broadband", "complex forms"],
      },
      {
        id: "working-caregiver",
        label: "Working caregiver",
        ageGroup: "35-54",
        region: "urban",
        needs: ["after-hours access", "benefit comparison", "case handoff"],
        barriers: ["time constraints", "fragmented agencies", "unclear next steps"],
      },
    ],
  },
  {
    id: "disaster-access",
    name: "Accessible Disaster Support",
    domain: "Disaster Prevention",
    summary:
      "AI triage and multilingual guidance for evacuation, shelter, supplies, and recovery services.",
    targetUsers: [
      "residents in disaster-prone areas",
      "people with mobility needs",
      "migrant communities",
      "local responders",
    ],
    sdgs: ["SDG 9", "SDG 10", "SDG 11", "SDG 16"],
    openDataSources: [
      "weather alerts",
      "shelter capacity feeds",
      "transportation disruption data",
      "public hazard maps",
    ],
    aiCapabilities: [
      "localized alert summarization",
      "resource matching",
      "agent-assisted responder workflows",
    ],
    safeguards: [
      "source-grounded responses",
      "critical-alert escalation",
    ],
    personas: [
      {
        id: "mobility-limited-resident",
        label: "Resident with mobility needs",
        ageGroup: "all ages",
        region: "coastal",
        needs: ["accessible evacuation routes", "shelter accessibility", "care supplies"],
        barriers: [
          "fast-changing information",
          "transport gaps",
          "caregiver separation",
          "power outage during evacuation",
        ],
      },
      {
        id: "new-language-community",
        label: "New-language community member",
        ageGroup: "18-64",
        region: "metro",
        needs: ["translated instructions", "trusted source links", "hotline routing"],
        barriers: ["language mismatch", "rumor exposure", "unfamiliar agencies"],
      },
    ],
  },
  {
    id: "education-access",
    name: "AI Learning Access Auditor",
    domain: "Education",
    summary:
      "Audit AI tutoring and school-support tools for equitable access across student needs and regions.",
    targetUsers: [
      "students",
      "teachers",
      "special education coordinators",
      "rural schools",
    ],
    sdgs: ["SDG 9", "SDG 10", "SDG 16"],
    openDataSources: [
      "school broadband availability",
      "public curriculum standards",
      "assistive technology guidance",
      "rural broadband subsidy records",
    ],
    aiCapabilities: [
      "learning-support quality checks",
      "bias and accommodation review",
      "teacher-facing risk summaries",
    ],
    safeguards: [
      "age-appropriate data boundaries",
      "teacher override",
      "bias drift monitoring",
      "plain-language consent prompts",
    ],
    personas: [
      {
        id: "rural-student",
        label: "Rural student",
        ageGroup: "13-18",
        region: "rural",
        needs: ["offline-friendly support", "low-bandwidth mode", "teacher escalation"],
        barriers: ["device sharing", "unstable network", "limited local tutoring"],
      },
      {
        id: "student-accessibility",
        label: "Student needing accommodations",
        ageGroup: "6-18",
        region: "mixed",
        needs: ["screen-reader support", "plain-language feedback", "individualized pacing"],
        barriers: ["format barriers", "assessment bias", "privacy concerns"],
      },
    ],
  },
];

export const safetySignals: AgentSafetySignal[] = [
  {
    control: "Prompt-injection trajectory monitoring",
    source: "ADM",
    status: "ready",
    description:
      "Detects intent drift across a session instead of judging a single prompt in isolation.",
  },
  {
    control: "Tool-call policy enforcement",
    source: "ADM",
    status: "ready",
    description:
      "Blocks unsafe chains such as unauthorized reads followed by external sends.",
  },
  {
    control: "Session-bound containment",
    source: "ADM",
    status: "partial",
    description:
      "Revokes risky sessions and isolates agent execution; production connectors are still planned.",
  },
  {
    control: "Open-data provenance checks",
    source: "ADM",
    status: "partial",
    description:
      "Tracks source references and flags ungrounded responses before citizen-facing output.",
  },
];

