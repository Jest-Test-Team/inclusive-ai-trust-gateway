# Inclusive AI Trust Gateway

Public-service AI evaluation and protection platform for the 2026 Presidential Hackathon International Track theme, **Digital Inclusion in the AI Era**.

The project combines two existing engines:

- **Ethic-Latex / ERH** as the inclusion, fairness, and decision-risk evaluator.
- **Agentic Defense Matrix / ADM** as the AI-agent safety and containment layer.

The first MVP is a local TypeScript dashboard that models how a public agency can score an AI service across inclusion readiness, fairness risk, open-data readiness, and agent safety controls.

## Why This Exists

Governments are beginning to use AI for citizen services, disaster support, care coordination, education, translation, benefits navigation, and case triage. These services need two kinds of trust:

1. **Inclusive AI trust:** Does the system work equitably for people across age, region, ability, language, and digital-literacy levels?
2. **Operational AI trust:** Can the system resist prompt injection, tool abuse, data exfiltration, and unsafe autonomous behavior?

Inclusive AI Trust Gateway turns those two questions into an auditable workflow.

## MVP Structure

```text
inclusive-ai-trust-gateway/
+-- src/                     # Vite + TypeScript demo application
+-- docs/                    # Hackathon submission and architecture notes
+-- adapters/
|   +-- ethic-latex/         # ERH integration boundary
|   +-- adm/                 # ADM integration boundary
+-- services/gateway/        # Future API gateway service boundary
+-- .github/workflows/       # CI for typecheck/build
```

## Local Development

Use the bundled Node runtime available in Codex, or any Node.js 20+ installation.

```bash
pnpm install
pnpm dev
pnpm build
```

The app is currently static and deterministic. It is designed so real ERH/ADM service calls can replace the local scoring functions without changing the public workflow.

## Hackathon Fit

- **Challenge theme:** Digital Inclusion in the AI Era
- **Primary SDGs:** SDG 10, SDG 16, SDG 9, SDG 11
- **Main users:** public agencies, civic-tech teams, NGOs, accessibility advocates, local governments
- **Core value:** help teams deploy AI public services that are inclusive, explainable, auditable, and resistant to misuse

See [docs/hackathon-submission.md](docs/hackathon-submission.md) for a draft submission outline.
