pragma solidity 0.4.26;
import './utility/Owned.sol';
import './token/interfaces/IERC20Token.sol';

contract AirDropper is Owned {
    IERC20Token public token;

    mapping (address => uint256) public balances;

    constructor(IERC20Token _token) public {
        token = _token;
    }

    function execute(address[] _targets, uint256[] _amounts) external ownerOnly {
        uint256 length = _targets.length;
        require(length == _amounts.length);
        for (uint256 i = 0; i < length; i++) {
            address target = _targets[i];
            uint256 amount = _amounts[i];
            require(balances[target] == 0);
            require(token.transfer(target, amount));
            balances[target] = amount;
        }
    }
}
