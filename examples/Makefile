#======================================================================================================#
# Makefile for EIB examples
#======================================================================================================#

SUBDIRS := $(filter-out Makefile README.md, $(wildcard *))

.PHONY: all pre_tsc post_tsc check clean

#======================================================================================================#

all: pre_tsc post_tsc

pre_tsc:
	for SUBDIR in $(SUBDIRS); do $(MAKE) -C $$SUBDIR $@; done

post_tsc:
	for SUBDIR in $(SUBDIRS); do $(MAKE) -C $$SUBDIR $@; done

check:
	for SUBDIR in $(SUBDIRS); do $(MAKE) -C $$SUBDIR $@; done

clean:
	for SUBDIR in $(SUBDIRS); do $(MAKE) -C $$SUBDIR $@; done

#======================================================================================================#
