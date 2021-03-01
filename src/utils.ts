import { BigDecimal, BigInt, Address, DataSourceContext, ByteArray, crypto } from "@graphprotocol/graph-ts";
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
export let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(11951179 + 1500)
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(20) // call block handler every 20 blocks

export let POOL_ADDRESSES = new Array<string>(0)
POOL_ADDRESSES.push('0x35966201a7724b952455b73a36c8846d8745218e') // cDAI
POOL_ADDRESSES.push('0x374226dbaa3e44bf3923afb63f5fd83928b7e148') // cUSDC
POOL_ADDRESSES.push('0x19e10132841616ce4790920d5f94b8571f9b9341') // cUNI
POOL_ADDRESSES.push('0xe615e59353f70ca2424aa0f24f49c639b8e924d3') // yUSD
POOL_ADDRESSES.push('0x681aaa7cf3f7e1f110842f0149ba8a4af53ef2fd') // crvSBTC
POOL_ADDRESSES.push('0x23fa6b36e870ca5753853538d17c3ca7f5269e84') // Harvest yCRV
POOL_ADDRESSES.push('0xe8c52367b81113ed32bb276184e521c2fbe9393a') // Aave USDC
POOL_ADDRESSES.push('0xb1abaac351e06d40441cf2cd97f6f0098e6473f2') // Harvest crvHUSD
POOL_ADDRESSES.push('0x2f3efd1a90a2336ab8fa1b9060380dc37361ca55') // Harvest 3CRV
POOL_ADDRESSES.push('0x3f5611f7762cc39fc11e10c864ae38526f650e9d') // Harvest crvHBTC
POOL_ADDRESSES.push('0x6712baab01fa2dc7be6635746ec2da6f8bd73e71') // Aave sUSD
POOL_ADDRESSES.push('0xdc86ac6140026267e0873b27c8629efe748e7146') // Aave DAI
POOL_ADDRESSES.push('0xd4837145c7e13d580904e8431cfd481f9794fc41') // Harvest crvOBTC
POOL_ADDRESSES.push('0x904f81eff3c35877865810cca9a63f2d9cb7d4dd') // yaLINK
POOL_ADDRESSES.push('0x303cb7ede0c3ad99ce017cdc3abacd65164ff486') // Harvest CRV:STETH
POOL_ADDRESSES.push('0x22e6b9a65163ce1225d1f65ef7942a979d093039') // Harvest CRV:RENWBTC

export let POOL_DEPLOY_BLOCKS = new Array<i32>(0)
POOL_DEPLOY_BLOCKS.push(11312644) // cDAI
POOL_DEPLOY_BLOCKS.push(11315763) // cUSDC
POOL_DEPLOY_BLOCKS.push(11315994) // cUNI
POOL_DEPLOY_BLOCKS.push(11316295) // yUSD
POOL_DEPLOY_BLOCKS.push(11316753) // crvSBTC
POOL_DEPLOY_BLOCKS.push(11370919) // Harvest yCRV
POOL_DEPLOY_BLOCKS.push(11410383) // Aave USDC
POOL_DEPLOY_BLOCKS.push(11446987) // Harvest crvHUSD
POOL_DEPLOY_BLOCKS.push(11479937) // Harvest 3CRV
POOL_DEPLOY_BLOCKS.push(11507624) // Harvest crvHBTC
POOL_DEPLOY_BLOCKS.push(11533975) // Aave sUSD
POOL_DEPLOY_BLOCKS.push(11669032) // Aave DAI
POOL_DEPLOY_BLOCKS.push(11669290) // Harvest crvOBTC
POOL_DEPLOY_BLOCKS.push(11871065) // yaLINK
POOL_DEPLOY_BLOCKS.push(11937307) // Harvest CRV:STETH
POOL_DEPLOY_BLOCKS.push(11938573) // Harvest CRV:RENWBTC

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

export function stringEqual(s1: string, s2: string): boolean {
  return keccak256(s1) == keccak256(s2)
}

export function getPoolList(): DPoolList {
  let poolList = DPoolList.load(DPOOLLIST_ID)
  if (poolList == null) {
    // Initialize DPoolList
    poolList = new DPoolList(DPOOLLIST_ID)
    poolList.pools = new Array<string>(0)
    poolList.numPools = ZERO_INT
    poolList.numUsers = ZERO_INT
    poolList.numActiveUsers = ZERO_INT
    poolList.numFunders = ZERO_INT
    poolList.save()
  }
  return poolList as DPoolList
}

export function getPool(poolAddress: string): DPool {
  let pool = DPool.load(poolAddress)
  if (pool == null) {
    pool = new DPool(poolAddress)
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

    // Add pool to DPoolList
    let poolList = getPoolList()
    let poolListPools = poolList.pools
    poolListPools.push(poolAddress)
    poolList.pools = poolListPools
    poolList.numPools = poolList.numPools.plus(ONE_INT)
    poolList.save()
  }
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
    entity.totalHistoricalReward = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}