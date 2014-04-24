privacybadgerfirefox
====================

Privacy Badger for Firefox

1.  Install addon-sdk [github](https://github.com/mozilla/addon-sdk)
2.  [Addon-sdk documentation] (https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation)
2.  Install dependencies

    1. [toolbarwidget](https://github.com/Rob--W/toolbarwidget-jplib)
    2. [browser-action](https://github.com/Rob--W/browser-action-jplib)

    To install dependencies, create a `packages/` subdirectory of either this
    addon's root *or* the `addon-sdk/` root. `cd` into it and `git clone` the
    packages listed above.

3.  cfx run

Contributing
============

Git hooks
---------

Are in `hooks/`. You can use them by copying the files to `.git/hooks`. The
pre-push hook will run the unit tests, and cancel the push if they fail.
