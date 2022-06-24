// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract testSale is ERC20 {
    constructor(uint256 initialSupply) ERC20("testSale", "SALE") {
        _mint(msg.sender, initialSupply);
    }
}
