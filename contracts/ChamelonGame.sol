// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ChameleonGame {
    address public owner;
    uint256 public constant COIN_VAL = 0.0001 ether;

    constructor() payable {
        owner = msg.sender;
    }

    // Direct claim: 1 coin = 0.0001 Sepolia ETH
    function claimReward(uint256 coinCount) external {
        uint256 rewardAmount = coinCount * COIN_VAL;
        require(address(this).balance >= rewardAmount, "Insufficient contract balance for reward");
        payable(msg.sender).transfer(rewardAmount);
    }

    // Fallback function to accept direct funds into the contract pool
    receive() external payable {}

    // Owner can withdraw all funds
    function withdraw(uint256 amount) external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(amount);
    }
}