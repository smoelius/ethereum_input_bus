#======================================================================================================#
# Makefile for Spellcheck
#======================================================================================================#

WEBPACKFLAGS := --mode=development

.PHONY: all deploy pre_tsc compile post_tsc test clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

deploy:
	truffle deploy

# smoelius: Note that "compile" cannot be a pre_tsc dependency because the contents of the util
# directory must be tsc-compiled before generate_dict_sol.sh can be run.
pre_tsc:

post_tsc: dist/main.js

dist/main.js: src/index.js Input_bus_artifacts.js Spellcheck_artifacts.js Dict_artifacts.js
	webpack $(WEBPACKFLAGS) $(addprefix ./, $^)

Input_bus_artifacts.js: eib_build/contracts/Input_bus.json
	(echo -n "Input_bus_artifacts = JSON.parse('"; cat $< | tr -d '\n' | sed 's/\\/\\\\/g'; echo "')") > $@

Spellcheck_artifacts.js: build/contracts/Spellcheck.json
	(echo -n "Spellcheck_artifacts = JSON.parse('"; cat $< | tr -d '\n' | sed 's/\\/\\\\/g'; echo "')") > $@

Dict_artifacts.js: build/contracts/Dict.json
	(echo -n "Dict_artifacts = JSON.parse('"; cat $< | tr -d '\n' | sed 's/\\/\\\\/g'; echo "')") > $@

compile: build/contracts/Input_bus.json \
         build/contracts/Migrations.json \
         build/contracts/Spellcheck.json \
         build/contracts/Dict.json

build/contracts/%.json: contracts/%.sol Dict.sol
	truffle compile

build/contracts/Dict.json: Dict.sol
	truffle compile

Dict.sol: words.sorted
	./generate_dict_sol.sh $< > $@

words.sorted: words-3.0-22.el7.noarch.rpm
	rpm2cpio $< | cpio -i --to-stdout ./usr/share/dict/linux.words | LC_ALL=C sort > $@

words-3.0-22.el7.noarch.rpm:
	wget 'https://rpmfind.net/linux/centos/7.5.1804/os/x86_64/Packages/$@'

test:
	mocha

clobber: clean
	rm -f Dict.sol
	rm -f words.sorted
	rm -f words-3.0-22.el7.noarch.rpm

clean:
	rm -f dist/main.js
	rm -f Input_bus_artifacts.js
	rm -f Spellcheck_artifacts.js
	rm -f Dict_artifacts.js
	rm -f build/contracts/*.json

#======================================================================================================#
