import { expect } from "chai";
import { ethers, waffle, upgrades } from "hardhat";
import { Snapshot, tokens, timeLimit, increaseTime, ether, ZeroAddress } from "./helpers";

// Artifacts
import VlxArtifact from "../artifacts/contracts/HappyFansToken.sol/HappyFansToken.json";

// Types
import { HappyFansToken, UniswapV2Factory, UniswapV2Router02, WETH9, UniswapV2Pair} from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

describe("HappyFansToken Contract Test Suite", () => {
  let happy: HappyFansToken, factory: UniswapV2Factory, eth: WETH9, router: UniswapV2Router02;
  let pair: UniswapV2Pair;
  let traders: SignerWithAddress[];
  let trader1: SignerWithAddress;
  let trader2: SignerWithAddress;
  let trader3: SignerWithAddress;
  let trader4: SignerWithAddress;
  let feeRewardRecipient: SignerWithAddress;
  let owner: SignerWithAddress;
  let oneMinute: number = 60;
  let oneHour: number = 60 * oneMinute;
  let oneDay: number = oneHour * 24;
  let oneWeek: number = oneDay * 7;
  let oneYear: number = oneDay * 365;

  const snapshot: Snapshot = new Snapshot();
  

  const swapTokens = async (
    amountSold: BigNumber, tokenSold: HappyFansToken | WETH9, tokenBought: HappyFansToken | WETH9,
    router: UniswapV2Router02, trader: SignerWithAddress
  ) => {
    await tokenSold.connect(trader).approve(router.address, amountSold);
    await router.connect(trader).swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amountSold,
      0,
      [tokenSold.address, tokenBought.address],
      trader.address,
      timeLimit(60)
      );
  };

  before("Deployment Snapshot", async () => {
    let signers: SignerWithAddress[] = await ethers.getSigners();
    owner = signers[0];
    trader1 = signers[1];
    trader2 = signers[2];
    trader3 = signers[3];
    trader4 = signers[4];
    feeRewardRecipient = signers[5];
    traders = [trader1, trader2, trader3, trader4];

    const Factory = await ethers.getContractFactory("UniswapV2Factory");
    factory = (await Factory.deploy(owner.address)) as UniswapV2Factory;
    await factory.deployed();

    const ETH = await ethers.getContractFactory("WETH9");
    eth = (await ETH.deploy()) as WETH9;
    await eth.deployed();

    const ROUTER = await ethers.getContractFactory("UniswapV2Router02");
    router = (await ROUTER.deploy(
      factory.address,
      eth.address
    )) as UniswapV2Router02;
    await router.deployed();

    const Happy = await ethers.getContractFactory("HappyFansToken");
    happy = await Happy.deploy() as HappyFansToken;
    await happy.deployed();

    for (const trader of traders) {
      await happy.transfer(trader.address, tokens("1000000"));
    }

    await owner.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader1.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader2.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader3.sendTransaction({
      to: eth.address,
      value: ether("500")
    });
    await trader4.sendTransaction({
      to: eth.address,
      value: ether("500")
    });

    await factory.createPair(happy.address, eth.address)
    let pairAddress: string = await factory.getPair(happy.address, eth.address);
    pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);

    let durations = [1200];
    let amountsMax = [tokens("10000")];
    const whitelistAddresses: string[] = [trader1.address, trader2.address]
    
    await happy.createLGEWhitelist(pair.address, durations, amountsMax);
    await happy.modifyLGEWhitelist(0, 1200, tokens("10000"), whitelistAddresses, true);

    await happy.approve(router.address, tokens("100000"));
    await eth.approve(router.address, ether("200"));
    await router.addLiquidity(happy.address, eth.address, tokens("100000"), ether("200"), 0, 0, owner.address, timeLimit(oneMinute*30));
    
    
    // Create the ADS, eth pool?
    await snapshot.snapshot();
  });

  afterEach("Revert", async () => {
    await snapshot.revert();
  })

  describe("Deployment", () => {

    it("Should be called HappyFans", async () => {
      expect(await happy.name()).equal("HappyFans");
    });

    it("Should have the symbol HAPPY", async () => {
      expect(await happy.symbol()).equal("HAPPY");
    });
  
    it("Should have a total supply of 100000000000", async () => {
      expect(await happy.totalSupply()).equal(tokens("100000000000"));
    });
  
    it("Should have 18 decimals", async () => {
      expect(await happy.decimals()).equal(18);
    });
  
    it("Should give allowance to a spender of approved amount", async () => {
      await happy.approve(trader1.address, tokens("1000"));
      // let allowed = await wag.allowance(owner.address, trader1.address);

      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("1000"));
    });

    it("Should increase the allowance of a spender", async () => {
      await happy.increaseAllowance(trader1.address, tokens("2000"));
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("2000"));
    });

    it("Should decrease the allowance of a spender", async () => {
      await happy.approve(trader1.address, tokens("4000"));
      await happy.decreaseAllowance(trader1.address, tokens("2000"));
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("2000"));
    });
  });

  
  describe("Allowance", () => {
    
    it("Allowance works as expected", async () => {
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("0"));
      await happy.approve(trader1.address, tokens("5"));
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("5"));
      await happy.increaseAllowance(trader1.address, tokens("3"));
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("8"));
      await happy.decreaseAllowance(trader1.address, tokens("4"));
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("4"));
      await expect(happy.decreaseAllowance(trader1.address, tokens("5"))).revertedWith("BEP20: decreased allowance below zero");
      expect(await happy.allowance(owner.address, trader1.address)).equal(tokens("4"));
    });
    
  });
  
  describe("Approve", () => {
    
    it("Cannot approve the zero address to move your tokens", async () => {
      await expect(happy.connect(trader1).approve(ZeroAddress, tokens("5"))).to.be.reverted;
    });
    
  });
  
  describe("TransferFrom", () => {
    
    it("Should allow you to transfer an address' tokens to another address", async () => {
      const initialTraderBalance = await happy.balanceOf(trader3.address);
      await happy.connect(trader1).approve(trader2.address, tokens("5"));
      await happy.connect(trader2).transferFrom(trader1.address, trader3.address, tokens("5"));

      expect(await happy.balanceOf(trader3.address))
        .to.equal(tokens("5").add(initialTraderBalance));
    });

    // it("Should not be able to transfer to the zero address", async () => {
    //   await happy.connect(trader1).approve(trader2.address, tokens("5"));
    //   expect(await happy.connect(trader2).transferFrom(trader1.address, ZeroAddress, tokens("5")))
    //     .revertedWith("BEP20: transfer to the zero address");
    // });

  });
  
  describe("Ownership", () => {
    
    it("Should return owner address", async () => {
      expect(await happy.getOwner()).equal(owner.address);
    });
    
    it("Should only allow the owner to transfer ownership to another address", async () => {
      await expect(happy.connect(trader1).transferOwnership(trader1.address)).to.be.reverted;
      await happy.transferOwnership(trader1.address);
      expect(await happy.owner()).to.be.equal(trader1.address);
    });
    
    it("Should not allow transfer of ownership to the zero address", async () => {
      await expect(happy.transferOwnership(ZeroAddress)).to.be.reverted;
    });
    
    it("Should only allow the owner to renounce ownership of the contract", async () => {
      await happy.renounceOwnership();
      expect(await happy.owner()).to.be.equal(ZeroAddress);
    });
    
  });
  
  describe("Trading", () => {

    it("Should not charge fees when selling tokens on pancakeswap", async () => {
      let initialBalance: BigNumber = await happy.balanceOf(pair.address);
      // console.log(pair.address);
      // console.log(trader1.address);
      // console.log(router.address);

      expect(initialBalance).equal(tokens("100000"));

      await swapTokens(tokens("10000"), happy, eth, router, trader1);

      // pair adddress should increase by amount sold
      expect(await happy.balanceOf(pair.address)).equal(initialBalance.add(tokens("10000")));
    });
  });
    
  describe("Whitelist", () => {
  
    it("Creating the LGE whitelist requires duration and amountsMax of equal length", async () => {
      let durations = [1200];
      let amountsMax = [tokens("10000"), tokens("10")];

      await expect(happy.createLGEWhitelist(ZeroAddress, durations, amountsMax)).to.be.reverted;

      durations = [];
      amountsMax = [];

      await happy.createLGEWhitelist(ZeroAddress, durations, amountsMax); 
    });

    it("Adding liquidity activates the whitelist", async () => {
      await swapTokens(ether("1"), eth, happy, router, trader1);
      await expect(swapTokens(ether("1"), eth, happy, router, trader3)).to.be.reverted;
    });

    it("Transferring tokens reverts if you're not on the whitelist", async () => {
      await expect(swapTokens(ether("1"), eth, happy, router, trader3)).to.be.reverted;
    });

    it("Whitelisters cannot buy more than the specified amount max", async () => {
      await expect(swapTokens(ether("9"), eth, happy, router, trader3)).to.be.reverted;
    });

    it("Whitelist admin can add whitelist addresses using modifyLGEWhitelist", async () => {
      const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      let data = await happy.getLGEWhitelistRound();
      expect(data[4]).equal(false);
      await happy.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
      data = await happy.connect(trader3).getLGEWhitelistRound();
      expect(data[4]).equal(true);
    });

    it("Whitelist admin can modify the whitelist duration", async () => {
      const addresses: string[] = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await happy.modifyLGEWhitelist(0, 1201, tokens("5000"), addresses, true);
    });

    it("Whitelist admin can modify the max tokens that can be bought during the whitelist", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await happy.modifyLGEWhitelist(0, 1200, tokens("5000"), addresses, true);
    });

    it("Whitelist admin can call the modifyLGEWhitelist and not change anything", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await happy.modifyLGEWhitelist(0, 1200, tokens("10000"), addresses, true);
    });

    it("When the whitelist round is over, getLGEWhitelistRound returns 0", async () => {
      let data = await happy.getLGEWhitelistRound();
      expect(data[0]).to.be.equal(1);
      await increaseTime(1500);
      data = await happy.getLGEWhitelistRound();
      expect(data[0]).to.be.equal(0);
    });

    it("Whitelist admin cannot modify a whitelist that doesn't exist", async () => {
      const addresses = [pair.address, owner.address, trader1.address, trader2.address, trader3.address, trader4.address];
      await expect(happy.modifyLGEWhitelist(1, 1201, tokens("5000"), addresses, true)).to.be.reverted;
    });

    it("Whitelist admin can renounce their whitelister permissions", async () => {
      await happy.renounceWhitelister();
      expect(await happy._whitelister()).to.be.equal(ZeroAddress);
    });

    it("Whitelist admin can tranfer their whitelisting permission to another address", async () => {
      await expect(happy.connect(trader1).transferWhitelister(trader1.address)).to.be.reverted;
      await happy.transferWhitelister(trader1.address);
      expect(await happy._whitelister()).to.be.equal(trader1.address);
    });

    it("Whitelist admin cannot transfer their whitelisting permission to the zero address", async () => {
      await expect(happy.transferWhitelister(ZeroAddress)).to.be.reverted;
      expect(await happy._whitelister()).to.be.equal(owner.address);
    });
  });
});