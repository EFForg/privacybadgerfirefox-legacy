#!/usr/bin/make -f

# this rule makes tag or branch targets
%:
	./release-utils/firefox-release.sh $@
clean:
	rm -r ./release-utils/xpi
