#======================================================================================================#
# Makefile for proxy_web_ui
#======================================================================================================#

WEBPACKFLAGS := --mode=development

JSON := build/contracts/Input_bus.json \
        build/contracts/Proxy_requestor.json

.PHONY: all pre_tsc post_tsc check clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js $(JSON)
	npx webpack $(WEBPACKFLAGS) $(addprefix ./, $<)

check:

clean:
	rm -f dist/main.js

#======================================================================================================#
