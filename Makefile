#======================================================================================================#
# Makefile for Ethereum Input Bus
#======================================================================================================#
# smoelius: I am not sure that the present way is the best way to organize the project.  However, the
# present way has the following advantages.
# * Changes to common/*.ts are recognized as necessitating the recompilation of eib/test/*.ts,
#   eibs_ts/src/*.ts, etc.
# * Node modules are shared amongst the subprojects, i.e., there is only one node_modules folder.
#======================================================================================================#

TSCFLAGS := # --traceResolution

TI := common/interfaces-ti.ts \
      eibs_ts/src/interfaces-ti.ts \
      examples/spellcheck/src/interfaces-ti.ts

SRC := $(filter-out %-ti.ts, \
         $(wildcard common/*.ts) \
         $(wildcard eib/public/*.ts) \
         $(wildcard eib/test/*.ts) \
         $(wildcard eibs_ts/src/*.ts) \
         $(wildcard eibs_ts/test/*.ts) \
         $(wildcard examples/*/src/*.ts) \
         $(wildcard examples/*/test/*.ts) \
         $(wildcard util/*.ts) \
       )

.PHONY: all pre_tsc compile post_tsc lint \
  check \
    check_unsupply_gas_costs \
      check_unsupply_selection_gas_cost \
      check_unsupply_intro_gas_cost \
      check_unsupply_main_gas_cost \
  clobber clean

# From: https://www.gnu.org/software/make/manual/html_node/Special-Targets.html
# .SECONDARY with no prerequisites causes all targets to be treated as secondary (i.e., no target is
# removed because it is considered intermediate).
.SECONDARY:

#======================================================================================================#

all: pre_tsc compile post_tsc

pre_tsc:
	$(MAKE) -C eib $@
	$(MAKE) -C eibs_ts $@
	$(MAKE) -C examples $@

compile: common/index.js

common/index.js: $(TI) $(SRC) node_modules
	tsc $(TSCFLAGS)
	@# smoelius: The modification time of common/index.js is used to indicate the last time that tsc was
	@# invoked.
	touch $@
	@# $(MAKE) check

post_tsc:
	$(MAKE) -C eib $@
	$(MAKE) -C eibs_ts $@
	$(MAKE) -C examples $@

lint:
	-tslint --project tsconfig.json | grep -w 'falsy'

#======================================================================================================#

check: check_unsupply_gas_costs
	$(MAKE) -C eib $@
	$(MAKE) -C eibs_ts $@
	$(MAKE) -C examples $@

check_unsupply_gas_costs: check_unsupply_selection_gas_cost check_unsupply_intro_gas_cost \
    check_unsupply_main_gas_cost

check_unsupply_selection_gas_cost: eib/Input_bus_opcodes.txt
	grep "\<UNSUPPLY_SELECTION_GAS_COST = $$(scripts/selection_gas_cost.sh \
	    'unsupply(uint256)' < $< \
	  )\>" \
	  eibs_ts/src/index.ts

check_unsupply_intro_gas_cost: eib/Input_bus_opcodes.txt
	grep "\<UNSUPPLY_INTRO_GAS_COST = $$(scripts/sum_opcode_gas_costs.sh \
	      '\<JUMP\>\|\<RETURN\>\|\<CALLVALUE\>' \
	      '\(\<JUMPDEST\>.*.*\<CALLDATASIZE\>.*\<CALLDATALOAD\>.*\)' < $< \
	  )\>" \
	  eibs_ts/src/index.ts

check_unsupply_main_gas_cost: eib/Input_bus_opcodes.txt
	grep "\<UNSUPPLY_MAIN_GAS_COST = $$(scripts/sum_opcode_gas_costs.sh \
	      '\<JUMP\>\|\<RETURN\>' \
	      '\(\<JUMPDEST\>.*\<ADDRESS\>.*\<CALLER\>.*\<REVERT\>\)' < $< \
	  )\>" \
	  eibs_ts/src/index.ts

eib/Input_bus_opcodes.txt: eib/build/contracts/Input_bus.json
	$(MAKE) -C eib Input_bus_opcodes.txt

eib/build/contracts/Input_bus.json:
	$(MAKE) -C eib build/contracts/Input_bus.json

#======================================================================================================#

%-ti.ts: %.ts
	ts-interface-builder $<

node_modules:
	npm install
	@# smoelius: Make @0xproject's tsconfig file happy.
	echo {} > node_modules/tsconfig.json

clobber: clean
	rm -rf node_modules
	rm -f package-lock.json

clean: tidy
	rm -f common/*-ti.ts
	rm -f common/*.js
	rm -f eib/public/*.js
	rm -f eib/test/*.js
	rm -f eibs_ts/src/*-ti.ts
	rm -f eibs_ts/src/*.js
	rm -f eibs_ts/test/*.js
	rm -f examples/*/src/*-ti.ts
	rm -f examples/*/src/*.js
	rm -f examples/*/test/*.js
	rm -f util/*.js
	$(MAKE) -C eib $@
	$(MAKE) -C eibs_ts $@
	$(MAKE) -C examples $@

tidy:
	find . -name .node-xmlhttprequest-sync-* -exec rm {} \;

#======================================================================================================#
