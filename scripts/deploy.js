const hre = require("hardhat");

function tokens(n) {
  return ethers.utils.parseEther(n);
}

async function main() {
  const owner = process.env.OWNER;
  const whitelister = process.env.WHITELISTER;

  const HappyFun = await hre.ethers.getContractFactory("HappyFansToken");
  const happyFun = await HappyFun.deploy();

  await happyFun.deployed();

  await happyFun.transfer(owner, tokens('100000000000'));
  await happyFun.transferOwnership(owner);
  await happyFun.transferWhitelister(whitelister);
  
  console.log("HappyFansToken deployed to:", happyFun.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
