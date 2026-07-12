# Hackathon Submission Draft

## Name of Work

Inclusive AI Trust Gateway

## Introduction to the Work

Inclusive AI Trust Gateway is a public-service AI evaluation and protection platform. It helps agencies and civic teams audit whether AI services are inclusive, explainable, open-data grounded, and protected against unsafe agent behavior.

The proposal combines Ethic-Latex / ERH for fairness and ethical-risk analysis with Agentic Defense Matrix / ADM for agent safety, prompt-injection monitoring, and tool-call containment.

## Corresponding With SDGs

- SDG 9: Industry, Innovation and Infrastructure
- SDG 10: Reduced Inequalities
- SDG 11: Sustainable Cities and Communities
- SDG 16: Peace, Justice and Strong Institutions

## Intent to Resolve the Issue and Its Significance

AI public services can improve access to education, care, disaster response, and government information, but they can also widen the digital divide when systems fail for older adults, rural residents, people with disabilities, migrant communities, or people with low digital literacy.

The project provides a repeatable trust gateway that evaluates inclusion risks before deployment and monitors AI-agent safety during operation.

## Relevant Parties and Their Respective Roles

- Public agencies: provide service goals, policy constraints, and validation fields.
- Civic-tech teams: integrate the gateway with AI service prototypes.
- NGOs and accessibility advocates: review inclusion personas, barriers, and service outcomes.
- Data stewards: publish and improve open datasets used by the gateway.
- Security operators: review ADM telemetry and containment events.

## Description of the Solution's Functionality

- Model public-service scenarios and affected user personas.
- Score inclusion readiness, fairness risk, open-data readiness, and agent-safety readiness.
- Use ERH-style decision analysis to detect structural ethical-error growth.
- Use ADM-style controls to detect prompt injection, tool-chain abuse, and unsafe agent drift.
- Produce a human-readable action plan for mitigation, partner validation, and open-data improvement.

## Differences From Existing Alternatives

Many AI governance tools focus only on policy checklists, and many AI-security tools focus only on attack blocking. Inclusive AI Trust Gateway joins both layers in one public-service workflow: inclusion auditing before launch and agent safety during live operation.

## Anticipated Outcome

- A working dashboard for public-service AI trust assessment.
- A documented data schema for inclusion personas, public-service use cases, and safety signals.
- Pilot-ready integrations with ERH evaluation services and ADM telemetry.
- A reusable template that cities, ministries, schools, and care organizations can adapt.

## Developmental Stage

Prototype. The current repository contains a runnable local dashboard, scoring model, architecture notes, and adapter boundaries. The next stage is live integration with Ethic-Latex / ERH and ADM services.

## Future Planning

1. Connect ERH REST/gRPC scoring.
2. Connect ADM session telemetry and safety events.
3. Add open-data provenance validation.
4. Run a small pilot with care services, education, or disaster-response scenarios.
5. Publish anonymized validation results and improve the open schema.

## Open Data Sources

Initial source categories include public care-service directories, accessibility and transportation feeds, weather alerts, shelter capacity feeds, hazard maps, school broadband availability, and public curriculum standards.

## Open Source Software Design

The project is intended to be open source under the MIT license. It uses TypeScript, Vite, ERH-compatible evaluation boundaries, and ADM-compatible safety telemetry boundaries.

## Recommendations for Modifications to Open Data

- Add accessibility metadata to public-service directories.
- Add multilingual labels and plain-language summaries.
- Add machine-readable freshness, provenance, and responsible-agency fields.
- Add service eligibility and channel availability fields.

## Work Promotion and Planning

The project can be promoted through civic-tech communities, public-sector innovation labs, accessibility organizations, and AI governance networks. The MVP is designed for public demos and partner workshops.

## Expected Cooperative Units

- Ministries or departments responsible for digital services.
- Local governments.
- Social welfare and care-service agencies.
- Disaster-response agencies.
- Schools and education technology teams.
- Accessibility and digital inclusion NGOs.

## Has the Proposal Been Established as a Company?

No.

## Current Validation Field

Prototype validation is planned across care navigation, disaster support, and education access scenarios.

## Current Verification Results

The current MVP validates the workflow and data model locally. Real-world verification will require partner-provided field data and public-service pilot results.

