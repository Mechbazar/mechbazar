#!/usr/bin/env bash
#
# Provision a Linux host to run `eas build --platform android --local`.
#
# Fixes this failure, which EAS reports only as the useless
# "Gradle build failed with unknown error":
#
#   > Failed to apply plugin 'com.facebook.react.rootproject'.
#      > A problem occurred configuring project ':app'.
#         > SDK location not found. Define a valid SDK location with an
#           ANDROID_HOME environment variable or by setting the sdk.dir path
#           in ... android/local.properties
#
# The cause is exactly what it says: no Android SDK and no ANDROID_HOME. EAS
# does not install a toolchain for you on a local build -- it only does that on
# its own cloud workers.
#
# Idempotent: safe to re-run. Verified against Ubuntu 24.04 (the VPS) and
# Ubuntu 26.04 (WSL).
#
# Usage:
#   sudo bash deploy/provision-android-build.sh
#   # then, in a NEW shell so /etc/profile.d is picked up:
#   cd /opt/mechbazar/apps/admin-mobile
#   eas build --platform android --profile preview --local

set -euo pipefail

SDK_ROOT=/opt/android-sdk
JAVA_PKG=openjdk-17-jdk-headless
JAVA_DIR=/usr/lib/jvm/java-17-openjdk-amd64

# Versions are pinned to what this project's Gradle actually asks for. They are
# printed by the build itself under "[ExpoRootProject] Using the following
# versions:" -- keep them in sync if that output changes.
SDK_PLATFORM="platforms;android-36"
SDK_BUILD_TOOLS="build-tools;36.0.0"
SDK_NDK="ndk;27.1.12297006"
SDK_CMAKE="cmake;3.22.1"

[ "$(id -u)" -eq 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }

echo "=== 1/5 installing JDK + tools ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq "$JAVA_PKG" unzip curl
java -version 2>&1 | head -1

echo "=== 2/5 installing Android command-line tools ==="
if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  ZIP_URL=""
  for v in 13114758 12266719 11076708; do
    url="https://dl.google.com/android/repository/commandlinetools-linux-${v}_latest.zip"
    code=$(curl -sSI -o /dev/null -w '%{http_code}' --max-time 30 "$url" || echo 000)
    echo "  candidate $v -> HTTP $code"
    [ "$code" = "200" ] && { ZIP_URL="$url"; break; }
  done
  [ -n "$ZIP_URL" ] || { echo "FATAL: no cmdline-tools URL reachable" >&2; exit 1; }

  mkdir -p "$SDK_ROOT/cmdline-tools"
  curl -sSL --max-time 900 -o /var/tmp/cmdline-tools.zip "$ZIP_URL"
  rm -rf /var/tmp/cmdline-unzip && mkdir -p /var/tmp/cmdline-unzip
  unzip -q /var/tmp/cmdline-tools.zip -d /var/tmp/cmdline-unzip
  mv /var/tmp/cmdline-unzip/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
  rm -rf /var/tmp/cmdline-unzip /var/tmp/cmdline-tools.zip
else
  echo "  already present, skipping download"
fi

export JAVA_HOME="$JAVA_DIR"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$JAVA_HOME/bin:$PATH"
sdkmanager --version

echo "=== 3/5 accepting licenses ==="
# Without this the build dies later with "You have not accepted the license
# agreements", which is just as opaque as the SDK-location error.
yes | sdkmanager --licenses >/dev/null 2>&1 || true

echo "=== 4/5 installing SDK packages (a few GB, several minutes) ==="
# The NDK and CMake are needed because expo-modules-core and
# react-native-screens compile C++. AGP will fetch them mid-build if absent,
# but doing it here keeps the build itself deterministic and quiet.
sdkmanager --install \
  "platform-tools" \
  "$SDK_PLATFORM" \
  "$SDK_BUILD_TOOLS" \
  "$SDK_NDK" \
  "$SDK_CMAKE" 2>&1 | tail -3

echo "=== 5/5 persisting environment ==="
cat > /etc/profile.d/android-sdk.sh <<EOF
# Android toolchain for \`eas build --local\` / gradlew.
export JAVA_HOME=$JAVA_DIR
export ANDROID_HOME=$SDK_ROOT
export ANDROID_SDK_ROOT=$SDK_ROOT
export ANDROID_NDK_HOME=$SDK_ROOT/ndk/${SDK_NDK#ndk;}
export PATH="\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$JAVA_HOME/bin:\$PATH"
EOF
chmod 0644 /etc/profile.d/android-sdk.sh

# Login shells read profile.d; interactive non-login shells read .bashrc. Cover
# both so `eas build --local` sees ANDROID_HOME however the shell was started.
if ! grep -q 'android-sdk.sh' /root/.bashrc 2>/dev/null; then
  printf '\n. /etc/profile.d/android-sdk.sh\n' >> /root/.bashrc
fi

echo
echo "=== done ==="
bash -lc 'echo "JAVA_HOME=$JAVA_HOME"; echo "ANDROID_HOME=$ANDROID_HOME"; echo "ANDROID_NDK_HOME=$ANDROID_NDK_HOME"; ls "$ANDROID_HOME"'
echo
echo "Open a NEW shell (or run: . /etc/profile.d/android-sdk.sh), then:"
echo "  cd /opt/mechbazar/apps/admin-mobile"
echo "  eas build --platform android --profile preview --local"
