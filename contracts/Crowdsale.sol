// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./interfaces/IStake.sol";

contract Crowdsale is Ownable, ReentrancyGuard {
    IUniswapV2Router02 public immutable router;
    IERC20Metadata public immutable saleToken;
    IERC20Metadata public immutable paymentToken;
    IStake public immutable stake;

    uint256 public saleTokenAmount;
    uint256 public dexTokenPercent;
    uint256 public price; //1/10^decimals of payment tokens
    uint256 public tokenSold;
    uint256 public tokenClaimedAmount;
    bool public saleStarted;
    bool public saleFinished;

    mapping(address => uint256) public userPurchasedTokens;
    mapping(IStake.Levels => uint256) public levelPoolAccess; //percents (for exmaple Iron level can buy only 5% of pool)

    event crowdsaleStarted();
    event crowdsaleFinished();
    event tokenPurchased(address buyer, uint256 amount);
    event tokenClaimed(address user, uint256 amount);
    event ownerClaimed(uint256 saleTokenAmount, uint256 paymentTokenAmount);

    constructor(
        IUniswapV2Router02 _router,
        IERC20Metadata _saleToken,
        IERC20Metadata _paymentToken,
        IStake _stake,
        uint256 _saleTokenAmount,
        uint256 _dexTokenPercent,
        uint256 _price,
        uint256[5] memory _levelPoolPercent //from platinum to iron
    ) {
        require(
            address(_saleToken) != address(0) &&
                address(_paymentToken) != address(0),
            "Token addressess can't be 0"
        );
        require(_saleTokenAmount != 0, "Token amount can't be 0");
        require(_price != 0, "Price can't be 0");
        require(address(_stake) != address(0), "Stake address can't be 0");
        require(address(_router) != address(0), "Router address can't be 0");
        uint256 percentSum = 0;
        for (uint8 i = 0; i < 5; i++) {
            percentSum += _levelPoolPercent[i];
            levelPoolAccess[IStake.Levels(i)] = _levelPoolPercent[i];
        }
        require(percentSum == 100, "Sum of percents must be 100");
        router = _router;
        saleToken = _saleToken;
        paymentToken = _paymentToken;
        saleTokenAmount = _saleTokenAmount;
        dexTokenPercent = _dexTokenPercent;
        price = _price;
        stake = _stake;
    }

    //      started  finished           started  finished        started  finished
    //presale(0         0)          sale(1          0)      finished(1      1)
    function startCrowdsale() external onlyOwner {
        require(!saleStarted && !saleFinished, "Sale is already active");
        require(
            saleToken.balanceOf(address(this)) >=
                saleTokenAmount + (saleTokenAmount * dexTokenPercent) / 100,
            "insufficient balance of token for sale"
        );
        saleStarted = true;
        emit crowdsaleStarted();
    }

    function finishCrowdsale() external onlyOwner {
        require(
            saleStarted && !saleFinished,
            "Sale is already finished or hasn't started"
        );
        uint256 saleTokensToDex = (tokenSold * dexTokenPercent) / 100;
        uint256 paymentTokenToDex = (saleTokensToDex * price) /
            (10 ** saleToken.decimals());
        saleFinished = true;
        saleToken.approve(address(router), saleTokensToDex);
        paymentToken.approve(address(router), paymentTokenToDex);
        router.addLiquidity(
            address(saleToken),
            address(paymentToken),
            saleTokensToDex,
            paymentTokenToDex,
            0,
            0,
            _msgSender(),
            block.timestamp
        );
        emit crowdsaleFinished();
    }

    //amount in wei
    function buy(uint256 _amount) external nonReentrant {
        require(_amount <= saleTokenAmount - tokenSold, "Amount too big"); //not saleToken.balanceOf(address(this)) because giveaway will be after addLigiuidity
        tokenSold += _amount;
        address sender = _msgSender();
        require(
            userPurchasedTokens[sender] + _amount <=
                (saleTokenAmount *
                    levelPoolAccess[stake.getUserLevel(sender)]) /
                    100,
            "Amount too big for your level"
        );
        userPurchasedTokens[sender] += _amount;
        SafeERC20.safeTransferFrom(
            paymentToken,
            sender,
            address(this),
            (_amount * price) / (10 ** saleToken.decimals())
        );
        emit tokenPurchased(sender, _amount);
    }

    function claim() external nonReentrant {
        require(saleStarted && saleFinished, "Can claim only after finish");
        address sender = _msgSender();
        uint256 balance = userPurchasedTokens[sender];
        require(balance != 0, "Can't claim 0 tokens");
        userPurchasedTokens[sender] = 0;
        tokenClaimedAmount += balance;
        SafeERC20.safeTransfer(saleToken, sender, balance);
        emit tokenClaimed(sender, balance);
    }

    function claimForOwner() external onlyOwner {
        require(saleStarted && saleFinished, "Can claim only after finish");
        uint256 saleTokenBalance = saleToken.balanceOf(address(this));
        uint256 paymentTokenBalance = paymentToken.balanceOf(address(this));
        address sender = _msgSender();
        SafeERC20.safeTransfer(
            saleToken,
            sender,
            saleTokenBalance - (tokenSold - tokenClaimedAmount)
        );
        SafeERC20.safeTransfer(paymentToken, sender, paymentTokenBalance);
        emit ownerClaimed(
            saleTokenBalance - (tokenSold - tokenClaimedAmount),
            paymentTokenBalance
        );
    }
}
