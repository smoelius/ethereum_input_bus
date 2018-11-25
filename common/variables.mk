#======================================================================================================#
# variables.mk
#======================================================================================================#

SHELL := /bin/bash

CHROME  := chromium-browser --temp-profile
GREP    := grep --color=auto
NPX     := npx --no-install
TSC     := tsc # --traceResolution
WEBPACK := webpack --mode=development

FILICIDE_ON_EXIT_BEGIN := trap 'echo Child processes terminated.' EXIT
PUSH_CHILD             := trap "kill $$! ; wait $$! ; $$(expr "$$(trap -p EXIT)" : "trap -- '\(.*\)' EXIT")" EXIT
FILICIDE_ON_EXIT_END   := echo 'Terminating child processes...'

#======================================================================================================#
