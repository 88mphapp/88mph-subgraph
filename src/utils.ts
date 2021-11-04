import {
  BigDecimal,
  BigInt,
  Address,
  DataSourceContext,
  ByteArray,
  crypto
} from "@graphprotocol/graph-ts";
import { DInterest } from "../generated/cDAIPool/DInterest";
import { ERC20 } from "../generated/cDAIPool/ERC20";
import { IInterestOracle } from "../generated/cDAIPool/IInterestOracle";
import { MPHMinter } from "../generated/cDAIPool/MPHMinter";
import { DPool, User, Funder, GlobalStats } from "../generated/schema";
import { NFT, FundingMultitoken } from "../generated/templates";

export let GLOBAL_STATS_ID = "0";
export let ZERO_DEC = BigDecimal.fromString("0");
export let ONE_DEC = BigDecimal.fromString("1");
export let NEGONE_DEC = BigDecimal.fromString("-1");
export let ZERO_INT = BigInt.fromI32(0);
export let ONE_INT = BigInt.fromI32(1);
export let YEAR = BigInt.fromI32(31556952); // One year in seconds
export let ZERO_ADDR = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);
export let MPH_ADDR = Address.fromString(
  "0x8888801af4d980682e47f1a9036e589479e835c5"
);
export let ULTRA_PRECISION = BigInt.fromI32(2)
  .pow(128)
  .toBigDecimal();
export let DELIMITER = "---";
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(13552474 + 500);
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20); // call block handler every 20 blocks

// Note: the addresses below must be in lower case
export let POOL_ADDRESSES = new Array<string>(0);
POOL_ADDRESSES.push("0x11b1c87983f881b3686f8b1171628357faa30038"); // cDAI
POOL_ADDRESSES.push("0x5dda04b2bdbbc3fcfb9b60cd9ebfd1b27f1a4fe3"); // cUNI
POOL_ADDRESSES.push("0x572be575d1aa1ca84d8ac4274067f7bcb578a368"); // cLINK
POOL_ADDRESSES.push("0x6d97ea6e14d35e10b50df9475e9efaad1982065e"); // aDAI
POOL_ADDRESSES.push("0x2d3141f4c9872d4f53b587c3fb8b22736feb54b0"); // aUSDC
POOL_ADDRESSES.push("0xb1b225402b5ec977af8c721f42f21db5518785dc"); // aUSDT
POOL_ADDRESSES.push("0x24867f5665414d93f7b3d195f848917d57d5be27"); // aBALPool
POOL_ADDRESSES.push("0x6bf909ce507e94608f0fcbab2cfdd499e0150a21"); // cBATPool
POOL_ADDRESSES.push("0xc1f147db2b6a9c9fbf322fac3d1fbf8b8aaeec10"); // cCOMPPool
POOL_ADDRESSES.push("0x8eb1b3ac29e0dcbd7f519c86f1eb76a3aea41b76"); // aCRVPool
POOL_ADDRESSES.push("0x4b4626c1265d22b71ded11920795a3c6127a0559"); // bDAIPool
POOL_ADDRESSES.push("0xbfdb51ec0adc6d5bf2ebba54248d40f81796e12b"); // aGUSDPool
POOL_ADDRESSES.push("0x46603a1cca20e7ae18f1a069125369609d9d4153"); // crFTTPool
POOL_ADDRESSES.push("0x6e6002a4bd704a3c8e24a70b0be670f1c2b4d35c"); // aLINKPool
POOL_ADDRESSES.push("0x2a74f09a8e4899115529ec8808c5fc1de62c2fe4"); // aRAIPool
POOL_ADDRESSES.push("0x4d794db79c4a85dc763d08a7c440a92a2d153ffd"); // aRENPool
POOL_ADDRESSES.push("0x60f0f24b0fbf066e877c3a89014c2e4e98c33678"); // aSNXPool
POOL_ADDRESSES.push("0xafdd82d73f5dae907f86ad37f346221081dc917b"); // aSUSDPool
POOL_ADDRESSES.push("0x10e8bd414eee26d82e88d6e308fd81ef37d03155"); // aTUSDPool
POOL_ADDRESSES.push("0x085d70ca0dade4683d0f59d5a5b7d3298011b4de"); // cTUSDPool
POOL_ADDRESSES.push("0x4f7ec502ca0be8ef1f984ab1f164022a15ff5561"); // bUSDCPool
POOL_ADDRESSES.push("0x7dc14d047d6d8bb03539f92b9e2ca1f1648a5717"); // cUSDCPool
POOL_ADDRESSES.push("0xf61681b8cbf87615f30f96f491fa28a2ff39947a"); // crUSDCPool
POOL_ADDRESSES.push("0xf50ef673ee810e6acb725f941a53bf92586a39ad"); // aUSDPPool
POOL_ADDRESSES.push("0x062214fbe3f15d217512deb14572eb01face0392"); // bUSDTPool
POOL_ADDRESSES.push("0x7f10134c32a4544e4cdc0fd57f5c820bff3070e9"); // cUSDTPool
POOL_ADDRESSES.push("0x3816579c8cb62500a45ae29a33040a3dea4160de"); // crUSDTPool
POOL_ADDRESSES.push("0x0fd585328666923a3a772dd5c37e2dc065c7b137"); // aWBTCPool
POOL_ADDRESSES.push("0xa0e78812e9cd3e754a83bbd74a3f1579b50436e8"); // cWBTCPool
POOL_ADDRESSES.push("0xae5dde7ea5c44b38c0bccfb985c40006ed744ea6"); // aWETHPool
POOL_ADDRESSES.push("0x1821aadb9ac1b7e4d56c728afdadc7541a785cd2"); // aYFIPool
POOL_ADDRESSES.push("0x0f834c3601088d1b060c47737a2f5ce4ffa5ac1d"); // cZRXPool
POOL_ADDRESSES.push("0x5b1a10aaf807d4297048297c30b2504b42c3395f"); // harvestCRVRENWBTC


