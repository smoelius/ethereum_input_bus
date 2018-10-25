#======================================================================================================#
# Makefile for Spellcheck
#======================================================================================================#

GREP    := grep --color=auto
NPX     := npx --no-install
WEBPACK := webpack --mode=development

JSON := eib_build/contracts/Input_bus.json \
        build/contracts/Migrations.json \
        build/contracts/Spellcheck.json \
        build/contracts/Dict.json

.PHONY: all pre_tsc post_tsc compile check test deploy clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

# smoelius: Note that "compile" cannot be a pre_tsc dependency because the contents of the util
# directory must be tsc-compiled before generate_dict_sol.sh can be run.
pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js $(JSON)
	$(NPX) $(WEBPACK) $(addprefix ./, $<)

compile: $(JSON)

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

test:
	$(MAKE) -C ../../eib deploy
	$(MAKE) deploy
	( \
	  $(MAKE) -C ../../eibs_ts run > /dev/null & \
	  trap "kill $$!" EXIT ; \
	  $(NPX) mocha \
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
	rm -f dist/main.js
	rm -f build/contracts/*.json

#======================================================================================================#
