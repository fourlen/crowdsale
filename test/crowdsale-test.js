const { expect } = require("chai");
const { utils } = require("ethers");
const { ethers } = require("hardhat");

saleTokenTest = null;
paymentTokenTest = null;
stake = null;
crowdsale = null;
const hund_tokens = utils.parseEther("100");

describe("Deployment, transfering tokens, approvance and testing crowdsale", function () {
  

  it("Should deploy saleToken, paymentToken, stakeToken stake and crowdsale contract", async function () {
    const signers = await ethers.getSigners();

    const SaleTokenTest = await ethers.getContractFactory("testSale");
    saleTokenTest = await SaleTokenTest.deploy(utils.parseEther("1000")); //emit 1000 tokens
    await saleTokenTest.deployed();

    console.log(`saleTokenTest address: ${saleTokenTest.address}`);

    const PaymentTokenTest = await ethers.getContractFactory("testPayment");
    paymentTokenTest = await PaymentTokenTest.deploy(utils.parseEther("1000")); //emit 1000 tokens
    await paymentTokenTest.deployed();

    console.log(`paymentTokenTest address: ${paymentTokenTest.address}`);

    const StakeTokenTest = await ethers.getContractFactory("testStake");
    stakeTokenTest = await StakeTokenTest.deploy(utils.parseEther("1000")); //emit 1000 tokens
    await stakeTokenTest.deployed();

    console.log(`stakeTokenTest address: ${paymentTokenTest.address}`);
    
    const Stake = await ethers.getContractFactory("Stake");
    stake = await Stake.deploy(stakeTokenTest.address, [5, 4, 3, 2, 1], [100000, 10000, 1000, 100]); // 1% for Iron, 2% for bronze, 3% for silver and etc. Thresholds: 100000 for platinum, 10000 for gold, 1000 for silver and 100 for bronze.
    await stake.deployed();

    console.log(`Stake address: ${stake.address}`);

    const Factory = await ethers.getContractFactory("PancakeFactory");
    factory = await Factory.deploy(signers[0].address);
    await factory.deployed();

    console.log(`Factory address: ${factory.address}`);

    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();
    await weth.deployed();

    console.log(`weth address: ${weth.address}`);

    const PancakeRouter = await ethers.getContractFactory("PancakeRouter");
    pancakeRouter = await PancakeRouter.deploy(factory.address, weth.address);
    await pancakeRouter.deployed();

    console.log(`router address: ${pancakeRouter.address}`);

    const Crowdsale = await ethers.getContractFactory("Crowdsale");
    crowdsale = await Crowdsale.deploy(pancakeRouter.address, saleTokenTest.address, paymentTokenTest.address, stake.address, hund_tokens, 30, utils.parseEther("2.0"), [40, 30, 15, 10, 5]);
    await crowdsale.deployed();

    console.log(`Crowdsale address: ${crowdsale.address}`);
  });


  it("Should transfer 100 payment tokens to Alice and Bob, saleTokens to crowdsale and make approve", async function () {
    const signers = await ethers.getSigners();
    alice = signers[1].address;
    bob = signers[2].address;
    await paymentTokenTest.transfer(alice, hund_tokens);
    await paymentTokenTest.transfer(bob, hund_tokens);
    await stakeTokenTest.transfer(alice, 100); //for staking
    await stakeTokenTest.transfer(bob, 100000);  //for staking
    expect(await paymentTokenTest.balanceOf(alice)).to.equal(hund_tokens);
    expect(await paymentTokenTest.balanceOf(bob)).to.equal(hund_tokens);
    await saleTokenTest.transfer(crowdsale.address, utils.parseEther("130"));
    expect(await saleTokenTest.balanceOf(crowdsale.address)).to.equal(utils.parseEther("130"));
    await paymentTokenTest.connect(signers[1]).approve(crowdsale.address, hund_tokens);
    await paymentTokenTest.connect(signers[2]).approve(crowdsale.address, hund_tokens);
    expect(await paymentTokenTest.allowance(alice, crowdsale.address)).to.equal(hund_tokens);
    expect(await paymentTokenTest.allowance(bob, crowdsale.address)).to.equal(hund_tokens);
    await stakeTokenTest.connect(signers[1]).approve(stake.address, 100);
    await stakeTokenTest.connect(signers[2]).approve(stake.address, 100000);
    expect(await stakeTokenTest.allowance(alice, stake.address)).to.equal(100);
    expect(await stakeTokenTest.allowance(bob, stake.address)).to.equal(100000);
  });

  it("Bob should send 100000 wei to stake, Alice should send 100 wei so Alice and Bob could buy 50 saleTokens", async function () {
    const signers = await ethers.getSigners();
    alice = signers[1].address;
    bob = signers[2].address;
    await stake.connect(signers[1]).deposit(100);
    expect(await stake.getUserLevel(alice)).to.equal(3); //bronze
    await stake.connect(signers[2]).deposit(100000);
    expect(await stake.getUserLevel(bob)).to.equal(0); //platinum
  });


  it("Should start crowdsale, Alice should buy 10 saleTokens, Bob should buy 40 saleTokens", async function () {
    const signers = await ethers.getSigners();
    alice = signers[1].address;
    bob = signers[2].address;
    await crowdsale.startCrowdsale();
    expect(await crowdsale.saleStarted()).to.equal(true);
    await crowdsale.connect(signers[1]).buy(utils.parseEther("10"));
    await crowdsale.connect(signers[2]).buy(utils.parseEther("40"));
    expect(await crowdsale.userPurchasedTokens(alice)).equal(utils.parseEther("10"));
    expect(await crowdsale.userPurchasedTokens(bob)).equal(utils.parseEther("40"));
  })

  
  it("Owner should finish crowdsale", async function () {
    const signers = await ethers.getSigners();
    alice = signers[1].address;
    bob = signers[2].address;
    await saleTokenTest.approve("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", utils.parseEther("100"));
    await paymentTokenTest.approve("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", utils.parseEther("100"));
    await crowdsale.finishCrowdsale();
  });

  it("Alice and Bob, owner should claim their tokens", async function () {
    const signers = await ethers.getSigners();
    alice = signers[1].address;
    bob = signers[2].address;
    await crowdsale.connect(signers[1]).claim();
    await crowdsale.connect(signers[2]).claim();
    await crowdsale.claimForOwner();
    expect(await saleTokenTest.balanceOf(alice)).to.equal(utils.parseEther("10"));
    expect(await saleTokenTest.balanceOf(bob)).to.equal(utils.parseEther("40"));
    expect(await saleTokenTest.balanceOf(signers[0].address)).to.equal(utils.parseEther("935")); //1000 - 130 = 870. 50 tokens sold, 15 went to dex. 870 + (130 - 50 - 15) = 935.
    expect(await paymentTokenTest.balanceOf(signers[0].address)).to.equal(utils.parseEther("870")); //1000 - 100 - 100 = 800. 100 for alice, 100 for bob. 800 + 20 from alice + 40 from bob = 900. 900 - 100 * 0.3 went to dex = 870.
  });


});
