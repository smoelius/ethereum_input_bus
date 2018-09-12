# Ethereum Input Bus examples

This directory contains two sample webapps written to use EIB.

* Proxy Web UI simply sends requests to EIB and receives responses from EIB using a web interface.

* Spellcheck is a contract that checks for the presence/absence of a word in a dictionary.  EIB is used to read from the dictionary.

To run the Spellcheck example, perform the steps below with X = the path the Spellcheck directory.

To run the Proxy Web UI example, perform the steps below with X = the path to the Proxy Web UI directory, but skip step 5.

0. Ensure that Ganache, Metamask, and all of the prerequisites listed in [README.md](../README.md) are installed.

1. Launch Ganache.

2. Send your Metamask account some ether.  Perhaps the simplest way to do this is by entering the following in the `truffle console`:

  * `web3.eth.sendTransaction({to: "`*your_Metamask_account*`", from: "`*Ganache's_first_account*`", value: web3.toWei(10, "ether") })`

3. Open a terminal window in which to perform steps 4-7 below.

4. cd to the `eib` directory and type `make clean deploy`.

5. **Spellcheck only:** cd to X and type `make clean deploy`.

6. cd to the top of the repository and type `make`.

7. cd to X and type `./launch.sh`.

8. In another terminal window, cd to the `eibs_ts` directory and type `make run`.

9. In a web browser, go to "<http://127.0.0.1:8000>".