export let POOL_STABLECOIN_DECIMALS = new Array<i32>(0);
POOL_STABLECOIN_DECIMALS.push(18); // cDAI
POOL_STABLECOIN_DECIMALS.push(18); // cUNI
POOL_STABLECOIN_DECIMALS.push(18); // cLINK
POOL_STABLECOIN_DECIMALS.push(18); // aDAI
POOL_STABLECOIN_DECIMALS.push(6); // aUSDC
POOL_STABLECOIN_DECIMALS.push(6); // aUSDT
POOL_STABLECOIN_DECIMALS.push(18); // aBALPool
POOL_STABLECOIN_DECIMALS.push(18); // cBATPool
POOL_STABLECOIN_DECIMALS.push(18); // cCOMPPool
POOL_STABLECOIN_DECIMALS.push(18); // aCRVPool
POOL_STABLECOIN_DECIMALS.push(18); // bDAIPool
POOL_STABLECOIN_DECIMALS.push(2); // aGUSDPool
POOL_STABLECOIN_DECIMALS.push(18); // crFTTPool
POOL_STABLECOIN_DECIMALS.push(18); // aLINKPool
POOL_STABLECOIN_DECIMALS.push(18); // aRAIPool
POOL_STABLECOIN_DECIMALS.push(18); // aRENPool
POOL_STABLECOIN_DECIMALS.push(18); // aSNXPool
POOL_STABLECOIN_DECIMALS.push(18); // aSUSDPool
POOL_STABLECOIN_DECIMALS.push(18); // aTUSDPool
POOL_STABLECOIN_DECIMALS.push(18); // cTUSDPool
POOL_STABLECOIN_DECIMALS.push(6); // bUSDCPool
POOL_STABLECOIN_DECIMALS.push(6); // cUSDCPool
POOL_STABLECOIN_DECIMALS.push(6); // crUSDCPool
POOL_STABLECOIN_DECIMALS.push(18); // aUSDPPool
POOL_STABLECOIN_DECIMALS.push(6); // bUSDTPool
POOL_STABLECOIN_DECIMALS.push(6); // cUSDTPool
POOL_STABLECOIN_DECIMALS.push(6); // crUSDTPool
POOL_STABLECOIN_DECIMALS.push(8); // aWBTCPool
POOL_STABLECOIN_DECIMALS.push(8); // cWBTCPool
POOL_STABLECOIN_DECIMALS.push(18); // aWETHPool
POOL_STABLECOIN_DECIMALS.push(18); // aYFIPool
POOL_STABLECOIN_DECIMALS.push(18); // cZRXPool
POOL_STABLECOIN_DECIMALS.push(18); // harvestCRVRENWBTC


