#!/usr/bin/env bash
# Polls a URL until it returns 2xx, or fails after a timeout.
# Usage: wait-for-http.sh <url> [attempts] [delay_seconds] [log_file_on_failure]
set -euo pipefail

url="${1:?usage: wait-for-http.sh <url> [attempts] [delay_seconds] [log_file_on_failure]}"
attempts="${2:-30}"
delay="${3:-2}"
log_file="${4:-}"

for i in $(seq 1 "$attempts"); do
  if curl -sf "$url" > /dev/null; then
    echo "Ready: $url (attempt $i/$attempts)"
    exit 0
  fi
  echo "Waiting for $url... ($i/$attempts)"
  sleep "$delay"
done

echo "Timed out waiting for $url after $attempts attempts." >&2
if [ -n "$log_file" ] && [ -f "$log_file" ]; then
  echo "--- $log_file ---" >&2
  cat "$log_file" >&2
fi
exit 1
