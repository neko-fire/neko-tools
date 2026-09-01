#!/bin/bash
# Builds Toolkit.app: a universal Swift binary wrapped around the static page.
set -euo pipefail

project_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_directory"

app="dist/Toolkit.app"
contents="$app/Contents"
deployment_target="12.0"

rm -rf "$app"
mkdir -p "$contents/MacOS" "$contents/Resources/static"

# One slice per architecture, so the app runs natively on Apple silicon and
# Intel. At this size a universal binary costs about 50KB.
for architecture in arm64 x86_64; do
  swiftc \
    -target "$architecture-apple-macos$deployment_target" \
    -O -whole-module-optimization \
    -o "dist/Toolkit-$architecture" \
    native/main.swift
done
lipo -create -output "$contents/MacOS/Toolkit" dist/Toolkit-arm64 dist/Toolkit-x86_64
rm -f dist/Toolkit-arm64 dist/Toolkit-x86_64
strip -rSTx "$contents/MacOS/Toolkit"
chmod +x "$contents/MacOS/Toolkit"

cp native/Info.plist "$contents/Info.plist"
cp static/index.html static/styles.css static/app.js static/toolkit-core.js "$contents/Resources/static/"
cp native/assets/icon.icns "$contents/Resources/icon.icns"
printf 'APPL????' > "$contents/PkgInfo"

# An unsigned bundle is killed by macOS as soon as it carries a quarantine
# flag. Ad-hoc signing gives it a signature of its own that validates.
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"

printf '\nbuilt %s (%s)\n' "$app" "$(du -sh "$app" | cut -f1)"
