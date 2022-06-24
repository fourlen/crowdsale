const { expect } = require("chai");
const { BigNumber, utils } = require("ethers");
const { ethers } = require("hardhat");
const { time } = require('@openzeppelin/test-helpers');

saleTokenTest = null;
paymentTokenTest = null;
stake = null;
crowdsale = null;
const hund_tokens = utils.parseEther("100");


async function wait_year_and_collect_reward(expected_percent) {
  time.increase(365 * 86400);
  const signers = await ethers.getSigners();
  //collect reward test
  staker_prebalance = (await testERC20.balanceOf(signers[19].address));
  collectReward = await stake.connect(signers[19]).collectReward(false);
  await collectReward.wait();
  staker = await stake.stakers(signers[19].address);
  reward = Math.floor((staker.amount * expected_percent * 365 * 86400) / (365 * 86400 * 100)); //staker.amount * expected_percent% * 10 sec / (количество секунд в году * 100%)
  current_balance = await testERC20.balanceOf(signers[19].address);
  console.log(`Expexted reward: ${reward}. Actual reward: ${current_balance - staker_prebalance}`);
  // expect(parseInt(current_balance)).to.lessThan(+staker_prebalance + +reward + 300);
  // expect(parseInt(current_balance)).to.greaterThan(+staker_prebalance + +reward - 300);
  expect(parseInt(current_balance)).to.equal(+staker_prebalance + +reward);
}

describe("Deployment, transfering tokens, approvance and testing staking", function () {
  

  it("Should deploy saleToken, paymentToken, stakeToken stake and crowdsale contract", async function () {
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

    console.log(`paymentTokenTest address: ${paymentTokenTest.address}`);
    
    const Stake = await ethers.getContractFactory("Stake");
    stake = await Stake.deploy(saleTokenTest.address, [5, 4, 3, 2, 1], [100000, 10000, 1000, 100]); // 1% for Iron, 2% for bronze, 3% for silver and etc. Thresholds: 100000 for platinum, 10000 for gold, 1000 for silver and 100 for bronze.
    await stake.deployed();

    console.log(`Stake address: ${stake.address}`);

    const Crowdsale = await ethers.getContractFactory("Crowdsale");
    crowdsale = await Crowdsale.deploy(saleTokenTest.address, paymentTokenTest.address, stake.address, 100, 30, utils.parseEther("2.0"), [40, 30, 15, 10, 5]);
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
    expect(await stake.getUserLevel(alice)).to.equal(3);
    await stake.connect(signers[2]).deposit(100000);
    expect(await stake.getUserLevel(bob)).to.equal(0);
  });


  
});
