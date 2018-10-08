# EIB utilities

EIB comes with the following utilities.

  * `generate_test_file` `N`: Generates a random looking file consisting of `N` 256-bit words.  Useful
    for testing.

  * `ipfs_multihash_from_uint256` `X`: Converts 256-bit word `X` to an IPFS multihash.  Assumes SHA256.

  * `kectr`: Reads from standard input and generates a Merkle tree as [`eibs`](../eibs_ts/README.md)
    would store in its disk cache.  The `--root` option can be used to obtain just the root of the
    Merkle tree.

  * `selector` `SIGNATURE`: For a Solidity function with `SIGNATURE`, outputs its selector, i.e., the
    first four bytes of the Keccak-256 hash of `SIGNATURE` (see
    [Solidity documentation](https://solidity.readthedocs.io/en/v0.4.25/abi-spec.html#function-selector)).

  * `uint256_from_ipfs_multihash` `X`: Converts IPFS multihash `X` to a 256-bit word by dropping its
    type and length bytes.
