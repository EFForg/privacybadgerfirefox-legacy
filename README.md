# Privacy Badger Firefox

## Introduction

Privacy Badger is a Firefox add-on that blocks spying ads and invisible trackers as you browse. [More info here.](https://www.eff.org/privacybadger)

## Developer guide

### Getting started

1.  Clone the Firefox Add-on SDK and checkout the latest stable release tag (currently 1.16): [github](https://github.com/mozilla/addon-sdk)
2.  Read the [Add-on SDK documentation](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation).
3.  Install dependencies

    1. [toolbarwidget](https://github.com/Rob--W/toolbarwidget-jplib)

    To install dependencies, create a `packages/` subdirectory of either this
    addon's root *or* the `addon-sdk/` root. `cd` into it and `git clone` the
    packages listed above.
4.  Once the SDK is activated, run `cfx run` to launch a clean Firefox profile with Privacy Badger installed. Run `cfx test` to run tests. `cfx xpi` creates a package (.xpi file) that you can install by loading into Firefox.

### Important directories and files

    hooks/                    Git hooks. You can use them by copying into `.git/hooks`. The pre-push hook runs tests and cancels the push if they fail.

    release-utils/            | Files for making a self-hosted release of Privacy Badger and updates that are signed with an offline private key.
    Makefile                  | You probably don't need to worry about these unless you're a project maintainer.

    package.json              |
    data/                     |
    lib/                      | Most of the code that runs in the add-on. See SDK documentation for more info on the directory structure.
    test/                     |
    defaults/                 |

    doc/                      Changelog, style guide, how to make a signed release, other documentation TBD.

### Contributing

Before you submit a pull request:

0. In general, you should develop off of 'master' unless you are making a hotfix ('stable' is the current production-ready state).
1. Make sure your code conforms to the [Style Guide](doc/style.md).
2. Reference any issues that you are fixing in the commit message.
3. Make sure the tests pass. Please add tests for any new functionality.
4. BONUS: make sure your changes are compatible with the current Firefox ESR, Beta, and Aurora releases as well as the current stable release!

## Contact

The current maintainer of this project is Yan Zhu (yan at eff dot org). There is also a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger) to discuss Privacy Badger development for both Firefox and Chrome.
