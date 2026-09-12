#!/usr/bin/env bash
set -euo pipefail
# Fresh-clone verification: compose up → migrate → seed → CRUD smoke
# Run from repo root. Requires: docker compose, curl, jq

echo "=== Starting services ==="
docker compose up -d db
docker compose up -d --build app

echo "=== Waiting for DB health ==="
for i in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U gradientrip -d gradientrip >/dev/null 2>&1; then
        echo "DB ready after ${i}0s"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "DB did not become ready in time"
        docker compose logs db
        exit 1
    fi
    sleep 10
done

echo "=== Waiting for app ==="
for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/api/modes >/dev/null 2>&1; then
        echo "App ready after ${i}0s"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "App did not become ready in time"
        docker compose logs app
        exit 1
    fi
    sleep 10
done

echo "=== Running migrations ==="
docker compose exec -T app npm run db:migrate

echo "=== Seeding reference data ==="
docker compose exec -T app npm run db:seed

BASE="http://localhost:3000"
DEVICE="verify-test-$(date +%s)"

echo "=== CRUD smoke: presets ==="
PRESET_RESP=$(curl -sf -X POST "$BASE/api/presets" \
    -H "Content-Type: application/json" \
    -H "x-gradient-device: $DEVICE" \
    -d '{"label":"Test Place","query":"Cape Town","coords":[-33.9249,18.4241]}')
PRESET_ID=$(echo "$PRESET_RESP" | jq -r '.id')
if [ -z "$PRESET_ID" ] || [ "$PRESET_ID" = "null" ]; then
    echo "FAIL: preset creation"
    exit 1
fi
echo "Created preset $PRESET_ID"

GET_PRESET=$(curl -sf "$BASE/api/presets" -H "x-gradient-device: $DEVICE")
if ! echo "$GET_PRESET" | jq -e '.[] | select(.id == '$PRESET_ID')' >/dev/null 2>&1; then
    echo "FAIL: preset not readable back"
    exit 1
fi
echo "Preset readable back"

curl -sf -X DELETE "$BASE/api/presets/$PRESET_ID" -H "x-gradient-device: $DEVICE" >/dev/null
GET_AFTER_DELETE=$(curl -sf "$BASE/api/presets" -H "x-gradient-device: $DEVICE")
if echo "$GET_AFTER_DELETE" | jq -e '.[] | select(.id == '$PRESET_ID')' >/dev/null 2>&1; then
    echo "FAIL: preset not deleted"
    exit 1
fi
echo "Preset deleted"

echo "=== CRUD smoke: trips ==="
TRIP_BODY=$(jq -n \
    --arg ts "$(date +%s000)" \
    '{ts: ($ts | tonumber), modeId: "eskate", boardVal: "336|30|12", queries: ["test"], coords: [[-33.9,18.4],[-33.92,18.42]], line: [[-33.9,18.4],[-33.92,18.42]], pts: [[-33.9,18.4]], elev: [0,10], cum: [], totalWh: 14.5, totalClimb: 60, usableWh: 293, climbLimit: 30, brakeLimit: 12, totalKm: 1.0, drawn: false, recorded: false}')
TRIP_RESP=$(curl -sf -X POST "$BASE/api/trips" \
    -H "Content-Type: application/json" \
    -H "x-gradient-device: $DEVICE" \
    -d "$TRIP_BODY")
TRIP_ID=$(echo "$TRIP_RESP" | jq -r '.id')
if [ -z "$TRIP_ID" ] || [ "$TRIP_ID" = "null" ]; then
    echo "FAIL: trip creation"
    exit 1
fi
echo "Created trip $TRIP_ID"

GET_TRIPS=$(curl -sf "$BASE/api/trips" -H "x-gradient-device: $DEVICE")
if ! echo "$GET_TRIPS" | jq -e '.[] | select(.id == '$TRIP_ID')' >/dev/null 2>&1; then
    echo "FAIL: trip not readable back"
    exit 1
fi
echo "Trip readable back"

curl -sf -X DELETE "$BASE/api/trips/$TRIP_ID" -H "x-gradient-device: $DEVICE" >/dev/null
GET_TRIPS_AFTER=$(curl -sf "$BASE/api/trips" -H "x-gradient-device: $DEVICE")
if echo "$GET_TRIPS_AFTER" | jq -e '.[] | select(.id == '$TRIP_ID')' >/dev/null 2>&1; then
    echo "FAIL: trip not deleted"
    exit 1
fi
echo "Trip deleted"

echo "=== CRUD smoke: prefs ==="
PREFS_RESP=$(curl -sf -X PUT "$BASE/api/prefs" \
    -H "Content-Type: application/json" \
    -H "x-gradient-device: $DEVICE" \
    -d '{"transport_mode":"ebike","theme":"dark","legal_dismissed":true}')
if ! echo "$PREFS_RESP" | jq -e '.theme == "dark"' >/dev/null 2>&1; then
    echo "FAIL: prefs not saved"
    exit 1
fi
echo "Prefs saved"

PREFS_GET=$(curl -sf "$BASE/api/prefs" -H "x-gradient-device: $DEVICE")
if ! echo "$PREFS_GET" | jq -e '.theme == "dark"' >/dev/null 2>&1; then
    echo "FAIL: prefs not readable back"
    exit 1
fi
echo "Prefs readable back"

echo "=== CRUD smoke: modes ==="
MODES=$(curl -sf "$BASE/api/modes")
if [ "$(echo "$MODES" | jq 'length')" -lt 7 ]; then
    echo "FAIL: expected at least 7 transport modes"
    exit 1
fi
echo "Modes readable ($(echo "$MODES" | jq 'length') total)"

echo "=== CRUD smoke: sync ==="
SYNC_RESP=$(curl -sf -X POST "$BASE/api/sync" \
    -H "Content-Type: application/json" \
    -H "x-gradient-device: $DEVICE" \
    -d '{"presets":[{"label":"Synced","query":"test"}],"prefs":{"theme":"auto"}}')
if ! echo "$SYNC_RESP" | jq -e '.synced.presets == 1' >/dev/null 2>&1; then
    echo "FAIL: sync did not acknowledge"
    exit 1
fi
echo "Sync acknowledged"

echo "=== CRUD smoke: plan/cache ==="
CACHE_RESP=$(curl -sf -X POST "$BASE/api/plan/cache" \
    -H "Content-Type: application/json" \
    -H "x-gradient-device: $DEVICE" \
    -d '{"query_hash":"test-hash-1","mode_id":"eskate","board_val":"336|30|12","options":[{"verdict":"ok"}],"expires_at":"2027-01-01T00:00:00Z"}')
if ! echo "$CACHE_RESP" | jq -e '.cached == true' >/dev/null 2>&1; then
    echo "FAIL: plan/cache write"
    exit 1
fi
echo "Plan cache write OK"

CACHE_GET=$(curl -sf "$BASE/api/plan/cache" -H "x-gradient-device: $DEVICE")
if ! echo "$CACHE_GET" | jq -e '.[] | select(.query_hash == "test-hash-1")' >/dev/null 2>&1; then
    echo "FAIL: plan/cache read-back"
    exit 1
fi
echo "Plan cache read-back OK"

echo ""
echo "========================================="
echo "ALL VERIFICATION CHECKS PASSED"
echo "========================================="
