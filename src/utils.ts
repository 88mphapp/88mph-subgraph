import { BigDecimal, BigInt, Address, DataSourceContext, ethereum, ByteArray, crypto } from "@graphprotocol/graph-ts";
import { DInterest } from "../generated/cDAIPool/DInterest";
import { ERC20 } from "../generated/cDAIPool/ERC20";
import { IInterestOracle } from "../generated/cDAIPool/IInterestOracle";
import { MPHIssuanceModel01 } from "../generated/MPHIssuanceModel01/MPHIssuanceModel01";
import { DPoolList, DPool, User, Funder, MPH, MPHHolder } from "../generated/schema";
import { NFT } from "../generated/templates";

export let DPOOLLIST_ID = '0';
export let MPH_ID = '0'
export let ZERO_DEC = BigDecimal.fromString('0')
export let ONE_DEC = BigDecimal.fromString('1')
export let NEGONE_DEC = BigDecimal.fromString('-1')
export let ZERO_INT = BigInt.fromI32(0)
export let ONE_INT = BigInt.fromI32(1)
export let YEAR = BigInt.fromI32(31556952) // One year in seconds
export let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000')
export let MPH_ISSUANCE_MODEL_ADDR = Address.fromString('0x36ad542dadc22078511d64b98aff818abd1ac713')
export let DELIMITER = '---'
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(11264284)

let POOL_ADDRESSES = new Array<string>(0)
POOL_ADDRESSES.push('0x35966201A7724b952455B73A36C8846D8745218e'); // cDAI

export function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

export function normalize(i: BigInt, decimals: number = 18): BigDecimal {
  return i.toBigDecimal().div(new BigDecimal(tenPow(decimals)))
}

export function keccak256(s: string): ByteArray {
  return crypto.keccak256(ByteArray.fromUTF8(s))
}

export function getPoolList(): DPoolList {
  let poolList = DPoolList.load(DPOOLLIST_ID)
  if (poolList == null) {
    // Initialize DPool entities
    POOL_ADDRESSES.forEach(poolAddress => {
      let pool = new DPool(poolAddress)
      let poolContract = DInterest.bind(Address.fromString(poolAddress))
      let oracleContract = IInterestOracle.bind(poolContract.interestOracle())
      let stablecoinContract = ERC20.bind(poolContract.stablecoin())
      let stablecoinDecimals: number = stablecoinContract.decimals()
      let stablecoinPrecision = new BigDecimal(tenPow(stablecoinDecimals))
      let mphIssuanceModel01Contract = MPHIssuanceModel01.bind(MPH_ISSUANCE_MODEL_ADDR)
      pool.address = poolAddress
      pool.moneyMarket = poolContract.moneyMarket().toHex()
      pool.stablecoin = poolContract.stablecoin().toHex()
      pool.interestModel = poolContract.interestModel().toHex()
      pool.numUsers = ZERO_INT
      pool.numDeposits = ZERO_INT
      pool.numActiveDeposits = ZERO_INT
      pool.totalActiveDeposit = ZERO_DEC
      pool.totalHistoricalDeposit = ZERO_DEC
      pool.numFunders = ZERO_INT
      pool.numFundings = ZERO_INT
      pool.totalInterestPaid = ZERO_DEC
      pool.unfundedDepositAmount = ZERO_DEC
      pool.oneYearInterestRate = normalize(poolContract.calculateInterestAmount(tenPow(18), YEAR))
      pool.surplus = ZERO_DEC
      pool.moneyMarketIncomeIndex = ZERO_INT
      pool.oracleInterestRate = normalize(oracleContract.updateAndQuery().value1)
      pool.MinDepositPeriod = poolContract.MinDepositPeriod()
      pool.MaxDepositPeriod = poolContract.MaxDepositPeriod()
      pool.MinDepositAmount = poolContract.MinDepositAmount().toBigDecimal().div(stablecoinPrecision)
      pool.MaxDepositAmount = poolContract.MaxDepositAmount().toBigDecimal().div(stablecoinPrecision)
      pool.mphDepositorRewardMintMultiplier = normalize(mphIssuanceModel01Contract.poolDepositorRewardMintMultiplier(Address.fromString(poolAddress)), 36 - stablecoinDecimals)
      pool.mphDepositorRewardTakeBackMultiplier = normalize(mphIssuanceModel01Contract.poolDepositorRewardTakeBackMultiplier(Address.fromString(poolAddress)))
      pool.mphFunderRewardMultiplier = normalize(mphIssuanceModel01Contract.poolFunderRewardMultiplier(Address.fromString(poolAddress)), 36 - stablecoinDecimals)
      pool.save()

      // Create NFT templates
      let depositNFTContext = new DataSourceContext()
      depositNFTContext.setString('pool', poolAddress)
      depositNFTContext.setString('type', 'deposit')
      NFT.createWithContext(poolContract.depositNFT(), depositNFTContext)
      let fundingNFTContext = new DataSourceContext()
      fundingNFTContext.setString('pool', poolAddress)
      fundingNFTContext.setString('type', 'funding')
      NFT.createWithContext(poolContract.fundingNFT(), fundingNFTContext)
    })

    // Initialize DPoolList
    poolList = new DPoolList(DPOOLLIST_ID)
    poolList.pools = POOL_ADDRESSES
    poolList.numPools = BigInt.fromI32(POOL_ADDRESSES.length)
    poolList.numUsers = ZERO_INT
    poolList.numActiveUsers = ZERO_INT
    poolList.numFunders = ZERO_INT
    poolList.save()
  }
  return poolList as DPoolList
}

