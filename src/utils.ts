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
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(13258146 + 500);
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20); // call block handler every 20 blocks

// Note: the addresses below must be in lower case
export let POOL_ADDRESSES = new Array<string>(0);
POOL_ADDRESSES.push("0x11b1c87983f881b3686f8b1171628357faa30038"); // cDAI
POOL_ADDRESSES.push("0x5dda04b2bdbbc3fcfb9b60cd9ebfd1b27f1a4fe3"); // cUNI
POOL_ADDRESSES.push("0x572be575d1aa1ca84d8ac4274067f7bcb578a368"); // cLINK
POOL_ADDRESSES.push("0x6d97ea6e14d35e10b50df9475e9efaad1982065e"); // aDAI
POOL_ADDRESSES.push("0x2d3141f4c9872d4f53b587c3fb8b22736feb54b0"); // aUSDC
POOL_ADDRESSES.push("0xb1b225402b5ec977af8c721f42f21db5518785dc"); // aUSDT
POOL_ADDRESSES.push("0x5b1a10aaf807d4297048297c30b2504b42c3395f"); // harvestCRVRENWBTC

export let POOL_STABLECOIN_DECIMALS = new Array<i32>(0);
POOL_STABLECOIN_DECIMALS.push(18); // cDAI
POOL_STABLECOIN_DECIMALS.push(18); // cUNI
POOL_STABLECOIN_DECIMALS.push(18); // cLINK
POOL_STABLECOIN_DECIMALS.push(18); // aDAI
POOL_STABLECOIN_DECIMALS.push(6); // aUSDC
POOL_STABLECOIN_DECIMALS.push(6); // aUSDT
POOL_STABLECOIN_DECIMALS.push(18); // harvestCRVRENWBTC

export let POOL_DEPLOY_BLOCKS = new Array<i32>(0);
POOL_DEPLOY_BLOCKS.push(13135260); // cDAI
POOL_DEPLOY_BLOCKS.push(13156898); // cUNI
POOL_DEPLOY_BLOCKS.push(13157335); // cLINK
POOL_DEPLOY_BLOCKS.push(13157722); // aDAI
POOL_DEPLOY_BLOCKS.push(13158219); // aUSDC
POOL_DEPLOY_BLOCKS.push(13160904); // aUSDT
POOL_DEPLOY_BLOCKS.push(13163970); // harvestCRVRENWBTC

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
