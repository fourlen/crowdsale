const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { time } = require('@openzeppelin/test-helpers');

const hund_nanotokens = BigNumber.from(100000000000n);
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
  expect(parseInt(current_balance)).to.equal(+staker_prebalance + +reward);
}

describe("Deployment, transfering tokens, approvance and testing staking", function () {
  

  it("Should deploy testERC20 token and Stake contract", async function () {
    const TestERC20 = await ethers.getContractFactory("testSale");
    testERC20 = await TestERC20.deploy(10 * hund_nanotokens); //emit 1000 tokens
    await testERC20.deployed();

    console.log(`testERC20 address: ${testERC20.address}`);
    
    const Stake = await ethers.getContractFactory("Stake");
    stake = await Stake.deploy(testERC20.address, [5, 4, 3, 2, 1], [100000, 10000, 1000, 100]); // 1% for Iron, 2% for bronze, 3% for silver and etc. Thresholds: 100000 for platinum, 10000 for gold, 1000 for silver and 100 for bronze.
    await stake.deployed();

    console.log(`Stake address: ${stake.address}`);
  });


  it(`Should transfer 100 tokens to account and stake contract and make approve for stake contract`, async function () {
    const signers = await ethers.getSigners();
    
    const send_tokens_to_acc = await testERC20.transfer(signers[19].address, hund_nanotokens);
    await send_tokens_to_acc.wait();

    const send_tokens_to_contract = await testERC20.transfer(stake.address, hund_nanotokens);
    await send_tokens_to_contract.wait();

    expect(await testERC20.balanceOf(signers[19].address)).to.equal(hund_nanotokens);
    const approve = await testERC20.connect(signers[19]).approve(stake.address, hund_nanotokens);
    await approve.wait();

    expect(await testERC20.allowance(signers[19].address, stake.address)).to.equal(hund_nanotokens);
    console.log(`${signers[19].address} now have 100 test tokens`);
  });


  it("Should deposit 10, 100, ... 100000 tokens wei and check levels, withdraw, than change reward percent, deposit 50 nanotokens, wait for 10 secs collect reward.", async function () {
    const signers = await ethers.getSigners();
    

    //deposit test
    //iron
    const dep10 = await stake.connect(signers[19]).deposit(10);
    await dep10.wait();
    staker = await stake.stakers(signers[19].address);
    await wait_year_and_collect_reward(1);

    //bronze
    const dep100 = await stake.connect(signers[19]).deposit(100);
    await dep100.wait();
    staker = await stake.stakers(signers[19].address);
    await wait_year_and_collect_reward(2);


    //silver
    const dep1000 = await stake.connect(signers[19]).deposit(1000);
    await dep1000.wait();
    staker = await stake.stakers(signers[19].address);
    await wait_year_and_collect_reward(3);

    //gold
    const dep10000 = await stake.connect(signers[19]).deposit(10000);
    await dep10000.wait();
    staker = await stake.stakers(signers[19].address);
    await wait_year_and_collect_reward(4);

    //platinum
    const dep100000 = await stake.connect(signers[19]).deposit(100000);
    await dep100000.wait();
    await wait_year_and_collect_reward(5);
    staker = await stake.stakers(signers[19].address);
    expect(staker.amount).to.equal(10 + 100 + 1000 + 10000 + 100000);

    //withdraw
    staker_prebalance = (await testERC20.balanceOf(signers[19].address));
    const withdraw = await stake.connect(signers[19]).withdraw(staker.amount);
    await withdraw.wait();
    expect(await testERC20.balanceOf(signers[19].address)).to.equal(+staker_prebalance + +staker.amount);


    //check that amount is 0 after withdraw
    staker = await stake.stakers(signers[19].address);
    expect(staker.amount).to.equal(0);

    //change percent
    const change_percent = await stake.changeLevelParameters([[10, 100000], [8, 10000], [6, 1000], [4, 100], [2, 0]]);
    await change_percent.wait()
    expect((await stake.levelInfos(0)).levelReward).to.equal(10);


    //check after percent changing
    const dep100000_after_percent = await stake.connect(signers[19]).deposit(100000);
    await dep100000_after_percent.wait();
    await wait_year_and_collect_reward(10); //now 10 percents for platinum



    //change thresholds
    staker = await stake.stakers(signers[19].address);
    const change_thresholds = await stake.changeLevelParameters([[10, 100000000000], [8, 10000], [6, 1000], [4, 100], [2, 0]]); //чтобы level = gold
    await change_thresholds.wait();
    const dep100000_after_threshold = await stake.connect(signers[19]).deposit(100000);
    await dep100000_after_threshold.wait();
    await wait_year_and_collect_reward(8); //now staker must be gold and have 8 percents
  })
});
