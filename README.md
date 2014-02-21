privacybadgerfirefox
====================

Privacy Badger for Firefox

1.  Install addon-sdk [github](https://github.com/mozilla/addon-sdk)
2.  [Addon-sdk documentation] (https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation)
3.  cfx run

Contributing
============

Git hooks
---------

Are in `hooks/`. You can use them by copying the files to `.git/hooks`. The
pre-push hook will run the unit tests, and cancel the push if they fail.
