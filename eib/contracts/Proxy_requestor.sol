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
  
  uint256 constant BLOCK_GAS_LIMIT = 4712388;
  
  uint256 constant G_BASE     = 2;
  uint256 constant G_VERYLOW  = 3;
  uint256 constant G_MID      = 8;
  uint256 constant G_JUMPDEST = 1;
  uint256 constant G_MEMORY   = 3;
  uint256 constant G_LOGDATA  = 8;
  uint256 constant G_SHA3WORD = 6;
  uint256 constant G_COPY     = 3;
  
  uint256 constant C_JUMP           = G_MID;
  uint256 constant C_JUMPDEST       = G_JUMPDEST;
  uint256 constant C_RETURNDATACOPY = G_VERYLOW; // smoelius: does not take into account G_COPY
  uint256 constant C_RETURNDATASIZE = G_BASE;
  
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
    bytes32[] data,
    bytes32[] proof,
    uint256 get_supplier_gas_before,
    uint256 get_supplier_gas_after,
    uint256 get_data_gas_before,
    uint256 get_data_gas_after,
    uint256 get_proof_gas_before,
    uint256 get_proof_gas_after,
    uint256 end_of_memory
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
      uint128 _start,
      uint128 _end,
      uint _ltiov,
      bool emit_event,
      uint callback_gas_override
  ) public payable returns(uint) {
    uint256 callback_gas = callback_gas_override > 0
      ? callback_gas_override
      : !emit_event
        ? CALLBACK_NONEMITTING_GAS_COST
        : callback_emitting_gas_cost(_flags, _file_addr_type, _file_addr, _start, _end, _ltiov);
    return eib.request.value(msg.value)(
      _flags,
      _file_addr_type,
      _file_addr,
      _start,
      _end,
      _ltiov,
      !emit_event ? this.callback_nonemitting.selector : this.callback_emitting.selector,
      callback_gas
    );
  }
  
  /*==================================================================================================*/
  
  uint256 constant CALLBACK_NONEMITTING_SELECTION_GAS_COST = 163;
  uint256 constant CALLBACK_NONEMITTING_INTRO_GAS_COST = 63 + C_JUMP;
  uint256 constant CALLBACK_NONEMITTING_MAIN_GAS_COST = 293 + C_JUMPDEST;
  // smoelius: I am not sure that the next value is correct---it is my best guess.
  uint256 constant CALLBACK_NONEMITTING_MEMORY_GAS_COST = 3 * G_MEMORY;
  
  uint256 constant CALLBACK_NONEMITTING_GAS_COST =
      CALLBACK_NONEMITTING_SELECTION_GAS_COST
    + CALLBACK_NONEMITTING_INTRO_GAS_COST
    + CALLBACK_NONEMITTING_MAIN_GAS_COST
    + CALLBACK_NONEMITTING_MEMORY_GAS_COST
  ;
  
  // smoelius: Making callback_nonemitting payable eliminates a CALLVALUE check.
  
  function callback_nonemitting(uint /* _req_id */) public payable {
    bool fail = msg.sender != address(eib);
    assembly {
      if fail {
        revert(0, 0)
      }
      // jumpdest
      return(0, 0)
    }
  }
  
  /*==================================================================================================*/
  
  uint256 constant CALLBACK_EMITTING_SELECTION_GAS_COST = 75;
  uint256 constant CALLBACK_EMITTING_INTRO_GAS_COST = 63 + C_JUMP;
  // smoelius: The next value does not take into account G_COPY, G_LOGDATA, nor the costs of calling
  // get_supplier, get_data, and get_proof.
  uint256 constant CALLBACK_EMITTING_MAIN_GAS_COST = 4803 + C_JUMPDEST
    + C_RETURNDATACOPY + G_COPY           // smoelius: get_supplier
    + C_RETURNDATACOPY + C_RETURNDATASIZE // smoelius: get_data, G_COPY accounted for below
    + C_RETURNDATACOPY + C_RETURNDATASIZE // smoelius: get_proof, G_COPY accounted for below
    + 4 * G_SHA3WORD
  ;
  uint256 constant CALLBACK_EMITTING_COPY = 2;
  uint256 constant CALLBACK_EMITTING_LOG = 13;
  uint256 constant CALLBACK_EMITTING_MEMORY = 17;
  
  // smoelius: The gas costs of get_supplier, get_data, and get_proof were determined experimentally.
  // Each of the latter two contains a loop, so it would be difficult to determine their gas costs
  // using sum_opcode_gas_costs.sh, etc.  Moreover, I think that some form of loop/recursion is
  // necessary.
  
  uint256 constant PRE_GETTER_OVERHEAD = 721;
  uint256 constant POST_GETTER_OVERHEAD = 4;
  
  uint256 constant GET_SUPPLIER_SELECTION_GAS_COST = 273;
  uint256 constant GET_DATA_SELECTION_GAS_COST = 141;
  uint256 constant GET_PROOF_SELECTION_GAS_COST = 163;
  
  uint256 constant GET_SUPPLIER_INTRO_MAIN_GAS_COST = 813;
  
  function callback_emitting_gas_cost(
      uint256 /* _flags */,
      Input_bus.file_address_type _file_addr_type,
      uint256[] _file_addr,
      uint128 _start,
      uint128 _end,
      uint /* _ltiov */
  ) public pure returns(uint256) {
    assert(_file_addr_type == Input_bus.file_address_type.IPFS_WITH_KECCAK256_MERKLE_ROOT);
    assert(_file_addr.length == 3);
    uint128 data_length = calculate_data_length(uint128(_file_addr[1]), _start, _end);
    uint128 proof_length = calculate_proof_length(_start, _end, uint128(_file_addr[1]));
    uint128 data_proof_length = data_length + proof_length;
    return
        CALLBACK_EMITTING_SELECTION_GAS_COST
      + CALLBACK_EMITTING_INTRO_GAS_COST
      + CALLBACK_EMITTING_MAIN_GAS_COST
        + GET_SUPPLIER_SELECTION_GAS_COST + GET_SUPPLIER_INTRO_MAIN_GAS_COST
        + GET_DATA_SELECTION_GAS_COST + getter_gas_cost(data_length)
        + GET_PROOF_SELECTION_GAS_COST + getter_gas_cost(proof_length)
        + G_COPY * (CALLBACK_EMITTING_COPY + data_proof_length)
        + G_LOGDATA * (CALLBACK_EMITTING_LOG + data_proof_length) * 32
      + G_MEMORY * (CALLBACK_EMITTING_MEMORY + data_proof_length)
      + square(CALLBACK_EMITTING_MEMORY + data_proof_length) / 512
    ;
  }
  
  uint256 constant GETTER_BASE_A   = 331;
  uint256 constant GETTER_BASE_B   = 1267;
  uint256 constant GETTER_MEMORY_A = 2;
  uint256 constant GETTER_MEMORY_B = 7;
  
  function getter_gas_cost(uint length) private pure returns(uint256) {
    return
        GETTER_BASE_A * length
      + GETTER_BASE_B
      + square(GETTER_MEMORY_A * length + GETTER_MEMORY_B) / 512
    ;
  }
  
  // smoelius: Making callback_emitting payable eliminates a CALLVALUE check.
  
  function callback_emitting(uint _req_id) public payable {
    // smoelius: Assembly is used because the code that solc would otherwise emit for callback_emitting
    // is surprisingly complicated.
    
    uint256 block_gas_limit = BLOCK_GAS_LIMIT;
    address eib_address = address(eib);
    uint256 pre_getter_overhead = PRE_GETTER_OVERHEAD;
    uint256 post_getter_overhead = POST_GETTER_OVERHEAD;
    bytes32 proxy_callback_topic = keccak256("Proxy_callback(uint256,address,bytes32[],bytes32[],uint256,uint256,uint256,uint256,uint256,uint256,uint256)");
    bool fail = msg.sender != address(eib);
    uint256 start;
    uint256 end;
    bytes4 getter_selector;
    assembly {
      start := mload(0x40)
      end := add(start, 352)
      
      mstore(add(start, 0), _req_id)
      
      // smoelius: Moved from below.
      mstore(0x04, _req_id)
      
      }
        getter_selector = eib.get_supplier.selector;
      assembly {
      
      mstore(0x0, getter_selector)
      // smoelius: Moved to above.
      // mstore(0x04, _req_id)
      let get_supplier_gas_before := gas
      pop(call(block_gas_limit, eib_address, 0, 0, 0x24, 0, 0))
      let get_supplier_gas_after := gas
      returndatacopy(add(start, 32), 0, 32)
      
      mstore(add(start, 128), sub(get_supplier_gas_before, pre_getter_overhead))
      mstore(add(start, 160), add(get_supplier_gas_after, post_getter_overhead))
      
      }
        getter_selector = eib.get_data.selector;
      assembly {
      
      mstore(0x0, getter_selector)
      // smoelius: Moved to above.
      // mstore(0x04, _req_id)
      let get_data_gas_before := gas
      pop(call(block_gas_limit, eib_address, 0, 0, 0x24, 0, 0))
      let get_data_gas_after := gas
      mstore(add(start, 64), sub(end, start)) // smoelius: offset of length-prefixed data array
      let data_size := sub(returndatasize, 32)
      returndatacopy(end, 32, data_size)
      end := add(end, data_size)
      
      mstore(add(start, 192), sub(get_data_gas_before, pre_getter_overhead))
      mstore(add(start, 224), add(get_data_gas_after, post_getter_overhead))
      
      }
        getter_selector = eib.get_proof.selector;
      assembly {
      
      mstore(0x0, getter_selector)
      // smoelius: Moved to above.
      // mstore(0x04, _req_id)
      let get_proof_gas_before := gas
      pop(call(block_gas_limit, eib_address, 0, 0, 0x24, 0, 0))
      let get_proof_gas_after := gas
      mstore(add(start, 96), sub(end, start)) // smoelius: offset of length-prefixed proof array
      let proof_size := sub(returndatasize, 32)
      returndatacopy(end, 32, proof_size)
      end := add(end, proof_size)
      
      mstore(add(start, 256), sub(get_proof_gas_before, pre_getter_overhead))
      mstore(add(start, 288), add(get_proof_gas_after, post_getter_overhead))
      
      mstore(add(start, 320), end)
      
      log1(start, sub(end, start), proxy_callback_topic)
      
      if fail {
        revert(0, 0)
      }
      // jumpdest
      return(0, 0)
    }
  }
  
  /*==================================================================================================*/
  
  // smoelius: calculate_data_length and calculate_proof_length will likely move to another file.
  
  function calculate_data_length(uint128 /* _file_length */, uint128 _start, uint128 _end) internal
      pure returns(uint128) {
    return uint128(ceil_div(_end - _start, 32));
  }
  
  function calculate_proof_length(uint128 _start, uint128 _end, uint128 _file_length) internal
      pure returns(uint128) {
    uint128 proof_length = 0;
    if (_file_length > 0 && _start < _end) {
      uint height = ceil_log2(ceil_div(_file_length, 32));
      proof_length = _calculate_proof_length(height, 0, _start, _end, _file_length);
    }
    return proof_length;
  }
  
  function _calculate_proof_length(uint _height, uint128 _offset, uint128 _start, uint128 _end,
      uint128 _file_length) internal pure returns(uint128) {
    uint128 width = uint128(2 ** _height) * 32;
    if (_height == 0) {
      return 1;
    } else if (_offset + width / 2 >= ceil_div(_file_length, 32) * 32) {
      return _calculate_proof_length(_height - 1, _offset, _start, _end, _file_length);
    } else {
      if (_offset + width <= _start || _end <= _offset) {
        return 1;
      }
      uint128 left_length = _calculate_proof_length(_height - 1, _offset, _start, _end, _file_length);
      uint128 right_length = _calculate_proof_length(_height - 1, _offset + width / 2, _start, _end,
        _file_length);
      return left_length + right_length + 1;
    }
  }
  
  /*==================================================================================================*
   * Miscellaneous internal functions
   *==================================================================================================*/
  
  function ceil_log2(uint256 x) internal pure returns(uint) {
    assert(x > 0);
    x -= 1;
    uint e = 0;
    while (x > 0) {
      x /= 2;
      e += 1;
    }
    return e;
  }
  
  function ceil_div(uint256 x, uint256 y) internal pure returns(uint256) {
    return (x + y - 1) / y;
  }
  
  function square(uint256 x) internal pure returns(uint256) {
    return x * x;
  }
  
  /*==================================================================================================*/
  
}

/*====================================================================================================*/

