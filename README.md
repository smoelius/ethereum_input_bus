# ![](https://raw.githubusercontent.com/smoelius/ethereum_input_bus/master/doc/logo.svg?sanitize=true "Ethereum Input Bus") Ethereum Input Bus (alpha)

Samuel E. Moelius III (<sam@moeli.us>)

If EIB could be of use to your project, then please contact me (<sam@moeli.us>) and/or consider a
donation to 0xD07C0Bb4B0E5943cbeD93c337686217D91655a2e.


Contents
1. [Description](#user-content-description)
2. [Terminology](#user-content-terminology)
3. [Repository contents](#user-content-repository-contents)
4. [Prerequisites](#user-content-prerequisites)
5. [Building](#user-content-building)
6. [Testing](#user-content-testing)
7. [Reporting bugs](#user-content-reporting-bugs)


## Description

Ethereum Input Bus (EIB) provides a means for moving data onto the Ethereuem blockchain securely.

More specifically, EIB allows an Ethereum contract to crowd-source a read from the InterPlanetary File
System ([IPFS](https://ipfs.io/)), and for a respondent to supply the data and prove that the data is
correct, i.e., the data comes from the correct file, the data comes from the correct offset within that
file, and the data is of the correct length.


## Terminology

TODO.


## Repository contents

The EIB repository consists of (TODO: link to READMEs):

  * `eib`: the EIB contract itself (receives requests, verifies responses, etc.),

  * `eibs_ts`: a prototype EIB supplier implemented in TypeScript,
  
  * [example webapps](examples/README.md) written to use EIB, and

  * utilities for working with EIB.


## Prerequisites

Building EIB requires that the following NPM packages be installed globally:

  * `ipfs`

  * `mocha`

  * `truffle`

  * `ts-interface-builder`

  * `typescript`

  * `webpack`

The above packages can be installed with the following command:

    npm install -g ipfs mocha truffle ts-interface-builder typescript webpack


## Building

Having verified that the above prerequisites are installed, one should be able to build EIB by simply
typing `make`.

Note that running the [examples](examples/README.md) also requires that
[Ganache](https://truffleframework.com/ganache) and [Metamask](https://metamask.io/) be installed.
However, Ganache and Metamask are not required to build the examples.


## Testing

EIB can be tested in two ways:

  * with the testing framework itself responding to requests (useful for testing `eib`) or

  * with `eibs_ts` responding to requests (useful for testing `eibs_ts`).

Details of either method are given in `eib`'s README and `eibs_ts`'s README, repesctively (TODO).


## Reporting bugs

Please send bug reports to Samuel E. Moelius III (sam@moeli.us).


