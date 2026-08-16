#!/usr/bin/env bash
# EduFlow — tenant isolation verification (end-to-end).
#
# Run against a LIVE instance with a fresh database (seeded or empty):
#   BASE_URL=http://localhost:3000 ./scripts/verify-tenant-isolation.sh
#
# What it verifies:
#   1. Two schools register independently (School A, School B).
#   2. Admin A creates a student; School B's session CANNOT see it
#      (list + direct GET both blocked).
#   3. API-key isolation: B's key cannot read A's student list.
# Prints PASS/FAIL per check; exits non-zero on any failure.
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
STAMP="$(date +%s)"
JAR_A="$(mktemp)"; JAR_B="$(mktemp)"
PASS=0; FAIL=0

check() { # name, ok
  if [[ "$2" == "PASS" ]]; then PASS=$((PASS+1)); echo "PASS: $1";
  else FAIL=$((FAIL+1)); echo "FAIL: $1"; fi
}

post() { # jar, path, json
  curl -s -b "$1" -c "$1" -H "Content-Type: application/json" -d "$3" "$BASE$2"
}

# ── 1. Register both schools ──────────────────────────────────────────
A_JSON=$(post "$JAR_A" /api/register "{\"name\":\"Iso Tester A\",\"email\":\"iso-a-$STAMP@test.edu\",\"password\":\"password123\",\"schoolName\":\"Isolation School A\"}")
B_JSON=$(post "$JAR_B" /api/register "{\"name\":\"Iso Tester B\",\"email\":\"iso-b-$STAMP@test.edu\",\"password\":\"password123\",\"schoolName\":\"Isolation School B\"}")
check "school A registers" "$(echo "$A_JSON" | grep -c '"id"' | grep -q '^1$' && echo PASS || echo FAIL)"
check "school B registers" "$(echo "$B_JSON" | grep -c '"id"' | grep -q '^1$' && echo PASS || echo FAIL)"

# ── 2. Log both admins in (NextAuth credentials flow) ─────────────────
login() { # jar, email
  local csrf
  csrf=$(curl -s -b "$1" -c "$1" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
  curl -s -b "$1" -c "$1" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "email=$2" \
    --data-urlencode "password=password123"
}
LA=$(login "$JAR_A" "iso-a-$STAMP@test.edu")
LB=$(login "$JAR_B" "iso-b-$STAMP@test.edu")
check "admin A logs in (redirect 302/200)" "$( [[ "$LA" == "302" || "$LA" == "200" ]] && echo PASS || echo FAIL )"
check "admin B logs in (redirect 302/200)" "$( [[ "$LB" == "302" || "$LB" == "200" ]] && echo PASS || echo FAIL )"

# ── 3. A creates a student ────────────────────────────────────────────
ADM="ADM-$STAMP"
STUDENT=$(post "$JAR_A" /api/admin/students "{\"firstName\":\"Isolation\",\"lastName\":\"Probe\",\"admissionNumber\":\"$ADM\",\"email\":\"probe-$STAMP@test.edu\"}")
check "A creates student" "$(echo "$STUDENT" | grep -c "\"id\"" | grep -q '^1$' && echo PASS || echo FAIL)"

# ── 4. B cannot see A's student ───────────────────────────────────────
B_LIST=$(curl -s -b "$JAR_B" "$BASE/api/admin/students?search=$ADM&pageSize=100")
check "B's student list does not contain A's student" "$(echo "$B_LIST" | grep -c "$ADM" | grep -q '^0$' && echo PASS || echo FAIL)"

SID=$(echo "$STUDENT" | sed -E 's/.*"id":"([^"]+)".*/\1/')
B_DIRECT=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_B" "$BASE/api/admin/students?search=$SID")
check "B direct lookup of A's student blocked" "$( [[ "$B_DIRECT" != "200" ]] && echo PASS || echo FAIL )"

# ── 5. API key isolation ──────────────────────────────────────────────
KEY_A=$(post "$JAR_A" /api/admin/api-keys "{\"name\":\"iso-a\"}")
AK=$(echo "$KEY_A" | sed -E 's/.*"apiKey":"([^"]+)".*/\1/')
check "A creates API key" "$( [[ "$AK" == ef_* ]] && echo PASS || echo FAIL )"

A_V1=$(curl -s -H "x-api-key: $AK" "$BASE/api/v1/students?search=$ADM")
check "A's key sees A's student" "$(echo "$A_V1" | grep -c "$ADM" | grep -q '^1$' && echo PASS || echo FAIL)"

UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/v1/students")
check "v1 without key → 401" "$( [[ "$UNAUTH" == "401" ]] && echo PASS || echo FAIL )"

rm -f "$JAR_A" "$JAR_B"
echo "──────────────────────────────"
echo "RESULT: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] && echo "TENANT ISOLATION: VERIFIED ✅" || echo "TENANT ISOLATION: FAILURES ❌"
exit "$FAIL"
