#!/bin/sh
set -e
cd "`dirname $0`"

APP_NAME=privacybadgerfirefox
# Auto-generated XPI name from 'cfx xpi'
PRE_XPI_NAME="$APP_NAME.xpi"

if ! [ -x `which cfx` ] ; then
  echo "Please activate the Firefox Addon SDK before running this script."
  exit 1
fi

if [ $# -ne 1 ] ; then
  echo "Usage: $0 <version to release>"
  exit 1
fi

# Final XPI name
XPI_NAME="$APP_NAME-$1.xpi"

[ -d pkg ] || mkdir pkg

# Build the unsigned XPI and unzip it
cfx xpi
unzip -d pkg $PRE_XPI_NAME
rm $PRE_XPI_NAME

# Customize install.rdf with our updateKey and URL
sed -i 's@</RDF>@\n@g' pkg/install.rdf
cat install-template.rdf >> pkg/install.rdf

