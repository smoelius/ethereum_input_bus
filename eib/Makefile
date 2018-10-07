#======================================================================================================#
# Makefile for Ethereum Input Bus implemented in Solidity
#======================================================================================================#

.PHONY: all deploy pre_tsc post_tsc compile \
  check check_pre_callback_overhead check_post_callback_overhead check_pre_return_overhead \
  test clean

#======================================================================================================#

all: pre_tsc post_tsc

deploy:
	truffle deploy

pre_tsc:

post_tsc: compile

compile: build/contracts/Input_bus.json \
         build/contracts/Migrations.json \
         build/contracts/Proxy_requestor.json

build/contracts/%.json: contracts/%.sol
	truffle compile

check: check_pre_callback_overhead check_post_callback_overhead check_pre_return_overhead

check_pre_callback_overhead: Input_bus_opcodes.txt
	grep "\<PRE_CALLBACK_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh '\<JUMP\>' \
	    '.*\<GAS\>\(.*\<[A-Z]\+\>.*\<CALL\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

check_post_callback_overhead: Input_bus_opcodes.txt
	grep "\<POST_CALLBACK_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh '\<JUMP\>' \
	    '.*\<CALL\>\(.*\<GAS\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

check_pre_return_overhead: Input_bus_opcodes.txt
	grep "\<PRE_RETURN_OVERHEAD = $$(../scripts/sum_opcode_gas_costs.sh '\<JUMP\>' \
	    '.*\<GAS\>\(.*\<REVERT\>\)' < $< \
	  )\>" \
	  contracts/Input_bus.sol

Input_bus_opcodes.txt: build/contracts/Input_bus.json
	truffle opcode Input_bus | grep '^[0-9]\+:' > $@

test:
	mocha

clean:
	rm -f Input_bus_opcodes.txt
	rm -f build/contracts/*.json

#======================================================================================================#

