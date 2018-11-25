#======================================================================================================#
# Makefile for Spellcheck
#======================================================================================================#

include ../../common/variables.mk

JSON := eib_build/contracts/Input_bus.json \
        build/contracts/Migrations.json \
        build/contracts/Spellcheck.json \
        build/contracts/Dict.json

.PHONY: all pre_tsc post_tsc compile types check demo test demo-test deploy clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

# smoelius: Neither "compile" nor types/web3-contracts/index.d.ts can be a pre_tsc dependency because
# the contents of the util directory must be tsc-compiled before generate_dict_sol.sh can be run.  So,
# what follows is a bit of a hack:
# * pre_tsc checks whether top-level "compile" needs to be rebuilt and, if so, outputs a minimal
#   types/web3-contracts/index.d.ts.
# * post_tsc outputs the real types/web3-contracts/index.d.ts and then rebuilds top-level "compile".

pre_tsc:
	$(MAKE) -q -C ../.. compile; if [ $$? -ne 0 ]; then \
	  mkdir -p types/web3-contracts ; \
	  ( \
	    echo 'export type Dict = any' ; \
	    echo 'export type Spellcheck = any' \
	  ) > types/web3-contracts/index.d.ts ; \
	fi

post_tsc: types/web3-contracts/index.d.ts # dist/main.js
	$(MAKE) -C ../.. compile
	$(MAKE) dist/main.js

compile: $(JSON)

types:
	# smoelius: Force types/web3-contracts/index.d.ts to be rebuilt in case it is the minimal one output
	# by pre_tsc.
	rm -f types/web3-contracts/index.d.ts
	$(MAKE) types/web3-contracts/index.d.ts

types/web3-contracts/index.d.ts: $(JSON)
	$(NPX) typechain --target web3-1.0.0 'build/contracts/*.json'
	( \
    echo 'export * from "./Dict"' ; \
    echo 'export * from "./Spellcheck"' \
  ) > $@

dist/main.js: src/index.js $(JSON)
	$(NPX) $(WEBPACK) $(addprefix ./, $<)

build/contracts/%.json: contracts/%.sol Dict.sol
	$(NPX) truffle compile

build/contracts/Dict.json: Dict.sol
	$(NPX) truffle compile

Dict.sol: words.sorted
	./generate_dict_sol.sh $< > $@ || (rm -f $@ && false)

words.sorted: words-3.0-22.el7.noarch.rpm
	rpm2cpio $< | cpio -i --to-stdout ./usr/share/dict/linux.words | LC_ALL=C sort > $@

words-3.0-22.el7.noarch.rpm:
	wget 'https://rpmfind.net/linux/centos/7.5.1804/os/x86_64/Packages/$@'

check:

demo test:
	TARGET=$@ $(MAKE) demo-test

demo-test:
	( \
	  $(FILICIDE_ON_EXIT_BEGIN) ; \
	  $(NPX) ganache-cli -q & $(PUSH_CHILD) ; \
	  $(MAKE) -C ../../eib clean deploy ; \
	  $(MAKE) clean deploy ; \
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

# smoelius: deploy requires that Dict.sol be generated.  (Since deploy will update *.json, there may be
# a better way to organize this Makefile.)
deploy: Dict.sol
	(for X in $(JSON); do $(GREP) '"address":' "$$X" || exit 1; done) || $(NPX) truffle deploy

clobber: clean
	rm -f Dict.sol
	rm -f words.sorted
	rm -f words-3.0-22.el7.noarch.rpm

clean:
	rm -rf dist
	rm -rf build
	rm -rf types

#======================================================================================================#
