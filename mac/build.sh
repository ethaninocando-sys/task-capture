#!/bin/bash
# Builds "Task Capture.app" and installs it to ~/Applications.
# Run from the project folder:  bash mac/build.sh
set -euo pipefail

cd "$(dirname "$0")"
APP="build/Task Capture.app"
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "→ Compiling…"
swiftc -O -swift-version 5 main.swift \
  -o "$APP/Contents/MacOS/TaskCapture" \
  -framework Cocoa -framework WebKit -framework Carbon -framework ServiceManagement

cp Info.plist "$APP/Contents/Info.plist"

echo "→ Making the app icon…"
ICONSET="build/AppIcon.iconset"
mkdir -p "$ICONSET"
SRC="../public/icon-512.png"
for size in 16 32 128 256; do
  sips -z $size $size "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
cp "$SRC" "$ICONSET/icon_512x512.png"
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

echo "→ Signing (local only)…"
xattr -cr "$APP" # strip hidden Finder labels that block signing
codesign --force --deep --sign - "$APP"

echo "→ Installing to ~/Applications…"
mkdir -p "$HOME/Applications"
pkill -x TaskCapture 2>/dev/null || true
rm -rf "$HOME/Applications/Task Capture.app"
cp -R "$APP" "$HOME/Applications/"

echo "✓ Done. Open it with:  open \"$HOME/Applications/Task Capture.app\""
