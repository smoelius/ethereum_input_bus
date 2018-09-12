const Input_bus = artifacts.require("Input_bus")
const Proxy_requestor = artifacts.require("Proxy_requestor")

module.exports = function(deployer) {
  return deployer.deploy(Input_bus).then((eib) => {
    return deployer.deploy(Proxy_requestor, eib.address).then((proxy) => {
      console.log("  Initializing EIB instance...")
      return eib.initialize()
    }).catch((err) => {
      console.log(err)
    })
  }).catch((err) => {
    console.log(err)
  })
}
