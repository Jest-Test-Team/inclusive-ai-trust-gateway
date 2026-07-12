#!/bin/sh
set -eu

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
