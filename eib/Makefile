#======================================================================================================#
# Makefile for EIB contracts
#======================================================================================================#

GREP := grep --color=auto
NPX  := npx --no-install

JSON := build/contracts/Input_bus.json \
        build/contracts/Migrations.json \
        build/contracts/Proxy_requestor.json

.PHONY: all pre_tsc post_tsc compile \
  check \
    check_supply_overhead \
      check_supply_pre_callback_overhead \
      check_supply_post_callback_overhead \
      check_supply_pre_return_overhead \
    check_callback_nonemitting_gas_costs \
      check_callback_nonemitting_selection_gas_cost \
      check_callback_nonemitting_intro_gas_cost \
      check_callback_nonemitting_main_gas_cost \
    check_callback_emitting_gas_costs \
      check_callback_emitting_selection_gas_cost \
      check_callback_emitting_intro_gas_cost \
      check_callback_emitting_main_gas_cost \
      check_callback_emitting_pre_getter_overhead \
      check_callback_emitting_post_getter_overhead \
      check_get_supplier_selection_gas_cost \
      check_get_data_selection_gas_cost \
      check_get_proof_selection_gas_cost \
  test deploy clobber clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:

post_tsc: compile

compile: $(JSON)

build/contracts/%.json: contracts/%.sol
	$(NPX) truffle compile

#======================================================================================================#

check: check_supply_overhead \
    check_callback_nonemitting_gas_costs \
    check_callback_emitting_gas_costs

#======================================================================================================#

check_supply_overhead: check_supply_pre_callback_overhead check_supply_post_callback_overhead \
    check_supply_pre_return_overhead

check_supply_pre_callback_overhead: Input_bus_opcodes.txt
	$(GREP) -- "\<PRE_CALLBACK_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>' \
	    '.*\<GAS\>\(.*[^ ]\+.*\<CALL\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

check_supply_post_callback_overhead: Input_bus_opcodes.txt
	$(GREP) -- "\<POST_CALLBACK_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>' \
	    '.*\<CALL\>\(.*\<GAS\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

check_supply_pre_return_overhead: Input_bus_opcodes.txt
	$(GREP) -- "\<PRE_RETURN_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>' \
	    '.*\<GAS\>\(.*\<REVERT\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

#======================================================================================================#

check_callback_nonemitting_gas_costs: \
    check_callback_nonemitting_selection_gas_cost \
    check_callback_nonemitting_intro_gas_cost \
    check_callback_nonemitting_main_gas_cost

check_callback_nonemitting_selection_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_NONEMITTING_SELECTION_GAS_COST = $$(../scripts/selection_gas_cost.sh \
	    'callback_nonemitting(uint256)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_nonemitting_intro_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_NONEMITTING_INTRO_GAS_COST = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>\|\<RETURN\>\|\<STOP\>\|\<CALLVALUE\>' \
	    '\(\<JUMPDEST\>.*.*\<CALLDATASIZE\>.*\<CALLDATALOAD\>.*\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_nonemitting_main_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_NONEMITTING_MAIN_GAS_COST = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>\|\<RETURN\>\|\<STOP\>\|\<LOG1\>' \
	    '\(\<JUMPDEST\>.*\<CALLER\>.*\<REVERT\>\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

#======================================================================================================#

check_callback_emitting_gas_costs: \
    check_callback_emitting_selection_gas_cost \
    check_callback_emitting_intro_gas_cost \
    check_callback_emitting_main_gas_cost \
    check_callback_emitting_pre_getter_overhead \
    check_callback_emitting_post_getter_overhead \
    check_get_supplier_selection_gas_cost \
    check_get_data_selection_gas_cost \
    check_get_proof_selection_gas_cost

check_callback_emitting_selection_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_EMITTING_SELECTION_GAS_COST = $$(../scripts/selection_gas_cost.sh \
	    'callback_emitting(uint256)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_emitting_intro_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_EMITTING_INTRO_GAS_COST = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>\|\<RETURN\>\|\<STOP\>\|\<CALLVALUE\>' \
	    '\(\<JUMPDEST\>.*.*\<CALLDATASIZE\>.*\<CALLDATALOAD\>.*\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_emitting_main_gas_cost: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<CALLBACK_EMITTING_MAIN_GAS_COST = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<JUMP\>\|\<RETURN\>\|\<STOP\>' \
	    '\(\<JUMPDEST\>.*\<CALLER\>.*\<LOG1\>.*\<REVERT\>\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_emitting_pre_getter_overhead: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<PRE_GETTER_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>' \
	    '.*\<GAS\>\(.*[^ ]\+.*\<CALL\>\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_callback_emitting_post_getter_overhead: Proxy_requestor_opcodes.txt
	$(GREP) -- "\<POST_GETTER_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh \
	    '\<INVALID\>\|\<JUMP\>' \
	    '.*\<CALL\>\(.*\<GAS\>\)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_get_supplier_selection_gas_cost: Input_bus_opcodes.txt
	$(GREP) -- "\<GET_SUPPLIER_SELECTION_GAS_COST = $$(../scripts/selection_gas_cost.sh \
	    'get_supplier(uint256)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_get_data_selection_gas_cost: Input_bus_opcodes.txt
	$(GREP) -- "\<GET_DATA_SELECTION_GAS_COST = $$(../scripts/selection_gas_cost.sh \
	    'get_data(uint256)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

check_get_proof_selection_gas_cost: Input_bus_opcodes.txt
	$(GREP) -- "\<GET_PROOF_SELECTION_GAS_COST = $$(../scripts/selection_gas_cost.sh \
	    'get_proof(uint256)' < $< \
	  )\>" \
	  contracts/Proxy_requestor.sol

#======================================================================================================#

Input_bus_opcodes.txt: build/contracts/Input_bus.json
	$(NPX) truffle opcode Input_bus | grep '^[0-9]\+:' > $@

Proxy_requestor_opcodes.txt: build/contracts/Proxy_requestor.json
	$(NPX) truffle opcode Proxy_requestor | grep '^[0-9]\+:' > $@

#======================================================================================================#

test:
	$(MAKE) deploy
	$(NPX) mocha

deploy:
	(for X in $(JSON); do $(GREP) '"address":' "$$X" || exit 1; done) || $(NPX) truffle deploy

clobber:

clean:
	rm -f Input_bus_opcodes.txt
	rm -f Proxy_requestor_opcodes.txt
	rm -f build/contracts/*.json

#======================================================================================================#

