#======================================================================================================#
# Makefile for prototype EIB supplier implemented in TypeScript
#======================================================================================================#

include ../common/variables.mk

.PHONY: all pre_tsc post_tsc check test run clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc:

check:

test:
	( \
	  $(FILICIDE_ON_EXIT_BEGIN) ; \
	  $(NPX) ganache-cli -q & $(PUSH_CHILD) ; \
	  $(MAKE) -C ../eib clean deploy ; \
	  $(MAKE) run > /dev/null & $(PUSH_CHILD) ; \
	  EIB_EXTERNAL_SUPPLIER=1 $(NPX) mocha ; \
	  $(FILICIDE_ON_EXIT_END) \
	)

run:
	mkdir -p disk_cache
	node src/index.js --debug --mem-cache --disk-cache disk_cache

clobber:

clean:
	rm -f disk_cache/*

#======================================================================================================#
