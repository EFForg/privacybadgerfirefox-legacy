#!/bin/sh
set -e
cd "`dirname $0`"

APP_NAME=privacybadger
# Auto-generated XPI name from 'cfx xpi'
PRE_XPI_NAME="$APP_NAME.xpi"
LATEST_SDK_VERSION=1.0.1
RDF_NAME=xpi/install.rdf

if ! type jpm > /dev/null; then
  echo "Please install jpm before running this script."
  exit 1
fi

if ! jpm --version | grep -q "$LATEST_SDK_VERSION"; then
    echo "Please use the latest stable SDK version or edit this script to the current version."
    exit 1
fi

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi

# Final XPI name
XPI_NAME="privacy-badger-eff-$1.xpi"

rm -rf xpi/
mkdir xpi

# Build the unsigned XPI and unzip it
echo "Running jpm xpi"
jpm -b `which firefox` xpi
unzip -q -d xpi "$PRE_XPI_NAME"
rm "$PRE_XPI_NAME"

# Customize install.rdf with our updateKey and URL
sed -i 's,<em:id>jid1-MnnxcxisBPnSXQ@jetpack</em:id>,<em:id>jid1-MnnxcxisBPnSXQ-eff@jetpack</em:id>,' $RDF_NAME
sed -i ':a;N;$!ba;s@</Description>\n</RDF>@\n@g' $RDF_NAME
cat install-template.rdf >> $RDF_NAME
cp -r ../META-INF xpi

# Rezip the XPI
rm -f "$XPI_NAME"
cd xpi
zip -q -X -9r "$XPI_NAME" .

echo "Created $XPI_NAME in $(pwd)"

# Move it to the canonical location
mkdir -p ../pkg
mv "$XPI_NAME" ../pkg/
