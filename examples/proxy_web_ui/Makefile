#======================================================================================================#
# Makefile for Proxy Web UI
#======================================================================================================#

NPX     := npx --no-install
WEBPACK := webpack --mode=development

JSON := build/contracts/Input_bus.json \
        build/contracts/Proxy_requestor.json

.PHONY: all pre_tsc post_tsc check test clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js $(JSON)
	$(NPX) $(WEBPACK) $(addprefix ./, $<)

check:

test:

clobber:

clean:
	rm -rf dist

#======================================================================================================#
