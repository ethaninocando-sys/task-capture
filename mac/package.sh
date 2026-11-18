#!/bin/bash
# Makes the download file for other people: mac/build/Task-Capture-Mac.zip
# Run from the project folder:  bash mac/package.sh
# Then attach the zip to a GitHub Release (see README → "Share the Mac popup").
set -euo pipefail

cd "$(dirname "$0")"
bash build.sh --no-install

VERSION=$(/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" Info.plist)
ZIP="build/Task-Capture-Mac.zip" # made by build.sh

echo "✓ Download file ready (version $VERSION): mac/$ZIP"
echo "  Size: $(du -h "$ZIP" | cut -f1)"
