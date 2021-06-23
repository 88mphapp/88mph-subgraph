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
import { DPool, User, Funder } from "../generated/schema";
import { NFT, FundingMultitoken } from "../generated/templates";

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
  "0xC79a56Af51Ec36738E965e88100e4570c5C77A93"
);
export let ULTRA_PRECISION = BigInt.fromI32(2)
  .pow(128)
  .toBigDecimal();
export let DELIMITER = "---";
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(8812608 + 3000);
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20); // call block handler every 20 blocks

export let POOL_ADDRESSES = new Array<string>(0);
POOL_ADDRESSES.push("0x71482f8cd0e956051208603709639fa28cbc1f33"); // cDAI

export let POOL_STABLECOIN_DECIMALS = new Array<i32>(0);
POOL_STABLECOIN_DECIMALS.push(18); // cDAI

export let POOL_DEPLOY_BLOCKS = new Array<i32>(0);
POOL_DEPLOY_BLOCKS.push(8735259); // cDAI

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
    let stablecoinDecimals: number = getTokenDecimals(Address.fromString(pool.stablecoin));
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
    user.save();

    pool.numFunders = pool.numFunders.plus(ONE_INT);
    pool.save();
  }
  return user as Funder;
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
