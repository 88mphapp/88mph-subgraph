import {
  BigDecimal,
  BigInt,
  Address,
  DataSourceContext,
  ByteArray,
  crypto
} from "@graphprotocol/graph-ts";
import { DInterest } from "../generated/scream-dai/DInterest";
import { ERC20 } from "../generated/scream-dai/ERC20";
import { IInterestOracle } from "../generated/scream-dai/IInterestOracle";
import { MPHMinter } from "../generated/scream-dai/MPHMinter";
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
  "0x511a986E427FFa281ACfCf07AAd70d03040DbEc0"
);
export let ULTRA_PRECISION = BigInt.fromI32(2)
  .pow(128)
  .toBigDecimal();
export let DELIMITER = "---";
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(22092130);
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20); // call block handler every 20 blocks

// Note: the addresses below must be in lower case
export let POOL_ADDRESSES = new Array<string>(0);
export let POOL_STABLECOIN_DECIMALS = new Array<i32>(0);
export let POOL_DEPLOY_BLOCKS = new Array<i32>(0);

POOL_ADDRESSES.push("0xa78276c04d8d807feb8271fe123c1f94c08a414d"); // scream-dai
POOL_ADDRESSES.push("0xf7fb7f095c8d0f4ee8ffbd142fe0b311491b45f3"); // scream-usdc
POOL_ADDRESSES.push("0x3cab1cb5a9b68350b39ddf7ce23518d609a8bc78"); // scream-usdt
POOL_ADDRESSES.push("0xa1857578cec558eaed9120739b0c533549bdcb61"); // scream-wbtc
POOL_ADDRESSES.push("0x2744b79c985ae0c6b81f1da8eed1a4c67eb4b732"); // scream-weth
POOL_ADDRESSES.push("0xc80cc61910c6f8f47aadc69e40ab8d1b2fa2c4df"); // scream-link
POOL_ADDRESSES.push("0xc7cbb403d1722ee3e4ae61f452dc36d71e8800de"); // scream-fusd
POOL_ADDRESSES.push("0xc91c2255525e80630eee710e7c0637bce7d98978"); // scream-wftm
POOL_ADDRESSES.push("0xc0710b3564fd4768f912150d39d519b66f2952d4"); // geist-dai
POOL_ADDRESSES.push("0xd62f71937fca1c7c05da08cec4c451f12fc64964"); // geist-usdc
POOL_ADDRESSES.push("0xbdf43e9c6cf68359deff9292098622643ede5ec3"); // geist-usdt
POOL_ADDRESSES.push("0xcb29ce2526ff5f80ad1536c6a1b13238d615b4b9"); // geist-wbtc
POOL_ADDRESSES.push("0x7e4697f650934ea6743b8b0619fc2454db02405a"); // geist-weth
POOL_ADDRESSES.push("0x23fe5a2ba80ea2251843086ec000911cfc79c864"); // geist-wftm

POOL_STABLECOIN_DECIMALS.push(18); // scream-dai
POOL_STABLECOIN_DECIMALS.push(6); // scream-usdc
POOL_STABLECOIN_DECIMALS.push(6); // scream-usdt
POOL_STABLECOIN_DECIMALS.push(8); // scream-wbtc
POOL_STABLECOIN_DECIMALS.push(18); // scream-weth
POOL_STABLECOIN_DECIMALS.push(18); // scream-link
POOL_STABLECOIN_DECIMALS.push(18); // scream-fusd
POOL_STABLECOIN_DECIMALS.push(18); // scream-wftm
POOL_STABLECOIN_DECIMALS.push(18); // geist-dai
POOL_STABLECOIN_DECIMALS.push(6); // geist-usdc
POOL_STABLECOIN_DECIMALS.push(6); // geist-usdt
POOL_STABLECOIN_DECIMALS.push(8); // geist-wbtc
POOL_STABLECOIN_DECIMALS.push(18); // geist-weth
POOL_STABLECOIN_DECIMALS.push(18); // geist-wftm

POOL_DEPLOY_BLOCKS.push(18894830); // scream-dai
POOL_DEPLOY_BLOCKS.push(18894830); // scream-usdc
POOL_DEPLOY_BLOCKS.push(18894830); // scream-usdt
POOL_DEPLOY_BLOCKS.push(18894830); // scream-wbtc
POOL_DEPLOY_BLOCKS.push(18894830); // scream-weth
POOL_DEPLOY_BLOCKS.push(18894830); // scream-link
POOL_DEPLOY_BLOCKS.push(18894830); // scream-fusd
POOL_DEPLOY_BLOCKS.push(18894830); // scream-wftm
POOL_DEPLOY_BLOCKS.push(18894830); // geist-dai
POOL_DEPLOY_BLOCKS.push(18894830); // geist-usdc
POOL_DEPLOY_BLOCKS.push(18894830); // geist-usdt
POOL_DEPLOY_BLOCKS.push(18894830); // geist-wbtc
POOL_DEPLOY_BLOCKS.push(18894830); // geist-weth
POOL_DEPLOY_BLOCKS.push(18894830); // geist-wftm

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
    pool.poolDepositorRewardMintMultiplier = ZERO_DEC;
    pool.poolFunderRewardMultiplier = ZERO_DEC;
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
