# Ethic-Latex / ERH Adapter

This adapter boundary will connect Inclusive AI Trust Gateway to the ERH evaluation engine.

## Planned Responsibilities

- Convert public-service outcomes into ERH `Sample` records.
- Call `erh_engine` over REST or gRPC.
- Return fairness and ethical-error growth indicators.
- Explain which personas, barriers, or service outcomes drive elevated risk.

## MVP Status

The dashboard currently uses deterministic local scoring in `src/app/scoring.ts`. Replace that function with an ERH-backed client when the service integration begins.

