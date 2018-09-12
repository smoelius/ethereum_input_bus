const assert = require("assert")
const fs = require("fs")

const Dict = artifacts.require("Dict")
const Spellcheck = artifacts.require("Spellcheck")

module.exports = function(deployer) {
  const data = fs.readFileSync("eib_build/contracts/Input_bus.json")
  const Input_bus_artifacts = JSON.parse(data.toString())
  assert(Object.keys(Input_bus_artifacts.networks).length === 1)
  const network = Object.keys(Input_bus_artifacts.networks)[0]
  const eib_address = Input_bus_artifacts.networks[network].address
  
  return deployer.deploy(Dict).then(() => {
    return deployer.link(Dict, Spellcheck).then(() => {
      return deployer.deploy(Spellcheck, eib_address)
    }).catch((err) => {
      console.log(err)
    })
  }).catch((err) => {
    console.log(err)
  })
}
