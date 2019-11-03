pragma solidity 0.4.26;

interface IVault {
    function rawTotalBalance() external view returns (uint256);
    function rawBalanceOf(address _owner) external view returns (uint256);
}
