#======================================================================================================#
# Makefile for Ethereum Input Bus
#======================================================================================================#
# smoelius: I am not sure that the present way is the best way to organize the project.  However, the
# present way has the following advantages.
# * Changes to common/src/*.ts are recognized as necessitating the recompilation of eib/test/*.ts,
#   eibs/src/*.ts, etc.
# * Node modules are shared amongst the subprojects, i.e., there is only one node_modules folder.
# See also comments regarding pre_tsc and post_tsc in examples/spellcheck/Makefile.
#======================================================================================================#

GREP := grep --color=auto
NPX  := npx --no-install
TSC  := tsc # --traceResolution

TYPES := eib/types/web3-contracts/index.d.ts \
         $(addsuffix /index.d.ts, $(wildcard examples/*/types/web3-contracts))

TI := common/src/interfaces-ti.ts \
      eibs/src/interfaces-ti.ts \
      examples/spellcheck/src/interfaces-ti.ts

SRC := $(filter-out %-ti.ts, \
         $(wildcard common/src/*.ts) \
         $(wildcard common/test/*.ts) \
         $(wildcard eib/public/*.ts) \
         $(wildcard eib/test/*.ts) \
         $(wildcard eibs/src/*.ts) \
         $(wildcard examples/*/src/*.ts) \
         $(wildcard examples/*/test/*.ts) \
         $(wildcard util/*.ts) \
       )

.PHONY: all full pre_tsc compile post_tsc lint \
  check \
    check_unsupply_gas_costs \
      check_unsupply_selection_gas_cost \
      check_unsupply_intro_gas_cost \
      check_unsupply_main_gas_cost \
  test clobber clean

# From: https://www.gnu.org/software/make/manual/html_node/Special-Targets.html
# .SECONDARY with no prerequisites causes all targets to be treated as secondary (i.e., no target is
# removed because it is considered intermediate).
.SECONDARY:

#======================================================================================================#

all: pre_tsc compile post_tsc

full: all check test

pre_tsc: node_modules
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

compile: common/src/index.js

common/src/index.js: $(TYPES) $(TI) $(SRC) node_modules node_modules/web3-legacy
	$(NPX) $(TSC)
	@# smoelius: The modification time of common/src/index.js is used to indicate the last time that tsc
	@# was invoked.
	touch $@

%-ti.ts: %.ts
	$(NPX) ts-interface-builder $<

node_modules: package.json
	npm install
	sed -i 's,\(require("web3\)\(/lib/web3/event.js")\),\1-legacy\2,' node_modules/ether-pudding/index.js

# smoelius: Installing web3-0.20.6 is a stopgap measure until I can find an alternative to using
# ether-pudding's logParser.
node_modules/web3-legacy:
	git clone https://github.com/ethereum/web3.js.git $@
	cd $@ && git checkout tags/v0.20.6 && npm install

post_tsc: node_modules
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

lint:
	-tslint --project tsconfig.json | grep -w 'falsy'

#======================================================================================================#

check: check_unsupply_gas_costs
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

check_unsupply_gas_costs: check_unsupply_selection_gas_cost check_unsupply_intro_gas_cost \
    check_unsupply_main_gas_cost

check_unsupply_selection_gas_cost: eib/Input_bus_opcodes.txt
	$(GREP) -- "\<UNSUPPLY_SELECTION_GAS_COST = $$(scripts/selection_gas_cost.sh \
	    'unsupply(uint256)' < $< \
	  )\>" \
	  eibs/src/index.ts

check_unsupply_intro_gas_cost: eib/Input_bus_opcodes.txt
	$(GREP) -- "\<UNSUPPLY_INTRO_GAS_COST = $$(scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>\|\<RETURN\>\|\<STOP\>\|\<CALLVALUE\>' \
	    '\(\<JUMPDEST\>.*.*\<CALLDATASIZE\>.*\<CALLDATALOAD\>.*\)' < $< \
	  )\>" \
	  eibs/src/index.ts

check_unsupply_main_gas_cost: eib/Input_bus_opcodes.txt
	$(GREP) -- "\<UNSUPPLY_MAIN_GAS_COST = $$(scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>\|\<RETURN\>\|\<STOP\>' \
	    '\(\<JUMPDEST\>.*\<ADDRESS\>.*\<CALLER\>.*\<MUL\>.*.*\<REVERT\>\)' < $< \
	  )\>" \
	  eibs/src/index.ts

eib/Input_bus_opcodes.txt: eib/build/contracts/Input_bus.json
	$(MAKE) -C eib Input_bus_opcodes.txt

eib/build/contracts/Input_bus.json:
	$(MAKE) -C eib build/contracts/Input_bus.json

#======================================================================================================#

test:
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

clobber: clean
	rm -rf node_modules
	rm -f package-lock.json
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

clean: tidy
	rm -f common/src/*-ti.ts
	rm -f eibs/src/*-ti.ts
	rm -f examples/*/src/*-ti.ts
	rm -f common/src/*.js
	rm -f common/test/*.js
	rm -f eib/public/*.js
	rm -f eib/test/*.js
	rm -f eibs/src/*.js
	rm -f examples/*/src/*.js
	rm -f examples/*/test/*.js
	rm -f util/*.js
	$(MAKE) -C common $@
	$(MAKE) -C eib $@
	$(MAKE) -C eibs $@
	$(MAKE) -C examples $@

tidy:
	find . -name .node-xmlhttprequest-sync-* -exec rm {} \;

#======================================================================================================#
