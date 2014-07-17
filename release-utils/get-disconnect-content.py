#!/usr/bin/python

# Python script to fetch Disconnect's list of "content" tracking sites.
# May be useful to merge with cookieblocklist.txt.

from __future__ import print_function
import requests

DISCONNECT_URL = "https://services.disconnect.me/disconnect-plaintext.json"


def get_content_domains():
    f = open("disconnect-content.txt", "w")
    r = requests.get(DISCONNECT_URL, verify=True)
    if r.status_code != 200:
        print("Request returned status code %d" % r.status_code)
        return False
    content_sites = r.json()["categories"]["Content"]
    content_domains = []
    for site in content_sites:
        domains = site.values()[0].values()[0]
        for d in domains:
            print(d, file=f)
        content_domains.extend(domains)
    return content_domains

if __name__ == "__main__":
    content_domains = get_content_domains()