export let POOL_DEPLOY_BLOCKS = new Array<i32>(0);
POOL_DEPLOY_BLOCKS.push(13135260); // cDAI
POOL_DEPLOY_BLOCKS.push(13156898); // cUNI
POOL_DEPLOY_BLOCKS.push(13157335); // cLINK
POOL_DEPLOY_BLOCKS.push(13157722); // aDAI
POOL_DEPLOY_BLOCKS.push(13158219); // aUSDC
POOL_DEPLOY_BLOCKS.push(13160904); // aUSDT
POOL_DEPLOY_BLOCKS.push(13312166); // aBALPool
POOL_DEPLOY_BLOCKS.push(13312166); // cBATPool
POOL_DEPLOY_BLOCKS.push(13312166); // cCOMPPool
POOL_DEPLOY_BLOCKS.push(13312166); // aCRVPool
POOL_DEPLOY_BLOCKS.push(13312166); // bDAIPool
POOL_DEPLOY_BLOCKS.push(13312166); // aGUSDPool
POOL_DEPLOY_BLOCKS.push(13312166); // crFTTPool
POOL_DEPLOY_BLOCKS.push(13312166); // aLINKPool
POOL_DEPLOY_BLOCKS.push(13312166); // aRAIPool
POOL_DEPLOY_BLOCKS.push(13312166); // aRENPool
POOL_DEPLOY_BLOCKS.push(13312166); // aSNXPool
POOL_DEPLOY_BLOCKS.push(13312166); // aSUSDPool
POOL_DEPLOY_BLOCKS.push(13312166); // aTUSDPool
POOL_DEPLOY_BLOCKS.push(13312166); // cTUSDPool
POOL_DEPLOY_BLOCKS.push(13312166); // bUSDCPool
POOL_DEPLOY_BLOCKS.push(13312166); // cUSDCPool
POOL_DEPLOY_BLOCKS.push(13312166); // crUSDCPool
POOL_DEPLOY_BLOCKS.push(13312166); // aUSDPPool
POOL_DEPLOY_BLOCKS.push(13312166); // bUSDTPool
POOL_DEPLOY_BLOCKS.push(13312166); // cUSDTPool
POOL_DEPLOY_BLOCKS.push(13312166); // crUSDTPool
POOL_DEPLOY_BLOCKS.push(13312166); // aWBTCPool
POOL_DEPLOY_BLOCKS.push(13312166); // cWBTCPool
POOL_DEPLOY_BLOCKS.push(13312166); // aWETHPool
POOL_DEPLOY_BLOCKS.push(13312166); // aYFIPool
POOL_DEPLOY_BLOCKS.push(13312166); // cZRXPool
POOL_DEPLOY_BLOCKS.push(13312166); // harvestCRVRENWBTC

export function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1);
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10));
  }
  return result;
}

export function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(new BigDecimal(tenPow(decimals)));
}

export function keccak256(s: string): ByteArray {
  return crypto.keccak256(ByteArray.fromUTF8(s));
}

export function stringEqual(s1: string, s2: string): boolean {
  return keccak256(s1) == keccak256(s2);
}

