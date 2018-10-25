#======================================================================================================#
# Makefile for prototype EIB supplier implemented in TypeScript
#======================================================================================================#

NPX := npx --no-install

.PHONY: all pre_tsc post_tsc check test run clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc:

check:

test:
	$(MAKE) -C ../eib deploy
	( \
	  $(MAKE) run > /dev/null & \
	  trap "kill $$!" EXIT ; \
	  EIB_EXTERNAL_SUPPLIER=1 $(NPX) mocha \
	)

run:
	mkdir -p disk_cache
	node src/index.js --debug --mem-cache --disk-cache disk_cache

clean:
	rm -f disk_cache/*

#======================================================================================================#
