# Agentic Defense Matrix Adapter

This adapter boundary will connect Inclusive AI Trust Gateway to ADM safety telemetry.

## Planned Responsibilities

- Consume prompt-injection and intent-drift signals.
- Consume tool-call policy decisions.
- Consume containment and session-revocation events.
- Attach safety evidence to each public-service AI assessment.

## MVP Status

The dashboard currently uses static safety signals in `src/app/sampleData.ts`. Replace those records with ADM API or event-stream data when live integration begins.

