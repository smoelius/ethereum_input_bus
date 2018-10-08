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

IPFS_MULTIHASH="$(npx jsipfs add "$DICT" | awk '{print $2}')"
IPFS_HASH="$(../../bin/uint256_from_ipfs_multihash "$IPFS_MULTIHASH")"
# smoelius: Using stat in the next line is not portable.
FILE_LENGTH="$(ls -l "$DICT" | awk '{print $5}')"
MERKLE_ROOT="$(../../bin/kectr --root "$DICT")"

LONGEST_WORD_LENGTH="$(cat "$DICT" | tr -c '\n' x | sort | tail -1 | tr -d '\n' | wc -c)"

echo -n "\
  pragma solidity ^0.4.24;
  library Dict {
    function file_addr() public pure returns(uint256[]) {
      uint256[] memory result = new uint256[](3);
      result[0] = $IPFS_HASH;
      result[1] = $FILE_LENGTH;
      result[2] = $MERKLE_ROOT;
      return result;
    }
    function longest_word_length() public pure returns(uint) {
      return $LONGEST_WORD_LENGTH;
    }
  }
"

#======================================================================================================#
