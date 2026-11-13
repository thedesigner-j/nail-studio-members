#!/usr/bin/env bash
# Runs the app on this computer against a LOCAL Supabase database (in Docker).
# Nothing here talks to a hosted Supabase project. Safe to run every time:
#
#   npm run local
#
# It checks the tools, makes sure .env.local points at the local database
# (moving any real keys aside, never deleting them), installs dependencies
# when needed, starts local Supabase, then starts the app.
set -euo pipefail
cd "$(dirname "$0")/.."

SUPABASE_CLI="supabase@3.1.0"
LOCAL_URL="http://127.0.0.1:54321"

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mSTOPPED: %s\033[0m\n\n' "$1" >&2; exit 1; }

# 1. Tools ------------------------------------------------------------------
command -v node >/dev/null 2>&1 \
  || fail "Node.js isn't installed. Install the LTS version from https://nodejs.org, then run 'npm run local' again."
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] \
  || fail "Node.js $(node -v) is too old for this app (it needs 20 or newer). Install the LTS version from https://nodejs.org, then run 'npm run local' again."
command -v docker >/dev/null 2>&1 \
  || fail "Docker isn't installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/, open it, then run 'npm run local' again."
docker info >/dev/null 2>&1 \
  || fail "Docker Desktop isn't running. Open Docker Desktop, wait until it says 'Engine running', then run 'npm run local' again."

# 2. .env.local -------------------------------------------------------------
if [ -f .env.local ] && ! grep -q "^NEXT_PUBLIC_SUPABASE_URL=${LOCAL_URL}\$" .env.local; then
  backup=".env.hosted.backup"
  [ -e "$backup" ] && backup=".env.hosted.backup.$(date +%Y%m%d-%H%M%S)"
  mv .env.local "$backup"
  say "Your old .env.local (with your real keys) is saved as $backup. Nothing was deleted."
fi
if [ ! -f .env.local ]; then
  # Standard keys every local Supabase install uses. Not secrets: they only
  # work against the database running on this computer.
  cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
  say "Created .env.local pointing at the local database."
fi

# 3. Dependencies (only when they changed) ----------------------------------
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  say "Installing the app's dependencies (a minute or two)..."
  npm install
fi

# 4. Local Supabase ---------------------------------------------------------
say "Starting the local database. The very first time this downloads a few GB and can take 5-15 minutes..."
# Skip services this app doesn't use locally (logs/analytics, edge functions,
# image resizing, connection pooler): faster first download, less memory.
npx --yes "$SUPABASE_CLI" start -x logflare,vector,edge-runtime,imgproxy,supavisor

# 5. The app ----------------------------------------------------------------
say "Starting the app. Open http://localhost:3000 and sign in with admin@example.com / password123"
say "Leave this window open while you use the app. Press Control+C here to stop it."
exec npm run dev
