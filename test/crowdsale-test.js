const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { time } = require('@openzeppelin/test-helpers');

const one_token = BigNumber.from("1e18");
testERC20 = null;
stake = null;

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
  

  it("Should deploy saleToken, paymentToken, stake and crowdsale contract", async function () {
    const SaleTokenTest = await ethers.getContractFactory("testSale");
    saleTokenTest = await SaleTokenTest.deploy(100 * one_token); //emit 1000 tokens
    await saleTokenTest.deployed();

    console.log(`saleTokenTest address: ${saleTokenTest.address}`);

    const PaymentTokenTest = await ethers.getContractFactory("testPayment");
    paymentTokenTest = await PaymentTokenTest.deploy(100 * one_token); //emit 1000 tokens
    await paymentTokenTest.deployed();

    console.log(`paymentTokenTest address: ${paymentTokenTest.address}`);
    
    const Stake = await ethers.getContractFactory("Stake");
    stake = await Stake.deploy(saleTokenTest.address, [5, 4, 3, 2, 1], [100000, 10000, 1000, 100]); // 1% for Iron, 2% for bronze, 3% for silver and etc. Thresholds: 100000 for platinum, 10000 for gold, 1000 for silver and 100 for bronze.
    await stake.deployed();

    console.log(`Stake address: ${stake.address}`);

    const Crowdsale = await ethers.getContractFactory("Crowdsale");
    crowdsale = await Crowdsale.deploy();
    await crowdsale.deployed();

    console.log(`Crowdsale address: ${crowdsale.address}`);
  });


  
});
