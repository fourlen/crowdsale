// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../contracts/interfaces/IStake.sol";
import "hardhat/console.sol";

contract Crowdsale is Ownable, ReentrancyGuard {
    event crowdsaleStarted();
    event crowdsaleFinished();
    event tokenPurchased(address buyer, uint256 amount);
    event tokenClaimed(address user, uint256 amount);
    event ownerClaimed(uint256 saleTokenAmount, uint256 paymentTokenAmount);

    IUniswapV2Router02 public immutable router =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); //uniswap router address
    IERC20Metadata public saleToken;
    IERC20Metadata public paymentToken;
    IStake public stake;

    uint256 public saleTokenAmount;
    uint256 public dexTokenPercent;
    uint256 public price; //wei of paymentToken for 1 sale token
    uint256 public tokenSold;
    uint256 public tokenClaimedAmount;
    bool public saleStarted;
    bool public saleFinished;

    mapping(address => uint256) userPurchasedTokens;
    mapping(IStake.Levels => uint256) levelPoolAccess; //percents (for exmaple Iron level can buy only 5% of pool)

    constructor(
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
        require(_saleTokenAmount != 0, "Token amount can't be 0"); //хз ставить проверку на dexTokenPerecent или нет, по идее мы же можем
        //мы же можем захеть чтобы ни одного токена не пошло на декс или, наоборот, в 3 раза больше токенов пошло на декс
        require(_price != 0, "Price can't be 0");
        require(address(_stake) != address(0), "Stake address can't be 0");
        uint256 percentSum = 0;
        for (uint8 i = 0; i < 5; i++) {
            percentSum += _levelPoolPercent[i];
            levelPoolAccess[IStake.Levels(i)] = _levelPoolPercent[i];
        }
        //хз нужно ли ставить проверку на то, что процент с повышением уровня должен повышаться, мало ли что придет в голову тому,
        //кто будет пользоваться этим контрактом, в этом плане у него больше свободы
        require(percentSum == 100, "Sum of percents must be 100");
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
                saleTokenAmount + saleTokenAmount * dexTokenPercent / 100,
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
        uint256 paymentTokenToDex = saleTokensToDex * price;
        saleFinished = false;
        router.addLiquidity(
            address(saleToken),
            address(paymentToken),
            saleTokensToDex,
            paymentTokenToDex,
            saleTokensToDex,
            paymentTokenToDex,
            _msgSender(),
            block.timestamp + 1800
        ); //30 min
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
            _amount * price
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
        SafeERC20.safeTransfer(saleToken, sender, saleTokenBalance - (tokenSold - tokenClaimedAmount));
        SafeERC20.safeTransfer(paymentToken, sender, paymentTokenBalance);
        emit ownerClaimed(saleTokenBalance - tokenSold, paymentTokenBalance);
    }
}
