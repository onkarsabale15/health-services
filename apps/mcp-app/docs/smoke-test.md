# mcp-app — testing the MCP Streamable HTTP server

End-to-end check that the server boots, lists the generated catalog, and
round-trips a real EHR. The transport is **MCP Streamable HTTP** (JSON-RPC
2.0) at `POST /api/mcp` — the spec-compliant endpoint any MCP HTTP client
(Claude Code, Gemini CLI, custom agents) connects to.

Auth mirrors a bridge-api **system** call: a platform **API token** in
`Authorization: Bearer` (verified against the platform JWKS) plus an
**`X-Site-Id`** header naming the scope. The token carries identity + the
app's granted EHRs; the site (vendor, URLs, creds) is resolved server-side and
checked against the token's org + grants. The client never sends credentials.

## Prerequisites

1. **Redis** running locally (the EHR OAuth token cache). `REDISURL` points at it.
2. **admin-api** running at `http://localhost:3002` — it mints the API token and
   mcp-app resolves the site through it. Both share `HS_PLATFORM_JWKS`.
3. **An MCP application** (created in admin-ui):
   - App type **MCP** (system / `client_credentials` only).
   - A **Cerner** EHR granted in **system** launch mode, with working Cerner
     sandbox credentials, and at least one **site** (`EhrSiteConfig.id`).
   - Note the app's **`client_id`** and **`client_secret`** and the **`siteId`**.
4. **Doppler auth** (or the secrets in env) so `bootstrapNestApp` can load
   `REDISURL` + `HS_PLATFORM_JWKS`.

> The MCP app's token has `app_type: 'MCP'`. bridge-api rejects it (its
> allow-list is BRIDGE/CDS/WORKFLOW) and mcp-app rejects any non-MCP token —
> the two surfaces don't share tokens.

## Get an API token

`client_credentials` against admin-api's token endpoint:

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET"}' \
  | jq -r .access_token)

SITE_ID='YOUR-CERNER-SITE-UUID'
```

The token expires (default 1h) — re-mint it when calls start returning
`401 Invalid or expired token`.

## Boot

```bash
npx turbo build --filter=@hs/mcp-app    # runs gen:tools → 34 Cerner tools
npm run dev                              # starts mcp-app (port 3005) + siblings
# or just mcp-app:  node apps/mcp-app/dist/main.js   (with env / Doppler auth)
```

Boot log should show: `MCP catalog loaded { tools: 34, vendors: 1 }`.

## Test with Claude Code

```bash
claude mcp add --transport http health-services http://localhost:3005/api/mcp \
  --header "Authorization: Bearer $TOKEN" \
  --header "X-Site-Id: $SITE_ID"

claude
> /mcp                       # shows the health-services server + its tools (expect 34)
> Using the health-services tools, read Cerner patient 12724066 and summarize their conditions.
```

Claude drives initialize + `tools/list` + `tools/call` itself. Re-run
`claude mcp add` with a fresh `$TOKEN` if the token expires.

## Test with Gemini CLI

Add the server to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "health-services": {
      "httpUrl": "http://localhost:3005/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN",
        "X-Site-Id": "YOUR-CERNER-SITE-UUID"
      },
      "timeout": 30000
    }
  }
}
```

```bash
gemini
> /mcp            # lists configured MCP servers + their tools (expect 34 under health-services)
> /mcp desc       # tool descriptions (the @mcptool TSDoc)
> Using the health-services tools, read Cerner patient 12724066 and summarize their conditions.
```

## Test with curl (debugging)

Streamable HTTP is **stateful**: `initialize` returns an `Mcp-Session-Id`
header you echo on every later request. Every request also carries the bearer
token **and** `X-Site-Id`.

```bash
H_ACCEPT='Accept: application/json, text/event-stream'
AUTH="Authorization: Bearer $TOKEN"
SITE="X-Site-Id: $SITE_ID"

# 0. health (no api prefix — excluded)
curl -s http://localhost:3005/health | jq .

# 1. initialize — note the Mcp-Session-Id RESPONSE header (-D - dumps headers)
curl -sD - -o /dev/null -X POST http://localhost:3005/api/mcp \
  -H "$AUTH" -H "$SITE" -H 'Content-Type: application/json' -H "$H_ACCEPT" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}' \
  | grep -i '^mcp-session-id:'

SID='<paste-the-uuid-from-above>'

# 2. tools/list — expect 34
curl -s -X POST http://localhost:3005/api/mcp \
  -H "$AUTH" -H "$SITE" -H 'Content-Type: application/json' -H "$H_ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | jq '.result.tools | length'

# 3. read a patient (known sandbox Patient ID)
curl -s -X POST http://localhost:3005/api/mcp \
  -H "$AUTH" -H "$SITE" -H 'Content-Type: application/json' -H "$H_ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"cerner_getPatient","arguments":{"id":"PATIENT-ID"}}}' | jq .

# 4. malformed input → JSON-RPC error, NO EHR call (generated Ajv guard)
curl -s -X POST http://localhost:3005/api/mcp \
  -H "$AUTH" -H "$SITE" -H 'Content-Type: application/json' -H "$H_ACCEPT" \
  -H "Mcp-Session-Id: $SID" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"cerner_getPatient","arguments":{}}}' | jq .
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `404` | Wrong path — the endpoint is `POST /api/mcp` (the `api` prefix is added by bootstrap). |
| `404 Session not found — reinitialize` | The `Mcp-Session-Id` is unknown/expired (e.g. server restarted) — re-send `initialize`; clients do this automatically. |
| `401 Missing or invalid bearer token` | No `Authorization: Bearer` header. |
| `401 X-Site-Id header is required` | Add the `X-Site-Id` header — the scope is no longer in the token. |
| `401 Invalid or expired token` | Token failed JWKS verification or expired — re-mint via `/oauth/token`. |
| `401 App type '…' is not authorized for the MCP server` | The token isn't from an **MCP** app. Use an MCP-type app's `client_id`/`client_secret`. |
| `401 Site does not belong to your organization` | The `X-Site-Id` belongs to another org than the token. |
| `403 Application is not granted access to EHR '…'` | Grant that EHR to the MCP app in admin-ui (system launch mode). |
| `406 Not Acceptable` | Add `Accept: application/json, text/event-stream` (the Streamable HTTP transport requires it). |
| Empty `tools` list | The site's `ehrName` isn't `cerner` (resolved from SiteData); only Cerner tools exist today. |
| `Site not found: <id>` | `siteId` not in the DB / not accessible. Verify in admin-ui or `SELECT id FROM ehr_site_configs;`. |
| Boot fails loading secrets | Doppler auth missing, or `REDISURL`/`HS_PLATFORM_JWKS` unavailable. |
| EHR `401` / token error | Site's Cerner creds invalid, or stale token cache — `redis-cli FLUSHDB` and retry. |
