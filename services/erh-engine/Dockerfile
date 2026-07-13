# Self-contained ERH Engine deployment (Choreo or any container host).
# Build context: services/erh-engine
#
# Choreo routes traffic to the container port declared in .choreo/component.yaml.
# Listen on PORT (default 8080) so Choreo's injected PORT and the endpoint agree.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY erh_engine/requirements.txt ./erh_engine/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r erh_engine/requirements.txt

COPY erh_core/ ./erh_core/
COPY erh_engine/ ./erh_engine/

ENV PYTHONPATH=/app
ENV ERH_MODE=rest
ENV PORT=8080

EXPOSE 8080

# Choreo requires a numeric non-root UID in the 10000-20000 range.
RUN useradd --uid 10014 --create-home iatg
USER 10014

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8080}/v1/health || exit 1

CMD ["python", "-m", "erh_engine.serve"]
