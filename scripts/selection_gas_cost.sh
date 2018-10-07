#!/bin/bash
#======================================================================================================#
# selection_gas_cost.sh
#======================================================================================================#

set -eu

if [[ $# -ne 1 ]]; then
  echo "$0: expect one argument: signature" >&2
  exit 1
fi

SUM_OPCODE_GAS_COSTS="$(dirname $0)/sum_opcode_gas_costs.sh"
SELECTOR="$(dirname $0)/../bin/selector"

SIGNATURE=$1

SELECTOR="$("$SELECTOR" "$SIGNATURE")"

while [[ ${#SELECTOR} -lt 10 ]]; do
  SELECTOR="$(echo "$SELECTOR" | sed 's/^0x/0x0/')"
done

# export VERBOSE=7

sed "s/\<PUSH4[[:space:]]\+$SELECTOR\>/&/;T;n;n;n;q" \
| "$SUM_OPCODE_GAS_COSTS" '' '\(.*\)'

#======================================================================================================#