export function getPool(event: ethereum.Event): DPool {
  let pool = DPool.load(event.address.toHex())
  return pool as DPool
}

export function getUser(address: Address, pool: DPool): User {
  let user = User.load(address.toHex())
  if (user == null) {
    let poolList = getPoolList()
    poolList.numUsers = poolList.numUsers.plus(ONE_INT)
    poolList.save()

    user = new User(address.toHex())
    user.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.id)
    user.pools = pools
    user.numPools = ZERO_INT
    user.numDeposits = ZERO_INT
    user.numActiveDeposits = ZERO_INT
    user.totalMPHEarned = ZERO_DEC
    user.totalMPHPaidBack = ZERO_DEC
    user.save()

    pool.numUsers = pool.numUsers.plus(ONE_INT)
    pool.save()
  }
  return user as User
}

export function getFunder(address: Address, pool: DPool): Funder {
  let user = Funder.load(address.toHex())
  if (user == null) {
    user = new Funder(address.toHex())
    user.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.address)
    user.pools = pools
    user.numPools = ZERO_INT
    user.numFundings = ZERO_INT
    user.totalMPHEarned = ZERO_DEC
    user.save()

    pool.numFunders = pool.numFunders.plus(ONE_INT)
    pool.save()

    let poolList = getPoolList()
    poolList.numFunders = poolList.numFunders.plus(ONE_INT)
    poolList.save()
  }
  return user as Funder
}

export function getMPH(): MPH {
  let entity = MPH.load(MPH_ID)
  if (entity == null) {
    entity = new MPH(MPH_ID)
    entity.totalSupply = ZERO_DEC
    entity.totalStakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.rewardPerMPHPerSecond = ZERO_DEC
    entity.rewardPerSecond = ZERO_DEC
    entity.save()
  }
  return entity as MPH
}

export function getMPHHolder(address: Address): MPHHolder | null {
  if (address.equals(ZERO_ADDR)) {
    return null
  }
  let entity = MPHHolder.load(address.toHex())
  if (entity == null) {
    entity = new MPHHolder(address.toHex())
    entity.address = address.toHex()
    entity.mphBalance = ZERO_DEC
    entity.stakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}