#!/usr/bin/env bash
# railway-status.sh — Read-only health report of the production Railway project.
#
# Usage:
#   RAILWAY_TOKEN="<project token>" ./scripts/railway-status.sh [expected-commit-sha]
#
# Reports, per service (api, web-admin, web-public):
#   - where Railway builds it from (GitHub repo or image) and the latest deployments
#     with their commit, so you can tell whether main has reached production;
# and for the API only:
#   - the values of non-secret operational flags (RUN_MIGRATIONS, reminders, ...);
#   - which other variables are set (names only — values are never printed);
#   - startup log lines for migrations, FCM, Chromium and e-mail (redacted).
#
# Safety:
#   - Only GraphQL queries — no mutations, nothing is changed on Railway.
#   - Never prints the token or any variable value outside VALUE_ALLOW_LIST.
#   - E-mail addresses and URLs in log lines are masked (password-reset links
#     carry tokens).

set -euo pipefail

API_URL="${RAILWAY_API_URL:-https://backboard.railway.com/graphql/v2}"
TOKEN="${RAILWAY_TOKEN:-}"
EXPECTED_SHA="${1:-}"
SERVICES=(api web-admin web-public)

# Non-secret flags whose values are safe to print.
VALUE_ALLOW_LIST=(
  RUN_MIGRATIONS NODE_ENV LOG_FORMAT OTP_PROVIDER CHROMIUM_PATH
  INSTALLMENT_REMINDERS_ENABLED INSTALLMENT_REMINDER_CRON INSTALLMENT_REMINDER_DAYS_BEFORE
  INSTALLMENT_REMINDER_TIMEZONE APPOINTMENT_REMINDERS_ENABLED APPOINTMENT_REMINDER_TIMEZONE
  CHAT_RETENTION_ENABLED SENTRY_ENVIRONMENT PUBLIC_WEB_URL PLATFORM_BASE_DOMAIN SMTP_HOST SMTP_PORT
  FIREBASE_PROJECT_ID
)

# Variables the API needs for each feature (presence is checked, value is not printed).
REQUIRED_GROUPS=(
  "database:DATABASE_URL"
  "auth:JWT_ACCESS_SECRET JWT_REFRESH_SECRET"
  "push (FCM):FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY"
  "e-mail (SMTP):SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM"
  "public endpoints:DEFAULT_COMPANY_ID"
)

# Log searches: label|filter. Matching lines are printed (redacted).
LOG_SEARCHES=(
  "migrations|[entrypoint]"
  "push (FCM)|FCM"
  "PDF (Chromium)|Chromium"
  "e-mail|email"
  "reminders|reminder"
)

if [[ -z "$TOKEN" ]]; then
  echo "::error::RAILWAY_TOKEN is empty — the secret is not set for this repository/environment."
  exit 1
fi

# gql <query> [variables-json] — prints the JSON response; exits non-zero on transport errors.
gql() {
  local body vars="${2:-}"
  [[ -n "$vars" ]] || vars='{}'
  body=$(jq -n --arg q "$1" --argjson v "$vars" '{query: $q, variables: $v}')
  curl -sS --fail-with-body -m 30 -X POST "$API_URL" \
    -H 'Content-Type: application/json' \
    -H "Project-Access-Token: $TOKEN" \
    -d "$body"
}

# Prints GraphQL errors (if any) and returns 1 when the response has them.
check_errors() {
  local resp="$1" ctx="$2"
  if jq -e '.errors | length > 0' >/dev/null 2>&1 <<<"$resp"; then
    echo "  ! $ctx failed: $(jq -r '[.errors[].message] | join("; ")' <<<"$resp")"
    return 1
  fi
}

redact() {
  sed -E \
    -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/<email>/g' \
    -e 's#https?://[^ "]+#<url>#g'
}

echo "== Token"
resp=$(gql 'query { projectToken { projectId environmentId } }') || {
  echo "::error::Railway API rejected the request: $resp"
  exit 1
}
if ! check_errors "$resp" "projectToken"; then
  echo "::error::RAILWAY_TOKEN is not a valid project token (expired, revoked, or an account token)."
  exit 1
fi
PROJECT_ID=$(jq -r '.data.projectToken.projectId' <<<"$resp")
ENV_ID=$(jq -r '.data.projectToken.environmentId' <<<"$resp")

resp=$(gql 'query($p: String!) { project(id: $p) { name
  environments { edges { node { id name } } }
  services { edges { node { id name } } } } }' "$(jq -n --arg p "$PROJECT_ID" '{p: $p}')")
check_errors "$resp" "project" || exit 1
echo "  project: $(jq -r '.data.project.name' <<<"$resp")"
echo "  environment: $(jq -r --arg e "$ENV_ID" '.data.project.environments.edges[].node | select(.id == $e) | .name' <<<"$resp")"
echo "  services: $(jq -r '[.data.project.services.edges[].node.name] | join(", ")' <<<"$resp")"
SERVICES_JSON=$(jq -c '[.data.project.services.edges[].node]' <<<"$resp")

