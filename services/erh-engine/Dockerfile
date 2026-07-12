# Self-contained ERH Engine deployment for Back4App.
# Build context: services/erh-engine
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

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/v1/health || exit 1

CMD ["python", "-m", "erh_engine.serve"]