export function getPool(poolAddress: string): DPool {
  let pool = DPool.load(poolAddress);
  if (pool == null) {
    pool = new DPool(poolAddress);
    let poolContract = DInterest.bind(Address.fromString(poolAddress));
    let oracleContract = IInterestOracle.bind(poolContract.interestOracle());
    let stablecoinDecimals: number = getTokenDecimals(
      poolContract.stablecoin()
    );
    let mphMinterContract = MPHMinter.bind(poolContract.mphMinter());
    pool.address = poolAddress;
    pool.moneyMarket = poolContract.moneyMarket().toHex();
    pool.stablecoin = poolContract.stablecoin().toHex();
    pool.interestModel = poolContract.interestModel().toHex();
    pool.numUsers = ZERO_INT;
    pool.numDeposits = ZERO_INT;
    pool.totalDeposit = ZERO_DEC;
    pool.totalFeeOwed = ZERO_DEC;
    pool.totalInterestOwed = ZERO_DEC;
    pool.numFunders = ZERO_INT;
    pool.numFundings = ZERO_INT;
    pool.MaxDepositPeriod = poolContract.MaxDepositPeriod();
    pool.MinDepositAmount = normalize(
      poolContract.MinDepositAmount(),
      stablecoinDecimals
    );
    pool.oneYearInterestRate = normalize(
      poolContract.calculateInterestAmount(tenPow(18), YEAR)
    );
    pool.surplus = ZERO_DEC;
    pool.moneyMarketIncomeIndex = ZERO_INT;
    pool.oracleInterestRate = normalize(oracleContract.updateAndQuery().value1);
    pool.poolDepositorRewardMintMultiplier = normalize(
      mphMinterContract.poolDepositorRewardMintMultiplier(
        Address.fromString(poolAddress)
      ),
      36 - stablecoinDecimals
    );
    pool.poolFunderRewardMultiplier = normalize(
      mphMinterContract.poolFunderRewardMultiplier(
        Address.fromString(poolAddress)
      ),
      36 - stablecoinDecimals
    );
    pool.historicalInterestPaid = ZERO_DEC;
    pool.save();

    // Create deposit NFT template
    let depositNFTContext = new DataSourceContext();
    depositNFTContext.setString("pool", poolAddress);
    NFT.createWithContext(poolContract.depositNFT(), depositNFTContext);

    // Create funding multitoken template
    let fundingMultitokenContext = new DataSourceContext();
    fundingMultitokenContext.setString("pool", poolAddress);
    FundingMultitoken.createWithContext(
      poolContract.fundingMultitoken(),
      fundingMultitokenContext
    );
  }
  return pool as DPool;
}

export function getUser(address: Address, pool: DPool): User {
  let user = User.load(address.toHex());
  if (user == null) {
    user = new User(address.toHex());
    user.address = address.toHex();
    let pools = new Array<string>(0);
    pools.push(pool.id);
    user.pools = pools;
    user.numPools = ZERO_INT;
    user.numDeposits = ZERO_INT;
    user.save();

    pool.numUsers = pool.numUsers.plus(ONE_INT);
    pool.save();
  }
  return user as User;
}

export function getFunder(address: Address, pool: DPool): Funder {
  let user = Funder.load(address.toHex());
  if (user == null) {
    user = new Funder(address.toHex());
    user.address = address.toHex();
    let pools = new Array<string>(0);
    pools.push(pool.address);
    user.pools = pools;
    user.numPools = ZERO_INT;
    user.numFundings = ZERO_INT;
    let fundings = new Array<string>(0);
    user.fundings = fundings;
    user.save();

    pool.numFunders = pool.numFunders.plus(ONE_INT);
    pool.save();
  }
  return user as Funder;
}

export function getGlobalStats(): GlobalStats {
  let entity = GlobalStats.load(GLOBAL_STATS_ID);
  if (entity == null) {
    entity = new GlobalStats(GLOBAL_STATS_ID);
    entity.xMPHRewardDistributed = ZERO_DEC;
    entity.blockHandlerStartBlock = BLOCK_HANDLER_START_BLOCK;
    entity.save();
  }
  return entity as GlobalStats;
}

export function getTokenDecimals(address: Address): number {
  let tokenContract = ERC20.bind(address);
  let decimals: number;
  let decimalsResult = tokenContract.try_decimals();
  if (decimalsResult.reverted) {
    decimals = 18;
  } else {
    decimals = decimalsResult.value;
  }
  return decimals;
}
