# Privacy Badger Firefox

## Introduction

Privacy Badger is a Firefox add-on that blocks spying ads and invisible trackers as you browse. [More info here.](https://www.eff.org/privacybadger)

## Developer guide

### Getting started

1.  Clone the Firefox Add-on SDK and checkout the latest stable release tag (currently 1.16): [github](https://github.com/mozilla/addon-sdk)
2.  Read the [Add-on SDK documentation](https://developer.mozilla.org/en-US/Add-ons/SDK/Tutorials/Installation).
3.  Once the SDK is activated, run `cfx run` to launch a clean Firefox profile with Privacy Badger installed. Run `cfx test` to run tests. `cfx xpi` creates a package (.xpi file) that you can install by loading into Firefox.

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

Before you submit a pull request please consult the [CONTRIBUTING.md](./CONTRIBUTING.md) file.

## How heuristic blocking works

This is a rough summary of Privacy Badger's internal logic for blocking trackers. At the moment, "tracker" == "third-party cookie from a site that tracks you on multiple first-party origins." I am in the process of adding support for other non-cookie tracker types (local storage, etags, cache hits, etc.).

Privacy Badger uses a (relatively-simple) heuristic algorithm for deciding whether a third-party is tracking you. When Privacy Badger sees a third-party request on a website, it checks:

1. Does the third-party read a cookie? If not, don't count it in the blocking heuristic. Otherwise:
2. Is the cookie sufficiently high-entropy? If not, don't count it. (Currently the entropy calculation is *very* crude! See lib/heuristicBlocker.js.) Otherwise:
3. Has the base domain (eTLD+1) of the third-party read cookies on at least 3 first-party base domains? If not, don't block it (for now). Otherwise:
4. Has the third party posted an acceptable DNT policy? (We check this using an XML HTTP Request to a well-known path where we are asking sites to post statements of [compliance with DNT](https://www.eff.org/dnt-policy).) If so, don't block it. Otherwise:
5. Is the third party or its base domain on a preloaded whitelist of sites to not block because it would probably cause the first-party site to break? If so, block it from reading cookies in a third-party context. Otherwise:
6. Block third-party requests from the third-party entirely.

In addition, Privacy Badger will block third-party cookies from sites whose base domains have been blocked or cookie-blocked.

Note that users can manually set domains to be unblocked (green), cookie-blocked (yellow), or red (blocked). These choices *always* override the heuristic blocker.

By default, Privacy Badger sends the Do Not Track header on all requests. It also clears the referer for all requests that are cookie-blocked.

## Contact

The current maintainer of this project is Yan Zhu (yan at eff dot org). There is also a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger) to discuss Privacy Badger development for both Firefox and Chrome.
