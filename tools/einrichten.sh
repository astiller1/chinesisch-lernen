#!/usr/bin/env bash
# Einrichtung auf Cloudflare in einem Rutsch (mehrfach ausführbar):
#   Worker bauen und hochladen, Access-Anwendung nur für ACCESS_EMAIL, alle Secrets setzen.
# Erwartet als Umgebungsvariablen (nie ins Repo!):
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ACCESS_EMAIL,
#   TUTOR_ANTHROPIC_KEY, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION
# Optional: APP_DOMAIN (Standard: chinesisch.jan-lab.de)
set -euo pipefail
cd "$(dirname "$0")/.."

DOMAIN="${APP_DOMAIN:-chinesisch.jan-lab.de}"
API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID:?fehlt}"
: "${CLOUDFLARE_API_TOKEN:?fehlt}" "${ACCESS_EMAIL:?fehlt}"

cf() { # cf METHOD PFAD [JSON] – bricht bei Fehlern mit der Meldung von Cloudflare ab
  local out
  out=$(curl -sS -X "$1" "$API$2" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' ${3:+--data "$3"})
  if [ "$(jq -r '.success' <<<"$out")" != "true" ]; then echo "Cloudflare-Fehler bei $1 $2: $(jq -c '.errors' <<<"$out")" >&2; exit 1; fi
  echo "$out"
}

echo "1/4 Access: Anmeldung per E-Mail-Code vorhanden?"
if [ "$(cf GET /access/identity_providers | jq '[.result[] | select(.type=="onetimepin")] | length')" = "0" ]; then
  cf POST /access/identity_providers '{"name":"E-Mail-Code","type":"onetimepin","config":{}}' >/dev/null
  echo "   E-Mail-Code-Anmeldung angelegt."
fi
TEAM=$(cf GET /access/organizations | jq -r '.result.auth_domain')
echo "   Team-Domain: $TEAM"

echo "2/4 Access-Anwendung für $DOMAIN (nur $ACCESS_EMAIL)"
APP=$(cf GET /access/apps | jq -c --arg d "$DOMAIN" '[.result[] | select(.domain==$d)][0] // empty')
POLICY=$(jq -nc --arg e "$ACCESS_EMAIL" '{name:"Nur Jan",decision:"allow",include:[{email:{email:$e}}],precedence:1}')
BODY=$(jq -nc --arg d "$DOMAIN" --argjson p "$POLICY" '{name:"Chinesisch lernen",domain:$d,type:"self_hosted",session_duration:"720h",app_launcher_visible:false,policies:[$p]}')
if [ -z "$APP" ]; then
  APP=$(cf POST /access/apps "$BODY" | jq -c '.result')
  echo "   angelegt."
else
  APP=$(cf PUT "/access/apps/$(jq -r '.id' <<<"$APP")" "$BODY" | jq -c '.result')
  echo "   aktualisiert."
fi
AUD=$(jq -r '.aud' <<<"$APP")

echo "3/4 Worker bauen und hochladen"
npm run deploy

echo "4/4 Secrets setzen"
put() { printf '%s' "$2" | npx wrangler secret put "$1" >/dev/null && echo "   $1 ✓"; }
put ACCESS_TEAM_DOMAIN "$TEAM"
put ACCESS_AUD "$AUD"
[ -n "${TUTOR_ANTHROPIC_KEY:-}" ] && put ANTHROPIC_API_KEY "$TUTOR_ANTHROPIC_KEY"
[ -n "${AZURE_SPEECH_KEY:-}" ] && put AZURE_SPEECH_KEY "$AZURE_SPEECH_KEY"
[ -n "${AZURE_SPEECH_REGION:-}" ] && put AZURE_SPEECH_REGION "$AZURE_SPEECH_REGION"

echo "Fertig: https://$DOMAIN (Anmeldung mit $ACCESS_EMAIL)"
echo "Prüfen: ohne Anmeldung muss https://$DOMAIN/api/config zur Access-Anmeldung umleiten."
