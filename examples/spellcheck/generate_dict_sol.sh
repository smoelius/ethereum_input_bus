#!/bin/bash
#======================================================================================================#
# generate_dict_sol.sh
#======================================================================================================#

set -eu

if [[ $# -ne 1 ]]; then
  echo "$0: expect one argument: path (e.g., /usr/share/dict/words)" >&2
  exit 1
fi

DICT="$1"

LC_ALL=C sort -c "$DICT"

IPFS_MULTIHASH="$(jsipfs add "$DICT" | awk '{print $2}')"
IPFS_HASH="$(../../bin/uint256_from_ipfs_multihash "$IPFS_MULTIHASH")"
FILE_LENGTH="$(stat -L --printf='%s' "$DICT")"
MERKLE_ROOT="$(../../bin/kectr --root "$DICT")"

LONGEST_WORD_LENGTH="$(cat "$DICT" | tr -c '\n' x | sort | tail -1 | tr -d '\n' | wc -c)"

echo -n "\
  pragma solidity ^0.4.24;
  library Dict {
    function file_addr() public pure returns(uint256[3]) {
      return [
        uint256($IPFS_HASH),
        $FILE_LENGTH,
        $MERKLE_ROOT
      ];
    }
    function longest_word_length() public pure returns(uint) {
      return $LONGEST_WORD_LENGTH;
    }
  }
"

#======================================================================================================#