API_SERVICE_ID=""
API_DEPLOYMENT_ID=""

for svc in "${SERVICES[@]}"; do
  echo
  echo "== Service: $svc"
  sid=$(jq -r --arg n "$svc" '.[] | select(.name == $n) | .id' <<<"$SERVICES_JSON")
  if [[ -z "$sid" ]]; then
    echo "  ! no service named '$svc' in this project"
    continue
  fi
  vars=$(jq -n --arg s "$sid" --arg e "$ENV_ID" --arg p "$PROJECT_ID" '{s: $s, e: $e, p: $p}')

  resp=$(gql 'query($s: String!, $e: String!) { serviceInstance(serviceId: $s, environmentId: $e) {
    source { repo image } } }' "$vars") || true
  if check_errors "$resp" "serviceInstance"; then
    echo "  builds from: repo=$(jq -r '.data.serviceInstance.source.repo // "-"' <<<"$resp")" \
      "image=$(jq -r '.data.serviceInstance.source.image // "-"' <<<"$resp")"
  fi

  resp=$(gql 'query($s: String!, $e: String!, $p: String!) {
    deployments(first: 5, input: { projectId: $p, environmentId: $e, serviceId: $s }) {
      edges { node { id status createdAt meta } } } }' "$vars") || true
  if check_errors "$resp" "deployments"; then
    echo "  latest deployments:"
    jq -r '.data.deployments.edges[].node
      | "    \(.createdAt)  \(.status)  commit=\(.meta.commitHash // "-" | .[0:7])  \(.meta.commitMessage // .meta.image // "" | split("\n")[0] | .[0:70])"' <<<"$resp"
    if [[ -n "$EXPECTED_SHA" ]]; then
      live=$(jq -r '[.data.deployments.edges[].node | select(.status == "SUCCESS")][0].meta.commitHash // ""' <<<"$resp")
      if [[ -z "$live" ]]; then
        echo "  main ($EXPECTED_SHA): cannot tell — the live deployment has no commit (image or CLI deploy)"
      elif [[ "$live" == "$EXPECTED_SHA" ]]; then
        echo "  main ($EXPECTED_SHA): LIVE"
      else
        echo "  main ($EXPECTED_SHA): NOT live — production runs ${live:0:7}"
      fi
    fi
    if [[ "$svc" == "api" ]]; then
      API_SERVICE_ID="$sid"
      API_DEPLOYMENT_ID=$(jq -r '[.data.deployments.edges[].node | select(.status == "SUCCESS")][0].id // ""' <<<"$resp")
    fi
  fi
done

[[ -n "$API_SERVICE_ID" ]] || exit 0

echo
echo "== API variables"
resp=$(gql 'query($s: String!, $e: String!, $p: String!) {
  variables(projectId: $p, environmentId: $e, serviceId: $s) }' \
  "$(jq -n --arg s "$API_SERVICE_ID" --arg e "$ENV_ID" --arg p "$PROJECT_ID" '{s: $s, e: $e, p: $p}')") || true
if check_errors "$resp" "variables"; then
  VARS=$(jq -c '.data.variables' <<<"$resp")
  for name in "${VALUE_ALLOW_LIST[@]}"; do
    echo "  $name = $(jq -r --arg n "$name" '.[$n] // "(not set)"' <<<"$VARS")"
  done
  echo "  required by feature:"
  for group in "${REQUIRED_GROUPS[@]}"; do
    label="${group%%:*}"
    missing=()
    for name in ${group#*:}; do
      jq -e --arg n "$name" '.[$n] // "" | length > 0' >/dev/null <<<"$VARS" || missing+=("$name")
    done
    if [[ ${#missing[@]} -eq 0 ]]; then
      echo "    $label: OK"
    else
      echo "    $label: MISSING ${missing[*]}"
    fi
  done
  echo "  all variable names: $(jq -r 'keys | join(" ")' <<<"$VARS")"
fi

if [[ -z "$API_DEPLOYMENT_ID" ]]; then
  echo
  echo "== API logs: no successful deployment found"
  exit 0
fi

echo
echo "== API logs (live deployment ${API_DEPLOYMENT_ID:0:8})"
for search in "${LOG_SEARCHES[@]}"; do
  label="${search%%|*}"
  filter="${search#*|}"
  resp=$(gql 'query($d: String!, $f: String) { deploymentLogs(deploymentId: $d, limit: 20, filter: $f) {
    timestamp message } }' "$(jq -n --arg d "$API_DEPLOYMENT_ID" --arg f "$filter" '{d: $d, f: $f}')") || true
  echo "  -- $label"
  check_errors "$resp" "logs" || continue
  lines=$(jq -r '.data.deploymentLogs[] | "    \(.timestamp[0:19])  \(.message | .[0:200])"' <<<"$resp" | redact)
  echo "${lines:-    (no matching lines)}"
done
