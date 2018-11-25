#======================================================================================================#
# Makefile for Proxy Web UI
#======================================================================================================#

include ../../common/variables.mk

JSON := build/contracts/Input_bus.json \
        build/contracts/Proxy_requestor.json

.PHONY: all pre_tsc post_tsc check demo test demo-test clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js $(JSON)
	$(NPX) $(WEBPACK) $(addprefix ./, $<)

check:

demo test:
	TARGET=$@ $(MAKE) demo-test

demo-test:
	( \
	  $(FILICIDE_ON_EXIT_BEGIN) ; \
	  $(NPX) ganache-cli -q & $(PUSH_CHILD) ; \
	  $(MAKE) -C ../../eib clean deploy ; \
	  $(MAKE) dist/main.js ; \
	  ./serve.sh 2>/dev/null & $(PUSH_CHILD) ; \
	  case '$(TARGET)' in \
	    demo) \
	      $(MAKE) -C ../../eibs run & $(PUSH_CHILD) ; \
	      $(CHROME) http://127.0.0.1:8000/?test ; \
	      ;; \
	    test) \
	      $(MAKE) -C ../../eibs run > /dev/null & $(PUSH_CHILD) ; \
	      $(NPX) mocha ; \
	      ;; \
	  esac ; \
	  $(FILICIDE_ON_EXIT_END) \
	)

clobber:

clean:
	rm -rf dist

#======================================================================================================#
