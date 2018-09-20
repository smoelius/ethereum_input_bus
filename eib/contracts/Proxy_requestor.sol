/*====================================================================================================*
 * Proxy_requestor.sol
 * This contract exists primarily for testing purposes.  It provides a callback that simply emits an
 * event.
 *====================================================================================================*/

pragma solidity ^0.4.24;

/*====================================================================================================*/

import "contracts/Input_bus.sol";

/*====================================================================================================*/

contract Proxy_requestor {
  
  /*==================================================================================================*
   * Constants
   *==================================================================================================*/
  
  uint constant N_CALLBACK_LEVELS = 3;
  
  /*==================================================================================================*
   * Data members
   *==================================================================================================*/
  
  Input_bus public eib;
  
  /*==================================================================================================*
   * Events
   *==================================================================================================*/
  
  event Proxy_callback(
    uint req_id,
    address supplier,
    uint256[] data,
    uint256[] proof
  );
  
  /*==================================================================================================*
   * Constructor
   *==================================================================================================*/
  
  constructor(address _eib_address) public {
    eib = Input_bus(_eib_address);
  }
  
  /*==================================================================================================*
   * Public interface
   *==================================================================================================*/
  
  function request(
      uint256 _flags,
      Input_bus.file_address_type _file_addr_type,
      uint256[] _file_addr,
      uint128 _first,
      uint128 _last,
      uint _ltiov,
      uint callback_level,
      uint callback_gas
  ) public payable returns(uint) {
    require(callback_level < N_CALLBACK_LEVELS);
    
    uint req_id = eib.request.value(msg.value)(
      _flags,
      _file_addr_type,
      _file_addr,
      _first,
      _last,
      _ltiov,
      [this.callback_zero.selector, this.callback_one.selector, this.callback_two.selector]
        [callback_level],
      callback_gas // Calculate!!!
    );
    
    return req_id;
  }
  
  function callback_zero(uint /* _req_id */) public view {
    require(msg.sender == address(eib));
  }
  
  function callback_one(uint _req_id) public {
    require(msg.sender == address(eib));
    emit Proxy_callback(_req_id, 0x0, new uint256[](0), new uint256[](0));
  }
  
  function callback_two(uint _req_id) public {
    require(msg.sender == address(eib));
    emit Proxy_callback(_req_id, eib.get_supplier(_req_id), eib.get_data(_req_id),
      eib.get_proof(_req_id));
  }
}

/*====================================================================================================*/

