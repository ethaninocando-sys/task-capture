#!/bin/bash
# Builds "Task Capture.app" (runs on Apple-chip and Intel Macs) and installs it to ~/Applications.
# Run from the project folder:  bash mac/build.sh
# Build only, without installing:  bash mac/build.sh --no-install
set -euo pipefail

cd "$(dirname "$0")"
MAC_DIR="$(pwd)"
# Build outside iCloud-synced folders (like Desktop): iCloud adds hidden labels that break signing.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/task-capture-build.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
APP="$WORK/Task Capture.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "→ Compiling for Apple chip and Intel…"
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 main.swift \
    -target "$arch-apple-macos13.0" \
    -o "$WORK/TaskCapture-$arch" \
    -framework Cocoa -framework WebKit -framework Carbon -framework ServiceManagement
done
lipo -create "$WORK/TaskCapture-arm64" "$WORK/TaskCapture-x86_64" -output "$APP/Contents/MacOS/TaskCapture"

cp Info.plist "$APP/Contents/Info.plist"

echo "→ Making the app icon…"
ICONSET="$WORK/AppIcon.iconset"
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
codesign --verify "$APP"

# Keep a zipped copy in mac/build (ditto keeps the signature and icon intact).
rm -rf "$MAC_DIR/build"
mkdir -p "$MAC_DIR/build"
ditto -c -k --keepParent "$APP" "$MAC_DIR/build/Task-Capture-Mac.zip"

if [[ "${1:-}" == "--no-install" ]]; then
  echo "✓ Built: mac/build/Task-Capture-Mac.zip"
  exit 0
fi

echo "→ Installing to ~/Applications…"
mkdir -p "$HOME/Applications"
pkill -x TaskCapture 2>/dev/null || true
rm -rf "$HOME/Applications/Task Capture.app"
ditto "$APP" "$HOME/Applications/Task Capture.app"

echo "✓ Done. Open it with:  open \"$HOME/Applications/Task Capture.app\""
