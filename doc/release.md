# Instructions on making self-hosted and signed releases

The folowing are instructions to make a signed and self-hosted release of Privacy Badger. The hash of the XPI file you plan to release is fed into an airgapped machine containing the signing key. The airgapped machine generates a signed update.rdf file as a QR code, which you can scan with a phone and upload to Pastebin.

## Prerequisites
* Addon SDK and other dependences in README.md
* GPG key for yourself
* An airgapped signing key for Privacy Badger. TODO: Add instructions on how to generate.
* An airgapped machine with scripts to generate signed update.rdf files. TODO: Add templates for these.
* An device that can scan and upload QR codes to pastebin (I use Barcode Scanner on Android).
* [OPTIONAL] Festival, for reading hashes out loud.

## Steps
1. Get the extension into a satisfactory state.
2. Make sure you have the latest stable version of the Mozilla Add-on SDK and that this variable is correctly set in release-utils/make-signed-xpi.sh.
3. Update doc/Changelog with release notes and package.json with the correct release number.
4. Create a gpg-signed release tag with the version number (ex: 0.1) and push the tags.
5. From the root of the git directory, run `make <version>`.
6. While make is running, to your airgapped signing machine and edit the RDF template to have the correct min and max installable versions (corresponding to the Addon SDK version that you are using). TODO: output this in the make scripts.
7. Run your signing script on the airgapped machine, ex: `./sign.sh $HASH $VERSION`. Check the metahash for confirmation if your signing script produces one.
8. When your signing script generates a QR code, scan it with your phone (or other device) and upload it to Pastebin.
9. Feed the Pastebin ID (the path at the end of the URL) into the `make` process.
10. Once that is done you should have your finished XPI and update.rdf in release-utils/pkg.
