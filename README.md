<<<<<<< HEAD
Privacy Badger [![Build Status](https://travis-ci.org/EFForg/privacybadgerchrome.svg)](https://travis-ci.org/EFForg/privacybadgerchrome)
===================
Privacy Badger blocks spying ads and invisible trackers. It's there to ensure that companies can't track your browsing without your consent.

This extension is designed to automatically protect your privacy from third party trackers that load invisibly when you browse the web. We send the Do Not Track header with each request, and our extension evaluates the likelihood that you are still being tracked. If the algorithm deems the likelihood is too high, we automatically block your browser from responding to the domain. Just because a domain has been flagged by Privacy Badger's algorithm, doesn't mean that that domain is tracking you, just that it could be. 

Our extension has three states. Red means Privacy Badger believes this third-party domain is a tracker, and has blocked it. Yellow means the domain is believed to be both a tracker and necessary for the functioning of the page, so Privacy Badger is allowing it but blocking its cookies to prevent it from uniquely identifying you. Green means that Privacy Badger believes this is not tracker. You can click on the Privacy Badger icon in your browser's toolbar if you wish to override the automatic blocking settings. Or, you can browse in peace as Privacy Badger starts finding and eating up web trackers one by one.

Nothing can stop the Privacy Badger from eating cookies when it's hungry!

Privacy Badger is a project of the Electronic Frontier Foundation.

##Developing
For an easy build, simply enable developer mode in chrome://extensions, hit
the "load unpacked extension" button and load up this directory.

Within the command line, install the dependencies.

```bash
$ npm install
```

### Testing

After "unpacking" the extension, find your extension's ID and
visit `chrome-extension://YOUR_EXTENSION_ID/tests/index.html`, replacing
`YOUR_EXTENSION_ID` with your 32 character ID.

For Selenium tests, run `./run_selenium_tests.sh` in the `tests` directory. 
You need to have `chromedriver`, `xvfb` and `python-virtualenv` installed.

This project is using the [QUnit](http://qunitjs.com/), [py.test](http://pytest.org/), [Selenium](http://www.seleniumhq.org/) test frameworks 
along with [Travis CI](https://travis-ci.org/) for continuous integration.

##License
Privacy Badger is licensed under the GPLv3. See LICENSE for more details
=======
# Privacy Badger Firefox [![Build Status](https://travis-ci.org/EFForg/privacybadgerfirefox.svg)](https://travis-ci.org/EFForg/privacybadgerfirefox)

## Introduction

Privacy Badger is a Firefox add-on that blocks spying ads and invisible trackers as you browse. [More info here.](https://www.eff.org/privacybadger)

## Developer guide

### Getting started
1. Install the `jpm` package using npm. `npm install -g jpm`
2.  Once the SDK is activated, run `jpm -b <path/to/firefox> run` to launch a clean Firefox profile with Privacy Badger installed. Run `jpm -b <path/to/firefox> test` to run tests. `jpm xpi` creates a package (.xpi file) that you can install by loading into Firefox.

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
3. Increment the heuristic blocker counter by +1 for that domain. Has the base domain (eTLD+1) of the third-party read cookies on at least 3 first-party base domains? If not, don't block it (for now). Otherwise:
4. Has the third party posted an acceptable DNT policy? (We check this using an XML HTTP Request to a well-known path where we are asking sites to post statements of [compliance with DNT](https://www.eff.org/dnt-policy).) If so, don't block it. Otherwise:
5. Is the third party or any of its parent domains on a preloaded whitelist of sites to not block because it would probably cause the first-party site to break? If so, block it from reading cookies in a third-party context. Otherwise:
6. Block third-party requests from the third-party entirely.

In addition, Privacy Badger will block third-party cookies from a domain if any of its parent domains have been blocked or cookie-blocked.

Note that users can manually set domains to be unblocked (green), cookie-blocked (yellow), or red (blocked). These choices *always* override the heuristic blocker.

By default, Privacy Badger sends the Do Not Track header on all requests. It also clears the referer for all requests that are cookie-blocked.

## Contact

The current maintainers of this project are  Cooper Quintin (cjq at eff dot org) and Noah Swartz (noah at eff dot org). There is also a [mailing list](https://lists.eff.org/mailman/listinfo/privacybadger) to discuss Privacy Badger development for both Firefox and Chrome.
>>>>>>> 062ef5088890cfa5967254a9732f81c4d9dcac00
