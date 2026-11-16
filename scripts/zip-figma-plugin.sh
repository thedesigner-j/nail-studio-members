#!/usr/bin/env bash
# Packs figma-plugin/ into the zip the admin page offers for download
# (Admin > Trace > "Download the Figma plugin"). Run after editing the plugin:
#   npm run plugin:zip
set -euo pipefail
cd "$(dirname "$0")/.."
out="public/downloads/nail-studio-trace-export.zip"
tmp="$(mktemp -d)"
mkdir -p "$tmp/nail-studio-trace-export" public/downloads
cp figma-plugin/manifest.json figma-plugin/code.js figma-plugin/ui.html "$tmp/nail-studio-trace-export/"
rm -f "$out"
(cd "$tmp" && zip -q -r -X "$OLDPWD/$out" nail-studio-trace-export)
rm -rf "$tmp"
echo "Wrote $out"
