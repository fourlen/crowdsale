const hre = require("hardhat");
const { utils } = require("ethers");

const {
  PlatinumPercent,
  GoldPercent,
  SilverPercent,
  BronzePercent,
  IronPercent,
  PlatinumThreshold,
  GoldThreshold,
  SilverThreshold,
  BronzeThreshold,
  saleTokenAmount,
  paymentTokenAmount,
  stakeTokenAmount,
  tokensToSale,
  percentTokensToDex,
  price,
  PlatinumPercentAccess,
  GoldPercentAccess,
  SilverPercentAccess,
  BronzePercentAccess,
  IronPercentAccess,
  RouterAddess
} = process.env;

async function main() {
    const SaleTokenTest = await hre.ethers.getContractFactory("testSale");
    saleTokenTest = await SaleTokenTest.deploy(utils.parseEther(saleTokenAmount));
    await saleTokenTest.deployed();

    console.log(`saleTokenTest address: ${saleTokenTest.address}`);

    const PaymentTokenTest = await hre.ethers.getContractFactory("testPayment");
    paymentTokenTest = await PaymentTokenTest.deploy(utils.parseEther(paymentTokenAmount));
    await paymentTokenTest.deployed();

    console.log(`paymentTokenTest address: ${paymentTokenTest.address}`);

    const StakeTokenTest = await hre.ethers.getContractFactory("testStake");
    stakeTokenTest = await StakeTokenTest.deploy(utils.parseEther(stakeTokenAmount));
    await stakeTokenTest.deployed();

    console.log(`stakeTokenTest address: ${paymentTokenTest.address}`);

    const Stake = await hre.ethers.getContractFactory("Stake");
    const stake = await Stake.deploy(stakeTokenTest.address, [PlatinumPercent, GoldPercent, SilverPercent, BronzePercent, IronPercent], [PlatinumThreshold, GoldThreshold, SilverThreshold, BronzeThreshold]);
    await stake.deployed();
    console.log("Stake deployed to: ", stake.address);


    const Crowdsale = await hre.ethers.getContractFactory("Crowdsale");
    crowdsale = await Crowdsale.deploy(RouterAddess, saleTokenTest.address, paymentTokenTest.address, stake.address, utils.parseEther(tokensToSale), percentTokensToDex, utils.parseEther(price), [PlatinumPercentAccess, GoldPercentAccess, SilverPercentAccess, BronzePercentAccess, IronPercentAccess]);
    await crowdsale.deployed();

    console.log(`Crowdsale address: ${crowdsale.address}`);

  try {
    await verifyToken(saleTokenTest, "contracts/test/paymentTokenTest.sol:testPayment", utils.parseEther(saleTokenAmount));
    console.log("Verify saleTokenTest succees");
  }
  catch {
    console.log("Verify saleTokenTest failed");
  }

  try {
    await verifyToken(paymentTokenTest, "contracts/test/paymentTokenTest.sol:testPayment", utils.parseEther(paymentTokenAmount));
    console.log("Verify paymentTokenTest succees");
  }
  catch {
    console.log("Verify paymentTokenTest failed");
  }

  try {
    await verifyToken(stakeTokenTest, "contracts/test/stakeTokenTest.sol:testStake", utils.parseEther(stakeTokenAmount));
    console.log("Verify stakeTokenTest succees");
  }
  catch {
    console.log("Verify stakeTokenTest failed");
  }

  try {
    await verifyStake(stake,
      stakeTokenTest.address, [PlatinumPercent, GoldPercent, SilverPercent, BronzePercent, IronPercent], [PlatinumThreshold, GoldThreshold, SilverThreshold, BronzeThreshold]);
    console.log("Verify stake success");
  }
  catch {
    console.log("Verify stake failed");
  }

  try {
    await verifyCrowdsale(crowdsale,
        RouterAddess, saleTokenTest.address, paymentTokenTest.address, stake.address, utils.parseEther(tokensToSale), percentTokensToDex, utils.parseEther(price), [PlatinumPercentAccess, GoldPercentAccess, SilverPercentAccess, BronzePercentAccess, IronPercentAccess]);
    console.log("Verify crowdsale success");
  }
  catch {
    console.log("Verify crowdsale failed");
  }
}

async function verifyToken(token, path, AMOUNT) {
  await hre.run("verify:verify", {
    address: token.address,
    contract: path,
    constructorArguments: [
      AMOUNT
    ]
  })
}

async function verifyStake(stake,
    stakedTokenAddress,
    rewardPercent,
    thresholds) {
  await hre.run("verify:verify", {
    address: stake.address,
    constructorArguments: [
        stakedTokenAddress,
        rewardPercent,
        thresholds
    ]
  })
}

async function verifyCrowdsale(
    crowdsale,
    routerAddess,
    saleToken,
    paymentToken,
    stake,
    tokensToSale,
    percentTokensToDex,
    price,
    accessess
) {
  await hre.run("verify:verify", {
    address: crowdsale.address,
    constructorArguments: [
        routerAddess,
        saleToken,
        paymentToken,
        stake,
        tokensToSale,
        percentTokensToDex,
        price,
        accessess
    ]
  })
}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });