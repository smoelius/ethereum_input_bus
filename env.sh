#!/bin/cat
########################################################################################################
#                                                                                                      #
#                                      This file must be sourced.                                      #
#                                                                                                      #
########################################################################################################

if ! grep '"name"[[:space:]]*:[[:space:]]*"ethereum_input_bus"' package.json > /dev/null; then
  echo "This file must be sourced at the top of the project directory." >&2
else
  export PATH="$PWD/bin:$PATH"
  export EIBS_DIR="$PWD/eibs"
fi
