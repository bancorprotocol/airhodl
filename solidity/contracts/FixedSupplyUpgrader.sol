pragma solidity 0.4.26;
import './utility/TokenHolder.sol';
import './token/interfaces/IERC20Token.sol';
import './token/interfaces/ISmartToken.sol';

interface IConverterWrapper {
    function token() external view returns (IERC20Token);
    function connectorTokens(uint256 _index) external view returns (IERC20Token);
    function getConnectorBalance(IERC20Token _connectorToken) external view returns (uint256);
    function withdrawTokens(IERC20Token _token, address _to, uint256 _amount) external;
    function disableConversions(bool _disable) external;
    function transferOwnership(address _newOwner) external;
    function acceptOwnership() external;
    function acceptTokenOwnership() external;
}

contract FixedSupplyUpgrader is TokenHolder {
    constructor() TokenHolder() public {
    }

    function execute(IConverterWrapper _oldConverter, IConverterWrapper _newConverter, address _airHodlConverter, uint256 _bntAmount) external
        ownerOnly
        validAddress(_oldConverter)
        validAddress(_newConverter)
        validAddress(_airHodlConverter)
    {
        IERC20Token bntToken = _oldConverter.token();
        IERC20Token ethToken = _oldConverter.connectorTokens(0);
        ISmartToken relayToken = ISmartToken(_newConverter.token());
        relayToken.acceptOwnership();
        _oldConverter.acceptOwnership();
        _newConverter.acceptOwnership();
        _oldConverter.disableConversions(true);
        _oldConverter.withdrawTokens(ethToken, _newConverter, _oldConverter.getConnectorBalance(ethToken));
        require(bntToken.transfer(_newConverter, _bntAmount));
        require(bntToken.transfer(owner, bntToken.balanceOf(this)));
        relayToken.issue(_airHodlConverter, _bntAmount);
        relayToken.issue(owner, _bntAmount);
        relayToken.transferOwnership(_newConverter);
        _newConverter.acceptTokenOwnership();
        _newConverter.transferOwnership(owner);
        _oldConverter.transferOwnership(owner);
    }
}
