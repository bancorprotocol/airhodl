pragma solidity 0.4.26;
import '../AirHodlConverter.sol';

contract TestAirHodlConverter is AirHodlConverter {
    uint256 private epoch = 1;

    constructor(ISmartToken _token, IContractRegistry _registry, IERC20Token _reserveToken, uint256 _vestingLength)
    AirHodlConverter(_token, _registry, _reserveToken, _vestingLength)
    public {
    }

    function jump(uint256 _seconds) external {
        epoch += _seconds;
    }

    function time() internal view returns (uint256) {
        return epoch;
    }
}
