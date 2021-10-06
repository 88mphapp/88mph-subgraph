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
import { DPool, User, Funder, GlobalStats } from "../generated/schema";
import { NFT } from "../generated/templates";

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
export let ULTRA_PRECISION = BigInt.fromI32(2)
  .pow(128)
  .toBigDecimal();
export let DELIMITER = "---";
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(19889933);
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20); // call block handler every 20 blocks

// Note: the addresses below must be in lower case
export let POOL_ADDRESSES = new Array<string>(0);
POOL_ADDRESSES.push("0xa78276c04d8d807feb8271fe123c1f94c08a414d"); // aave-dai
POOL_ADDRESSES.push("0x4f28fc2be45682d1be1d0f155f4a52d4509db629"); // aave-matic
POOL_ADDRESSES.push("0x3933baac41f04d0ffa0977b0e879bc56482ad667"); // aave-usdc
POOL_ADDRESSES.push("0xf5ef24a27f35cbe8a2b0a954acf81d7064ce6b70"); // aave-usdt
POOL_ADDRESSES.push("0x0e99145166e2982bb67054a1e5d3a902fc4d2b59"); // aave-wbtc
POOL_ADDRESSES.push("0x3b79eb9675ed29554f57b719dc66a461a4c84970"); // aave-weth

export let POOL_STABLECOIN_DECIMALS = new Array<i32>(0);
POOL_STABLECOIN_DECIMALS.push(18); // aave-dai
POOL_STABLECOIN_DECIMALS.push(18); // aave-matic
POOL_STABLECOIN_DECIMALS.push(6); // aave-usdc
POOL_STABLECOIN_DECIMALS.push(6); // aave-usdt
POOL_STABLECOIN_DECIMALS.push(8); // aave-wbtc
POOL_STABLECOIN_DECIMALS.push(18); // aave-weth

export let POOL_DEPLOY_BLOCKS = new Array<i32>(0);
POOL_DEPLOY_BLOCKS.push(19889933); // aave-dai
POOL_DEPLOY_BLOCKS.push(19889933); // aave-matic
POOL_DEPLOY_BLOCKS.push(19889933); // aave-usdc
POOL_DEPLOY_BLOCKS.push(19889933); // aave-usdt
POOL_DEPLOY_BLOCKS.push(19889933); // aave-wbtc
POOL_DEPLOY_BLOCKS.push(19889933); // aave-weth

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
    pool.historicalInterestPaid = ZERO_DEC;
    pool.poolDepositorRewardMintMultiplier = ZERO_DEC;
    pool.poolFunderRewardMultiplier = ZERO_DEC;
    pool.save();

    // Create deposit NFT template
    let depositNFTContext = new DataSourceContext();
    depositNFTContext.setString("pool", poolAddress);
    NFT.createWithContext(poolContract.depositNFT(), depositNFTContext);
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
    entity.blockHandlerStartBlock = BLOCK_HANDLER_START_BLOCK;
    entity.xMPHRewardDistributed = ZERO_DEC;
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
