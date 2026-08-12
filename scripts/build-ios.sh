#!/usr/bin/env bash
#
# Generate, verify, archive and export the iOS app — one command, on macOS.
#
#   ./scripts/build-ios.sh                     # archive + export an App Store .ipa
#   ./scripts/build-ios.sh development         # a build for your own devices
#   ./scripts/build-ios.sh --archive-only      # stop after the archive
#
# ⚠️ WHY THIS EXISTS. Everything up to the archive is verified in CI and on
# Linux: the project generates, `pod install` resolves, and `npm run ios:verify`
# checks 20+ properties of the result. The last three steps — compile, archive,
# export — cannot run anywhere but macOS, because the iOS SDK ships only with
# Xcode. That was measured, not assumed: Swift for Linux parses every source in
# this project, and then `-typecheck` fails with "no such module 'UIKit'" and
# `-target arm64-apple-ios` fails with "unable to load standard library".
#
# So those three steps stay manual by necessity — but they do not have to be
# THREE steps, or require knowing xcodebuild's flags. This is one command.
#
# It sets no signing identity of its own: signing uses the project's automatic
# signing and your Xcode account. Set IOS_DEVELOPMENT_TEAM to script the team
# (see docs/native-shells.md).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

METHOD="app-store-connect"
ARCHIVE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --archive-only) ARCHIVE_ONLY=1 ;;
    development|ad-hoc|enterprise|app-store-connect) METHOD="$arg" ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# ── Refuse to pretend ────────────────────────────────────────────────────────
# A script that "succeeds" on a machine that cannot build is worse than one that
# does not run: it turns a clear environment error into a mysterious missing
# artifact later.
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✗ This needs macOS. The iOS SDK ships only with Xcode." >&2
  echo "  Everything that CAN run elsewhere already does — see npm run ios:verify." >&2
  exit 1
fi
if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "✗ xcodebuild not found. Install Xcode from the App Store, then:" >&2
  echo "    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

WORKSPACE="ios/App/App.xcworkspace"
SCHEME="App"
BUILD_DIR="$REPO_ROOT/build/ios"
ARCHIVE="$BUILD_DIR/CharitMe.xcarchive"

echo "▶ 1/4  Generating and preparing the Xcode project"
npm run ios:sync

echo "▶ 2/4  Verifying the generated project"
# Deliberately BEFORE the archive. Every check here catches something that would
# otherwise surface as a launch crash or an App Store Connect rejection — i.e.
# after a build that appeared to succeed.
npm run ios:verify

echo "▶ 3/4  Archiving (Release)"
mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE"
xcodebuild archive \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGN_STYLE=Automatic

if [[ ! -d "$ARCHIVE" ]]; then
  echo "✗ No archive was produced at $ARCHIVE" >&2
  exit 1
fi

if [[ "$ARCHIVE_ONLY" == "1" ]]; then
  echo
  echo "✅ Archive at $ARCHIVE"
  echo "   Open Xcode → Window → Organizer to distribute it."
  exit 0
fi

echo "▶ 4/4  Exporting an .ipa ($METHOD)"
OPTS="$BUILD_DIR/ExportOptions.plist"
cat > "$OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>${METHOD}</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<!-- Symbols go to Apple so crash reports are readable; the app itself is a
	     WebView shell, so there is nothing proprietary in them. -->
	<key>uploadSymbols</key>
	<true/>
	<!-- Off on purpose: bitcode is deprecated and Xcode 14+ rejects it. -->
	<key>compileBitcode</key>
	<false/>
$(if [[ -n "${IOS_DEVELOPMENT_TEAM:-}" ]]; then printf '\t<key>teamID</key>\n\t<string>%s</string>\n' "$IOS_DEVELOPMENT_TEAM"; fi)
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OPTS" \
  -exportPath "$BUILD_DIR/export"

IPA="$(find "$BUILD_DIR/export" -name '*.ipa' -maxdepth 1 | head -1)"
if [[ -z "$IPA" ]]; then
  echo "✗ Export finished but produced no .ipa — check the log above." >&2
  exit 1
fi

echo
echo "✅ $IPA"
echo
echo "Upload with either:"
echo "  xcrun altool --upload-app -f \"$IPA\" -t ios -u <apple-id> -p <app-specific-password>"
echo "  # or Xcode → Window → Organizer → Distribute App"
