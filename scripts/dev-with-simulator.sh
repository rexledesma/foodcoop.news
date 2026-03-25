#!/usr/bin/env bash
set -euo pipefail

DEVICE_NAME="iPhone 14 Pro"
DEV_URL="http://localhost:5173"

open_simulator_url() {
  if ! command -v xcrun >/dev/null 2>&1 || ! command -v open >/dev/null 2>&1; then
    return 0
  fi

  (
    set +e
    open -a Simulator >/dev/null 2>&1
    xcrun simctl boot "$DEVICE_NAME" >/dev/null 2>&1
    xcrun simctl bootstatus "$DEVICE_NAME" -b >/dev/null 2>&1

    for _ in $(seq 1 120); do
      if curl -sf "$DEV_URL" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    xcrun simctl openurl "$DEVICE_NAME" "$DEV_URL" >/dev/null 2>&1
  ) &
}

open_simulator_url
exec vp dev
