#!/bin/sh
set -eu

# Embedded Redis for the free-tier single-container deployment; disable with
# ADM_EMBED_REDIS=0 when ADM_REDIS_URL points at a managed instance.
if [ "${ADM_EMBED_REDIS:-1}" != "0" ]; then
  redis-server --save '' --appendonly no --maxmemory 128mb \
    --maxmemory-policy allkeys-lru --bind 127.0.0.1 --port 6379 --dir /tmp &
fi

adm-siem &
siem_pid="$!"

adm-gateway &
gateway_pid="$!"

term() {
  kill "$gateway_pid" "$siem_pid" 2>/dev/null || true
  wait "$gateway_pid" "$siem_pid" 2>/dev/null || true
}

trap term INT TERM

while true; do
  if ! kill -0 "$siem_pid" 2>/dev/null; then
    wait "$siem_pid" || exit $?
  fi
  if ! kill -0 "$gateway_pid" 2>/dev/null; then
    wait "$gateway_pid" || exit $?
  fi
  sleep 2
done
