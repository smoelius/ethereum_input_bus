/*====================================================================================================*
 * Spellcheck.sol
 *====================================================================================================*/

pragma solidity ^0.4.24;

/*====================================================================================================*/

import "contracts/Input_bus.sol";
import "Dict.sol";

/*====================================================================================================*/

contract Spellcheck {
  
  /*==================================================================================================*
   * Constants
   *==================================================================================================*/
  
  byte constant NEWLINE = 0xa;
  
  uint constant CALLBACK_GAS = 400000;
  
  /*==================================================================================================*
   * Datatypes
   *==================================================================================================*/
  
  struct Spellcheck_struct {
    address requestor;
    bytes word;
    uint value;
    uint req_value;
    uint128 low;
    uint128 high;
  }
  
  /*==================================================================================================*
   * Data members
   *==================================================================================================*/
  
  Input_bus public eib;
  uint private next_sc_id;
  mapping(uint => Spellcheck_struct) private scs;
  mapping(uint => uint) private sc_id_from_req_id;
  
  uint public n_initiated;
  uint public n_ended;
  uint public n_refunded;
  uint public n_reqs;
  
  /*==================================================================================================*
   * Events
   *==================================================================================================*/
  
  event Spellcheck_init(
    uint sc_id,
    address requestor,
    string word,
    uint value,
    uint req_value
  );
  
  event Spellcheck_update(
    uint sc_id,
    uint128 low,
    uint128 high,
    uint req_id,
    uint128 start,
    uint128 end
  );
  
  event Spellcheck_end(
    uint sc_id,
    bool valid,
    uint unspent_value
  );
  
  event Spellcheck_refund(
    uint sc_id,
    uint value
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
  
  function dict() public pure returns(address) {
    address result;
    assembly {
      result := Dict
    }
    return result;
  }
  
  function spellcheck(
      string _word
  ) public payable returns(uint) {
    uint128 file_length = uint128(Dict.file_addr()[1]);
    
    /* smoelius: Not accounting for the linear search that occurs when the the lower and upper bounds
     * are close...  A file of length, say, 14 consists of at most 7 words, and therefore requires at
     * most 3 look-ups. */
    uint req_value = file_length <= 0 ? 0 : msg.value / ceil_log2(1 + ceil_div(file_length, 2));
    
    Spellcheck_struct storage sc = scs[next_sc_id];
    sc.requestor = msg.sender;
    sc.word = bytes(_word);
    sc.value = msg.value;
    sc.req_value = req_value;
    sc.low = 0;
    sc.high = file_length;
    
    uint sc_id = next_sc_id;
    next_sc_id++;
    
    n_initiated++;
    
    emit Spellcheck_init(
      sc_id,
      sc.requestor,
      string(sc.word),
      sc.value,
      sc.req_value
    );
    
    search(sc_id, sc);
    
    return sc_id;
  }
  
  function search(uint _sc_id, Spellcheck_struct storage sc) internal {
    if (sc.low >= sc.high) {
      n_ended++;
      emit Spellcheck_end(_sc_id, false, sc.value);
      if (sc.value <= 0) {
        n_refunded++;
        delete scs[_sc_id];
      }
      return;
    }
    
    uint256[] memory file_addr = Dict.file_addr();
    uint longest_word_length = Dict.longest_word_length();
    uint max_length = 2 * (longest_word_length + 1);
    
    uint128 start;
    uint128 end;
    if (uint256(sc.low) + max_length >= uint256(sc.high)) {
      start = sc.low;
      end = sc.high;
    } else {
      start = uint128((uint256(sc.low) + uint256(sc.high) - max_length) / 2);
      end = uint128(uint256(start) + max_length);
    }
    
    assert(sc.value >= sc.req_value);
    sc.value -= sc.req_value;
    
    uint req_id = eib.request.value(sc.req_value)(
      0, // no flags
      Input_bus.file_address_type.IPFS_WITH_KECCAK256_MERKLE_ROOT,
      file_addr,
      start,
      end,
      0, // no ltiov
      this.callback.selector,
      CALLBACK_GAS
    );
    
    emit Spellcheck_update(
      _sc_id,
      sc.low,
      sc.high,
      req_id,
      start,
      end
    );
    
    n_reqs++;
    sc_id_from_req_id[req_id] = _sc_id;      //  ---+
  }                                          //     |
                                             //     |
  function callback(uint _req_id) public {   //     |
    require(msg.sender == address(eib));     //     |
                                             //     |
    uint sc_id = sc_id_from_req_id[_req_id]; //  <--+
    delete sc_id_from_req_id[_req_id];
    n_reqs--;
    
    Spellcheck_struct storage sc = scs[sc_id];
    
    require(sc.requestor != 0);
    
    uint256[] memory data = eib.get_data(_req_id);
    
    // smoelius: There are guaranteed to be at least two newlines in any consecutive
    // 2 * (longest_word_length + 1) bytes drawn from the dictionary.
    uint longest_word_length = Dict.longest_word_length();
    uint max_length = 2 * (longest_word_length + 1);
    
    if (sc.low + max_length >= sc.high) {
      uint length = sc.high - sc.low;
      
      uint i = memstr(data, 0, length, sc.word);
      
      n_ended++;
      
      emit Spellcheck_end(
        sc_id,
        i < length
          && (i <= 0 || ith_byte(data, i - 1) == NEWLINE)
          && (i + sc.word.length >= length || ith_byte(data, i + sc.word.length) == NEWLINE),
        sc.value
      );
      
      if (sc.value <= 0) {
        n_refunded++;
        delete scs[sc_id];
      }
    } else {
      uint128 start = uint128((uint256(sc.low) + uint256(sc.high) - max_length) / 2);
      
      uint fst = memchr(data, 0, max_length, NEWLINE);
      uint snd = memchr(data, fst + 1, max_length, NEWLINE);
      assert(snd < max_length);
      
      int cmp = strmemcmp(sc.word, data, fst + 1, snd);
      if (cmp < 0) {
        sc.high = uint128(uint256(start) + fst + 1);
        search(sc_id, sc);
      } else if (cmp == 0) {
        n_ended++;
        emit Spellcheck_end(sc_id, true, sc.value);
        if (sc.value <= 0) {
          n_refunded++;
          delete scs[sc_id];
        }
      } else {
        sc.low = uint128(uint256(start) + snd + 1);
        search(sc_id, sc);
      }
    }
  }
  
  /*==================================================================================================*/
  
  function refund(uint _sc_id) public {
    Spellcheck_struct storage sc = scs[_sc_id];
    
    require(msg.sender == sc.requestor);
    
    n_refunded++;
    
    emit Spellcheck_refund(_sc_id, sc.value);
    
    uint unspent_value = sc.value;
    
    delete scs[_sc_id];
    
    msg.sender.transfer(unspent_value);
  }
  
  /*==================================================================================================*
   * Internal string/memory functions
   *==================================================================================================*/
  
  function memstr(uint256[] memory data, uint start, uint end, bytes memory s) internal pure
      returns(uint) {
    if (start + s.length > end) {
      return end;
    }
    uint i = start;
    while (i <= end - s.length) {
      if (strmemcmp(s, data, i, i + s.length) == 0) {
        return i;
      }
      i++;
    }
    return end;
  }
  
  function strmemcmp(bytes memory s, uint256[] memory data, uint start, uint end) internal pure
      returns(int) {
    uint i = 0;
    uint j = start;
    while (i < s.length && j < end) {
      if (s[i] < ith_byte(data, j)) {
        return -1;
      } else if (s[i] > ith_byte(data, j)) {
        return 1;
      }
      i++;
      j++;
    }
    if (i < s.length) {
      return 1;
    }
    if (j < end) {
      return -1;
    }
    return 0;
  }
  
  function memchr(uint256[] memory data, uint start, uint end, byte c) internal pure returns(uint) {
    uint i = start;
    while (i < end) {
      if (ith_byte(data, i) == c) {
        break;
      }
      i++;
    }
    return i;
  }
  
  function ith_byte(uint256[] data, uint i) internal pure returns(byte) {
    return bytes32(data[i / 32])[i % 32];
  }
  
  /*==================================================================================================*
   * Internal math functions
   *==================================================================================================*/
  
  function min(uint256 x, uint256 y) internal pure returns(uint256) {
    return x <= y ? x : y;
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
  
  /*==================================================================================================*/
  
}

/*====================================================================================================*/
