#======================================================================================================#
# Makefile for proxy_web_ui
#======================================================================================================#

WEBPACKFLAGS := --mode=development

.PHONY: all pre_tsc post_tsc check clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js Input_bus_artifacts.js Proxy_requestor_artifacts.js
	npx webpack $(WEBPACKFLAGS) $(addprefix ./, $^)

Input_bus_artifacts.js: build/contracts/Input_bus.json
	(echo -n "Input_bus_artifacts = JSON.parse('"; cat $< | tr -d '\n' | sed 's/\\/\\\\/g'; echo "')") > $@

Proxy_requestor_artifacts.js: build/contracts/Proxy_requestor.json
	(echo -n "Proxy_requestor_artifacts = JSON.parse('"; cat $< | tr -d '\n' | sed 's/\\/\\\\/g'; echo "')") > $@

check:

clean:
	rm -f dist/main.js
	rm -f Input_bus_artifacts.js
	rm -f Proxy_requestor_artifacts.js

#======================================================================================================#
