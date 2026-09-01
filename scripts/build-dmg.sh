#!/bin/bash
# Wraps a built Toolkit.app into a compressed DMG.
set -euo pipefail

project_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_directory"

version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' native/Info.plist)"
staging="dist/dmg-staging"
dmg="dist/Toolkit-$version.dmg"

[ -d dist/Toolkit.app ] || { echo "dist/Toolkit.app is missing; run scripts/build-app.sh first" >&2; exit 1; }

rm -rf "$staging" "$dmg"
mkdir -p "$staging"
cp -R dist/Toolkit.app "$staging/"
ln -s /Applications "$staging/Applications"

hdiutil create -quiet -volname Toolkit -srcfolder "$staging" -ov -format UDZO "$dmg"
rm -rf "$staging"

printf 'built %s (%s)\n' "$dmg" "$(du -h "$dmg" | cut -f1)"
