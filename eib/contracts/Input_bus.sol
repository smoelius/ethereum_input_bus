/*====================================================================================================*
 * Input_bus.sol
 *====================================================================================================*/

pragma solidity ^0.4.24;

/*====================================================================================================*/

contract Input_bus {
  
  /*==================================================================================================*
   * Constants
   *==================================================================================================*/
  
  enum file_address_type {
    IPFS_WITH_KECCAK256_MERKLE_ROOT
  }
  
  uint public constant N_WORDS_IPFSKEC256 = 3;
  
  uint public constant IPFSKEC256_IPFS_HASH   = 0; // IPFS SHA-256 hash
  uint public constant IPFSKEC256_FILE_LENGTH = 1; // file length
  uint public constant IPFSKEC256_MERKLE_ROOT = 2; // Keccak-256 Merkle root
  
  uint256 public constant FLAGS_NONE = 0;
  
  uint constant G_JUMPDEST = 1;
  
  uint constant C_JUMPDEST = G_JUMPDEST;
  
  /*==================================================================================================*
   * Datatypes
   *==================================================================================================*/
  
  uint constant N_FLAGS_STRUCT = 0;
  
  struct Request {
    uint256 flags;    // unused (future-proofing)
    address requestor;
    file_address_type file_addr_type;
    uint256[] file_addr;
    uint128 start;
    uint128 end;
    uint ltiov;       // latest time information of value; 0 (meaning no limit) or a block number
    bytes4 callback_id;
    uint256 callback_gas;
    uint value;       // in wei
    address supplier; // 0 until data has been supplied
    uint256[] data;
    uint256[] proof;
  }
  
  /*==================================================================================================*
   * Data members
   *==================================================================================================*/
  
  address owner;
  bool initialized;
  uint private next_req_id;
  mapping(uint => Request) private reqs;
  
  uint public n_announced;
  uint public n_canceled;
  uint public n_supplied;
  uint public n_paidout;
  
  /*==================================================================================================*
   * Events
   *==================================================================================================*/
  
  event Echo(uint256 value);
  
  event Request_announced(
    uint req_id,
    address requestor,
    file_address_type file_addr_type,
    uint256[] file_addr,
    uint128 start,
    uint128 end,
    uint ltiov,
    bytes4 callback_id,
    uint256 callback_gas,
    uint value
  );
  
  event Request_canceled(uint req_id);
  
  event Request_supplied(
    uint req_id,
    address supplier,
    bytes32[] data,
    bytes32[] proof,
    uint256 callback_gas_before,
    uint256 callback_gas_after,
    bool callback_result
  );
  
  event Request_paidout(uint req_id, address payee, uint value);
  
  /*==================================================================================================*
   * Constructor
   *==================================================================================================*/
  
  constructor() public {
    owner = msg.sender;
  }
  
  /*==================================================================================================*
   * Initialize (must be called after the contract is constructed)
   *==================================================================================================*/
  
  uint constant UNSUPPLY_REQ_ID = 0;
  
  function initialize() public {
    require(msg.sender == owner);
    
    uint256[] memory file_addr = new uint256[](3);
    
    require(UNSUPPLY_REQ_ID == this.request(
      FLAGS_NONE,                                        // _flags,
      file_address_type.IPFS_WITH_KECCAK256_MERKLE_ROOT, // _file_addr_type,
      file_addr,                                         // file_addr
      0,                                                 // _start,
      0,                                                 // _end,
      LTIOV_NONE,                                        // _ltiov,
      this.unsupply.selector,                            // _callback_id
      20000                                              // _callback_gas
    ));
    
    // smoelius: request(...) will increment n_announced.  Increment the other counts as well so that
    // each is over the zeroness hump.
    n_canceled++;
    n_supplied++;
    n_paidout++;
    
    initialized = true;
  }
  
  /*==================================================================================================*
   * Public interface
   *==================================================================================================*/
  
  function echo(uint256 value) public {
    emit Echo(value);
  }
  
  /*==================================================================================================*/
  
  // smoelius: These accessors are here primarily to allow the requestor to inquire about the request
  // during a callback.
  
  // TODO:
  // uint256 flags;
  // address requestor;
  // file_address_type file_addr_type;
  // uint256[] file_addr;
  // uint128 start;
  // uint128 end;
  // uint ltiov;
  // bytes4 callback_id;
  // uint256 callback_gas;
  // uint value;
  
  function get_supplier(uint _req_id) public view returns(address) {
    Request storage req = reqs[_req_id];
    require(req.requestor != 0);
    return req.supplier;
  }
  
  function get_data(uint _req_id) public view returns(uint256[]) {
    Request storage req = reqs[_req_id];
    require(req.requestor != 0);
    return req.data;
  }
  
  function get_proof(uint _req_id) public view returns(uint256[]) {
    Request storage req = reqs[_req_id];
    require(req.requestor != 0);
    return req.proof;
  }
  
  /*==================================================================================================*/
  
  uint constant N_FLAGS_REQUEST = 0;
  
  uint public constant LTIOV_NONE = 0;
  
  function request(
      uint256 _flags,
      file_address_type _file_addr_type,
      uint256[] _file_addr,
      uint128 _start,
      uint128 _end,
      uint _ltiov,
      bytes4 _callback_id,
      uint256 _callback_gas
  ) public payable returns(uint) {
    require(initialized || msg.sender == address(this));
    require(mask_left(_flags, 256 - N_FLAGS_REQUEST) == 0);
    require(_file_addr_type == file_address_type.IPFS_WITH_KECCAK256_MERKLE_ROOT);
    require(_file_addr.length == N_WORDS_IPFSKEC256);
    require(_end <= _file_addr[IPFSKEC256_FILE_LENGTH]);
    require(_start <= _end);
    
    Request storage req = reqs[next_req_id];
    req.requestor = msg.sender;
    req.file_addr_type = _file_addr_type;
    req.file_addr = new uint256[](N_WORDS_IPFSKEC256);
    for (uint i = 0; i < N_WORDS_IPFSKEC256; i++) {
      req.file_addr[i] = _file_addr[i];
    }
    req.start = _start;
    req.end = _end;
    req.ltiov = _ltiov;
    req.callback_id = _callback_id;
    req.callback_gas = _callback_gas;
    req.value = msg.value;
    
    uint req_id = next_req_id;
    next_req_id++;
    
    n_announced++;
    
    emit Request_announced(
      req_id,
      req.requestor,
      req.file_addr_type,
      req.file_addr,
      req.start,
      req.end,
      req.ltiov,
      req.callback_id,
      req.callback_gas,
      req.value
    );
    
    return req_id;
  }
  
  /*==================================================================================================*/
  
  uint constant N_FLAGS_CANCEL = 0;
  
  function cancel(uint256 _flags, uint _req_id) public {
    require(mask_left(_flags, 256 - N_FLAGS_CANCEL) == 0);
    
    Request storage req = reqs[_req_id];
    
    require(msg.sender == req.requestor);
    
    assert(req.requestor != 0);
    require(req.supplier == 0);
    
    n_canceled++;
    
    emit Request_canceled(_req_id);
    
    uint value = req.value;
    
    delete reqs[_req_id];
    
    msg.sender.transfer(value);
  }
  
  /*==================================================================================================*/
  
  uint public constant I_FLAG_SUPPLY_SIMULATE = 0;
  uint constant N_FLAGS_SUPPLY = 1;
  
  uint256 constant PRE_CALLBACK_OVERHEAD = 726;
  uint256 constant POST_CALLBACK_OVERHEAD = 7;
  uint256 constant PRE_RETURN_OVERHEAD = 265 + C_JUMPDEST;
  
  function supply(
      uint256 _flags,
      uint _req_id,
      uint256[] _data,
      uint256[] _proof
  ) public {
    require(mask_left(_flags, 256 - N_FLAGS_SUPPLY) == 0);
    
    Request storage req = reqs[_req_id];
    // smoelius: Ensure that the gas cost is the same regardless of whether FLAG_SUPPLY_SIMULATE is
    // set.  This is tricky.  Tread carefully!
    Request storage callback_req = reqs[(1 - _flags) * _req_id];
    
    require(req.requestor != 0);
    require(req.supplier == 0);
    
    validate_data_proof(req.file_addr_type, req.file_addr, req.start, req.end, _data, _proof);
    
    require(req.ltiov == LTIOV_NONE || block.number <= req.ltiov);
    
    req.supplier = msg.sender;
    req.data = _data;
    req.proof = _proof;
    
    n_supplied++;
    
    uint256 callback_gas_before;
    uint256 callback_gas_after;
    bool callback_result;
    
    (callback_gas_before, callback_gas_after, callback_result)
      = activate_callback(_req_id, callback_req);
    
    emit Request_supplied(
      _req_id,
      msg.sender,
      bytes32_from_uint256(_data),
      bytes32_from_uint256(_proof),
      callback_gas_before,
      callback_gas_after,
      callback_result
    );
    
    /* smoelius: DO NOT DO THIS HERE!
     *
     *   delete req.data;
     *   delete req.proof;
     *
     * These two deletes introduce a huge refund, which complicates gas cost calculation.  The supplier
     * is going to experience the refund one way or another.  Let them experience it when the request
     * is deleted during the payout. */
    
    // smoelius: Use of assembly helps to ensure that the path between the GAS and RETURN instructions
    // is straight-line code.
    
    // smoelius: A right-shift is used to compute the gas cap.  If you use a divide, then Solidity will
    // insert a branch.
    
    uint256 gas_cap = callback_gas_before - (callback_gas_before >> 6);
    
    uint256 post_callback_gas_used = callback_gas_after - (gasleft() - PRE_RETURN_OVERHEAD);
    
    bool fail = gas_cap < post_callback_gas_used + req.callback_gas;
    assembly {
      if fail {
        revert(0, 0)
      }
      // smoelius: Currently, the cost of the return-path is one more than that of the revert-path due
      // to the presence of a JUMPDEST instruction.  Note that you want the cost of the revert-path to
      // be no more than the cost of the return-path.
      // jumpdest
      return(0, 0)
    }
  }
  
  function validate_data_proof(
      file_address_type _file_addr_type,
      uint256[] _file_addr,
      uint128 _start,
      uint128 _end,
      uint256[] _data,
      uint256[] _proof
  ) internal view {
    assert(_file_addr_type == file_address_type.IPFS_WITH_KECCAK256_MERKLE_ROOT);
    assert(_file_addr.length == N_WORDS_IPFSKEC256);
    uint128 file_length = uint128(_file_addr[IPFSKEC256_FILE_LENGTH]);
    assert(_end <= file_length);
    assert(_start <= _end);
    
    require(_data.length == ceil_div(_end - _start, 32));
    require(_data.length == 0
      || (_end - _start) % 32 == 0
      || mask_right(_data[_data.length - 1], 256 - (_end - _start) % 32 * 8) == 0);
    
    if (file_length == 0 || _data.length == 0) {
      require(_proof.length == 0);
    } else {
      uint height = ceil_log2(ceil_div(file_length, 32));
      uint root_index = kec256_validate_data_proof(height, 0, file_length, _start, _end, _data, 0,
        _proof);
      require(root_index == _proof.length - 1);
      uint256 root = _file_addr[IPFSKEC256_MERKLE_ROOT];
      require(root == _proof[root_index]);
    }
  }
  
  function kec256_validate_data_proof(
      uint _height,
      uint128 _offset,
      uint128 _file_length,
      uint128 _start,
      uint128 _end,
      uint256[] _data,
      uint _proof_index,
      uint256[] _proof
  ) internal view returns(uint) {
    uint128 width = uint128(2 ** _height) * 32;
    if (_height == 0) {
      if (!(_offset + width <= _start || _end <= _offset)) {
        kec256_validate_data_proof_leaf(_offset, _start, _end, _data, _proof[_proof_index]);
      }
      return _proof_index;
    } else if (_offset + width / 2 >= ceil_div(_file_length, 32) * 32) {
      return kec256_validate_data_proof(_height - 1, _offset, _file_length, _start, _end, _data,
        _proof_index, _proof);
    } else {
      if (_offset + width <= _start || _end <= _offset) {
        return _proof_index;
      }
      uint left_index = kec256_validate_data_proof(_height - 1, _offset, _file_length, _start, _end,
        _data, _proof_index, _proof);
      uint right_index = kec256_validate_data_proof(_height - 1, _offset + width / 2, _file_length,
        _start, _end, _data, left_index + 1, _proof);
      uint root_index = right_index + 1;
      require(root_index < _proof.length);
      require(uint256(keccak256(abi.encodePacked(_proof[left_index], _proof[right_index])))
        == _proof[root_index]);
      return root_index;
    }
  }
  
  function kec256_validate_data_proof_leaf(
      uint128 _offset,
      uint128 _start,
      uint128 _end,
      uint256[] _data,
      uint256 _proof_leaf
  ) internal pure {
    uint index;
    uint shift;
    uint256 shifted_data;
    
    if (_offset <= _start) {
      assert(_start < _offset + 32);
      index = 0;
      shift = (_start - _offset) * 8;
      shifted_data = 0;
    } else {
      assert(_offset < _end);
      index = (_offset - _start) / 32 + 1;
      require(index - 1 < _data.length);
      shift = 256 - (_offset - _start) % 32 * 8;
      shifted_data = shift_left(_data[index - 1], 256 - shift);
    }
    
    if (index < _data.length) {
      shifted_data += shift_right(_data[index], shift);
    }
    
    if (_offset < _start) {
      _proof_leaf = mask_right(_proof_leaf, (_offset + 32 - _start) * 8);
    }
    
    if (_end < _offset + 32) {
      _proof_leaf = mask_left(_proof_leaf, (_end - _offset) * 8);
    }
    
    require(shifted_data == _proof_leaf);
  }
  
  function activate_callback(uint _req_id, Request storage _req) internal returns(uint, uint, bool) {
    // smoelius: Use of assembly helps to ensure that the gas cost of the instructions between the GAS
    // and CALL instructions is predictable, e.g., there are no MSTORE instructions.
    
    address requestor = _req.requestor;
    bytes4 callback_id = _req.callback_id;
    uint256 callback_gas = _req.callback_gas;
    
    uint256 callback_gas_before;
    uint256 callback_gas_after;
    bool callback_result;
    
    assembly {
      mstore(0x00, callback_id)
      mstore(0x04, _req_id)
      callback_gas_before := gas
      callback_result := call(callback_gas, requestor, 0, 0, 0x24, 0, 0)
      callback_gas_after := gas
    }
    
    callback_gas_before -= PRE_CALLBACK_OVERHEAD;
    callback_gas_after += POST_CALLBACK_OVERHEAD;
    
    return (callback_gas_before, callback_gas_after, callback_result);
  }
  
  // smoelius: Making unsupply payable eliminates a CALLVALUE check.
  
  function unsupply(uint _req_id) public payable {
    Request storage req = reqs[_req_id];
    
    req.supplier = 0;
    
    n_supplied--;
    
    bool fail = 0 != (uint256(msg.sender) - uint256(owner)) * (uint256(msg.sender) - uint256(this));
    assembly {
      if fail {
        revert(0, 0)
      }
      return(0, 0)
    }
  }
  
  /*==================================================================================================*/
  
  uint constant N_FLAGS_PAYOUT = 0;
  
  address public constant PAYEE_DEFAULT = 0;
  
  function payout(uint256 _flags, uint _req_id, address _payee) public {
    require(mask_left(_flags, 256 - N_FLAGS_PAYOUT) == 0);
    
    Request storage req = reqs[_req_id];
    
    require(msg.sender == req.supplier);
    
    assert(req.requestor != 0);
    assert(req.supplier != 0);
    
    if (_payee == PAYEE_DEFAULT) {
      _payee = msg.sender;
    }
    
    n_paidout++;
    
    emit Request_paidout(_req_id, _payee, req.value);
    
    uint value = req.value;
    
    delete reqs[_req_id];
    
    _payee.transfer(value);
  }
  
  /*==================================================================================================*
   * Miscellaneous internal functions
   *==================================================================================================*/
  
  function bytes32_from_uint256(uint256[] memory xs) internal pure returns(bytes32[]) {
    bytes32[] memory result;
    assembly {
      result := xs
    }
    return result;
  }
  
  function get_bit(uint256 x, uint i) internal pure returns(bool) {
    return shift_right(x, i) % 2 != 0;
  }
  
  function set_bit(uint256 x, uint i) internal pure returns(uint256) {
    if (!get_bit(x, i)) {
      x += shift_left(1, i);
    }
    return x;
  }
  
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
  
  function mask_left(uint256 x, uint n) internal pure returns(uint256) {
    if (n >= 256) {
      return x;
    } else {
      return x - mask_right(x, 256 - n);
    }
  }
  
  function mask_right(uint256 x, uint n) internal pure returns(uint256) {
    if (n >= 256) {
      return x;
    } else {
      return x % 2 ** n;
    }
  }
  
  function shift_left(uint256 x, uint n) internal pure returns(uint256) {
    if (n >= 256) {
      return 0;
    } else {
      return x * 2 ** n;
    }
  }
  
  function shift_right(uint256 x, uint n) internal pure returns(uint256) {
    if (n >= 256) {
      return 0;
    } else {
      return x / 2 ** n;
    }
  }
  
  /*==================================================================================================*/
  
}

/*====================================================================================================*/
