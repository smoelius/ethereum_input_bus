#!/bin/bash
#======================================================================================================#
# sum_opcode_gas_costs.sh
#======================================================================================================#

FLAG_VERBOSE_SUM=1
FLAG_VERBOSE_OPCODE=2
FLAG_VERBOSE_UNHANDLED=4

if [[ -z "$VERBOSE" ]]; then
  VERBOSE=0
fi

set -eu

ARGV0="$(basename "$0")"

if [[ $# -ne 2 ]]; then
  echo "$ARGV0: expect two arguments: blacklist and pattern" >&2
  exit 1
fi

BLACKLIST="$1"
PATTERN="$2"

function opcode_gas_cost() {
  case "$1" in
    RETURN | REVERT)
      echo 0
      ;;
    JUMPDEST)
      echo 1
      ;;
    ADDRESS | CALLER | CALLDATASIZE | CALLVALUE |  GAS | POP)
      echo 2
      ;;
    ADD | AND | CALLDATALOAD | DUP* | EQ | ISZERO | LT | MLOAD | MSTORE | NOT | OR | PUSH* | SUB | SWAP*)
      echo 3
      ;;
    DIV | MUL)
      echo 5
      ;;
    JUMP)
      echo 8
      ;;
    EXP)
      echo 10 # smoelius: Hack: does not take into account G_EXPBYTE.
      ;;
    JUMPI)
      echo 10
      ;;
    SHA3)
      echo 30 # smoelius: Hack: does not take into account G_SHA3WORD.
      ;;
    SLOAD)
      echo 200
      ;;
    CALL)
      echo 700
      ;;
    SSTORE)
      echo 20000 # smoelius: Hack: does not take into account zeroness.
      ;;
    *)
      echo -1
      ;;
  esac
}

(
  while read LINE; do
    OPCODE="$(expr "$LINE" : '[0-9]\+:[[:space:]]*\([^[:space:]]*\)')"
    if expr "$OPCODE" : "$BLACKLIST" > /dev/null; then
      echo
    else
      echo -n " $OPCODE"
    fi
  done; \
  echo
) | (
  SUM_PREV=-1
  while read LINE; do
    set +e
    LINE="$(expr "$LINE" : "$PATTERN")"
    set -e
    if [[ -z "$LINE" ]]; then
      continue
    fi
    # echo "$LINE" >&2
    SUM=0
    for OPCODE in $LINE; do
      COST=$(opcode_gas_cost "$OPCODE")
      if [[ $COST -lt 0 ]]; then
        if [[ $(($VERBOSE & $FLAG_VERBOSE_UNHANDLED)) -ne 0 ]]; then
          echo "$ARGV0: unhandled opcode '$OPCODE'; restarting" >&2
        fi
        SUM=-1
        break
      else
        if [[ $(($VERBOSE & $FLAG_VERBOSE_OPCODE)) -ne 0 ]]; then
          printf "%-16s%8d\n" "$OPCODE" "$COST" >&2
        fi
        SUM=$(($SUM + $COST))
      fi
    done
    if [[ $SUM -ge 0 ]]; then
      if [[ $(($VERBOSE & $FLAG_VERBOSE_SUM)) -ne 0 ]]; then
        printf "%24d\n" "$SUM" >&2
      fi
      if [[ $SUM_PREV -lt 0 ]]; then
        echo "$SUM"
      elif [[ $SUM_PREV -ne $SUM ]]; then
        echo "$ARGV0: pattern produced multiple results" >&2
        exit 1
      fi
      SUM_PREV=$SUM
    fi
  done
  if [[ $SUM_PREV -lt 0 ]]; then
    echo "$ARGV0: pattern produced no results" >&2
    exit 1
  fi
)

exit 0

#======================================================================================================#
