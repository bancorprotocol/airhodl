pragma solidity 0.4.26;
import './token/interfaces/IERC20Token.sol';

interface IConverter {
    function token() external view returns (address);
    function connectorTokenCount() external view returns (uint16);
    function connectorTokens(uint256 _index) external view returns (IERC20Token);
    function reserveTokenCount() external view returns (uint16);
    function reserveTokens(uint256 _index) external view returns (IERC20Token);
}
