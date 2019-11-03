pragma solidity 0.4.26;
import './converter/BancorConverter.sol';

contract AirHodlConverter is BancorConverter {
    using SafeMath for uint256;

    uint256 public vestingLength;
    uint256 public vestingStart;

    constructor(ISmartToken _token, IContractRegistry _registry, IERC20Token _reserveToken, uint256 _vestingLength)
    BancorConverter(_token, _registry, 0, _reserveToken, 1000000)
    public {
        vestingLength = _vestingLength;
    }

    function activate() external ownerOnly {
        require(vestingStart == 0, "already activated");
        vestingStart = time();
    }

    function getReserveBalance(IERC20Token _reserveToken) public view returns (uint256) {
        require(vestingStart > 0, "not yet activated");
        uint256 vestingPeriod = time() - vestingStart;
        if (vestingPeriod > vestingLength)
            vestingPeriod = vestingLength;
        return super.getReserveBalance(_reserveToken).mul(vestingPeriod).div(vestingLength);
    }

    function time() internal view returns (uint256){
        return now;
    }
}
