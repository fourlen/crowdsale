// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;


interface IStake {

    enum Levels {
        Platinum,
        Gold,
        Silver,
        Bronze,
        Iron
    }

    struct Staker {
        uint256 amount;
        uint256 lastCollectTimestamp;
    }

    struct LevelInfo {
        uint256 levelReward;
        uint256 threshold;
    }


    function deposit(uint256 _amount) external;

    function withdraw(uint256 _amount) external;

    function collectReward(bool is_redeposit) external;

    function changeLevelParameters(LevelInfo[5] memory _levelInfos) external;

    function getUserLevel(address staker) external view returns (Levels level);
}
