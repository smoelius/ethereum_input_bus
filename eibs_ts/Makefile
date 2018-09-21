#======================================================================================================#
# Makefile for prototype Ethereum Input Bus supplier implemented in TypeScript
#======================================================================================================#

.PHONY: all pre_tsc post_tsc check run test clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc:

check:

test:
	mocha

run:
	mkdir -p disk_cache
	node src/index.js --debug --mem-cache --disk-cache disk_cache

clean:
	rm -f disk_cache/*

#======================================================================================================#
