#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
APK_DIR="$PROJECT_DIR/apk"

export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
export ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

if [ ! -d "$ANDROID_DIR" ]; then
  echo "Android project not found: $ANDROID_DIR" >&2
  exit 1
fi

mkdir -p "$APK_DIR"

cd "$ANDROID_DIR"
chmod +x ./gradlew
./gradlew assembleDebug

APK_SOURCE="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="$APK_DIR/智绘阅读-debug.apk"

if [ ! -f "$APK_SOURCE" ]; then
  echo "APK not found after build: $APK_SOURCE" >&2
  exit 1
fi

cp "$APK_SOURCE" "$APK_TARGET"
echo "APK copied to: $APK_TARGET"
