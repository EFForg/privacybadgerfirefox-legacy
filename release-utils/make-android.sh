#!/bin/sh
set -e
cd "`dirname $0`"

ANDROID_APP_ID=org.mozilla.firefox
LATEST_SDK_VERSION=1.16

if ! type cfx > /dev/null; then
  echo "Please activate the Firefox Addon SDK before running this script."
  exit 1
fi

if ! cfx --version | grep -q "$LATEST_SDK_VERSION"; then
    echo "Please use the latest stable SDK version or edit this script to the current version."
    exit 1
fi

# Final XPI name
XPI_NAME="privacy-badger-android.xpi"

# Build the android XPI
echo "Running cfx xpi"
cfx xpi --force-mobile --output-file=$XPI_NAME

ANDROID_APP_ID=org.mozilla.firefox

echo >&2 "Created $XPI_NAME"

# Push to Android Firefox
echo Pushing "$XPI_NAME" to /sdcard/"$XPI_NAME"
adb push "$XPI_NAME" /sdcard/"$XPI_NAME"
adb shell am start -a android.intent.action.VIEW \
                   -c android.intent.category.DEFAULT \
                   -d file:///mnt/sdcard/"$XPI_NAME" \
                   -n $ANDROID_APP_ID/.App
