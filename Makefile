#!/usr/bin/make -f

# this rule makes tag or branch targets
%:
	./release-utils/make-signed-xpi.sh $@
clean:
	rm -r ./release-utils/pkg
