// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IStake.sol";

contract Stake is IStake, Ownable, ReentrancyGuard {
    IERC20Metadata public immutable stakedToken;

    mapping(address => Staker) public stakers;

    mapping(Levels => LevelInfo) public levelInfos;


    event Deposit(address indexed staker, uint256 amount);
    event RewardCollected(address indexed staker, uint256 reward);
    event RewardPercentChanged(uint256[5] rewardPercents);
    event ThresholdChanged(Levels level, uint256 threshold);

    //заменил на массив, теперь нужно передавать проценты от Platinum к Iron.
    constructor(
        IERC20Metadata _stakedToken,
        uint256[5] memory rewardPercents,
        uint256[4] memory _thresholds //4, потому что для Iron всегда 0
    ) {
        stakedToken = _stakedToken;
        for (uint8 i = 0; i < 5; i++) {
            require(rewardPercents[i] != 0, "Percent must be > 0");
            levelInfos[Levels(i)].levelReward = rewardPercents[i];
            if (i < 4) {
                require(
                    _thresholds[i] > levelInfos[Levels(i + 1)].threshold,
                    "Threshold must be greater than threshold of previous level"
                );
                levelInfos[Levels(i)].threshold = _thresholds[i];
            }
        }
    }

    function deposit(uint256 _amount) external nonReentrant {
        //deposit
        address sender = _msgSender();
        Staker storage staker = stakers[sender];
        require(_amount != 0, "Amount must be non-zero");
        _collectReward(true);
        staker.amount += _amount;
        SafeERC20.safeTransferFrom(
            stakedToken,
            sender, //опустил пониже, но не ниже staker.amount +=, чтобы если транзакция завалилась, стекейру amount не прибавился
            address(this), //safeTransferFrom не возвращает bool, поэтому проеврку убрал
            _amount
        );
        emit Deposit(sender, _amount);
    }

    function withdraw(uint256 _amount) external nonReentrant {
        address sender = _msgSender();
        Staker storage staker = stakers[sender];
        _collectReward(true);
        require(staker.amount >= _amount, "Not enough tokens");
        staker.amount -= _amount;
        if (staker.amount == 0) {
            delete stakers[sender];
        }
        SafeERC20.safeTransfer(stakedToken, sender, _amount);
    }

    function collectReward(bool is_redeposit) external nonReentrant {
        uint256 reward = _collectReward(is_redeposit);
        emit RewardCollected(_msgSender(), reward);
    }

    function changeLevelParameters(LevelInfo[5] memory _levelInfos)
        external
        nonReentrant
        onlyOwner
    {
        require(
            _levelInfos[4].threshold == 0,
            "Threshold for Iron level must be 0"
        );
        for (uint8 i = 0; i < 5; i++) {
            require(_levelInfos[i].levelReward != 0, "Percent must be > 0");
            levelInfos[Levels(i)].levelReward = _levelInfos[i].levelReward;
            if (i != 4) {
                require(
                    _levelInfos[i].threshold >
                        levelInfos[Levels(i + 1)].threshold,
                    "Threshold must be greater than threshold of previous level"
                );
            }
            levelInfos[Levels(i)].threshold = _levelInfos[i].threshold;
        }
    }

    function getUserLevel(address staker) external view returns (Levels level) {
        return calculateLevel(stakers[staker].amount);
    }

    function calculateLevel(uint256 _amount)
        internal
        view
        returns (Levels level)
    {
        if (_amount > 0 && _amount < levelInfos[Levels.Bronze].threshold) {
            return Levels.Iron;
        } else if (
            _amount >= levelInfos[Levels.Bronze].threshold &&
            _amount < levelInfos[Levels.Silver].threshold
        ) {
            return Levels.Bronze;
        } else if (
            _amount >= levelInfos[Levels.Silver].threshold &&
            _amount < levelInfos[Levels.Gold].threshold
        ) {
            return Levels.Silver;
        } else if (
            _amount >= levelInfos[Levels.Gold].threshold &&
            _amount < levelInfos[Levels.Platinum].threshold
        ) {
            return Levels.Gold;
        } else if (_amount >= levelInfos[Levels.Platinum].threshold) {
            return Levels.Platinum;
        }
    }

    function calculateReward(Staker memory staker)
        internal
        view
        returns (uint256)
    {
        return
            (staker.amount *
                levelInfos[calculateLevel(staker.amount)].levelReward *
                (block.timestamp - staker.lastCollectTimestamp)) /
            (100 * 365 * 86400);
    }

    function _collectReward(bool is_redeposit) private returns (uint256) {
        uint256 blockTimestamp = block.timestamp;
        address sender = _msgSender();
        Staker storage staker = stakers[sender];
        if (staker.lastCollectTimestamp == 0) {
            staker.lastCollectTimestamp = blockTimestamp;
            return 0;
        }
        uint256 reward = calculateReward(staker);
        staker.lastCollectTimestamp = blockTimestamp;
        if (is_redeposit) {
            staker.amount += reward;
        } else {
            SafeERC20.safeTransfer(stakedToken, sender, reward);
        }
        return reward;
    }
}
