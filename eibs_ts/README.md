# Protoype EIB supplier

The `eibs_ts` directory contains a prototype EIB supplier (`eibs`) implemented in TypeScript.


## Options

TODO.


## Testing

To test `eibs`, perform the steps below.

0. Ensure that [Ganache](https://truffleframework.com/ganache) is installed and running.

1. Open a terminal window in which to perform steps 2, 3, and 5 below.

2. cd to the top of the EIB repository and type `make`.

3. cd to the `eib` directory and type `make deploy`.

4. In another terminal window, cd to the `eibs_ts` directory and type `make run`.

5. In the original terminal window (the one opened in step 1), cd the the `eibs_ts` directory and type
   `make test`.
