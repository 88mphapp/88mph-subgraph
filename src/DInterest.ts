import { BigInt, BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts"
import {
  DInterest,
  EDeposit,
  EWithdraw,
  EFund
} from "../generated/DInterest/DInterest"
import { DPoolList, DPool, User, Deposit, Funder, Funding } from "../generated/schema"

let DPOOLLIST_ID = "0";
let ZERO_DEC = BigDecimal.fromString("0")
let ONE_DEC = BigDecimal.fromString("1")
let NEGONE_DEC = BigDecimal.fromString("-1")
let ZERO_INT = BigInt.fromI32(0)
let ONE_INT = BigInt.fromI32(1)
let YEAR = BigInt.fromI32(31556952) // One year in seconds
let PRECISION = new BigDecimal(tenPow(18))
let DELIMITER = "---"

function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

function normalize(i: BigInt): BigDecimal {
  return i.toBigDecimal().div(PRECISION)
}

function getPoolList(): DPoolList {
  let poolList = DPoolList.load(DPOOLLIST_ID)
  if (poolList == null) {
    poolList = new DPoolList(DPOOLLIST_ID)
    poolList.pools = new Array<string>()
    poolList.numPools = ZERO_INT
    poolList.numUsers = ZERO_INT
    poolList.numActiveUsers = ZERO_INT
    poolList.numFunders = ZERO_INT
    poolList.save()
  }
  return poolList as DPoolList
}

function getPool(event: ethereum.Event): DPool {
  let poolList = getPoolList()
  let pool = DPool.load(event.address.toHex())
  // Init DPool entity if it doesn't exist
  if (pool == null) {
    let poolContract = DInterest.bind(event.address)
    pool = new DPool(event.address.toHex())
    pool.address = event.address.toHex()
    pool.moneyMarket = poolContract.moneyMarket().toHex()
    pool.stablecoin = poolContract.stablecoin().toHex()
    pool.interestModel = poolContract.interestModel().toHex()
    pool.numUsers = ZERO_INT
    pool.numDeposits = ZERO_INT
    pool.numActiveDeposits = ZERO_INT
    pool.totalActiveDeposit = ZERO_DEC
    pool.totalHistoricalDeposit = ZERO_DEC
    pool.numFundings = ZERO_INT
    pool.totalInterestPaid = ZERO_DEC
    pool.oneYearInterestRate = normalize(poolContract.calculateInterestAmount(ONE_INT, YEAR))
    pool.surplus = ZERO_DEC
    pool.moneyMarketIncomeIndex = ZERO_INT
    pool.blocktime = normalize(poolContract.blocktime())
    pool.MinDepositPeriod = poolContract.MinDepositPeriod()
    pool.MaxDepositPeriod = poolContract.MaxDepositPeriod()
    pool.MinDepositAmount = poolContract.MinDepositAmount()
    pool.MaxDepositAmount = poolContract.MaxDepositAmount()
    pool.save()

    let pools = poolList.pools
    pools.push(pool.id)
    poolList.pools = pools
    poolList.numPools = poolList.numPools.plus(ONE_INT)
    poolList.save()
  }
  return pool as DPool
}

function getUser(address: Address, pool: DPool): User {
  let user = User.load(address.toHex())
  if (user == null) {
    user = new User(address.toHex())
    user.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.address)
    user.pools = pools
    user.numPools = ZERO_INT
    user.numDeposits = ZERO_INT
    user.numActiveDeposits = ZERO_INT
    user.totalActiveDeposit = ZERO_DEC
    user.totalHistoricalDeposit = ZERO_DEC
    user.totalInterestEarned = ZERO_DEC
    user.totalMPHEarned = ZERO_DEC
    user.totalMPHPaidBack = ZERO_DEC
    user.save()

    pool.numUsers = pool.numUsers.plus(ONE_INT)
    pool.save()

    let poolList = getPoolList()
    poolList.numUsers = poolList.numUsers.plus(ONE_INT)
    poolList.save()
  }
  return user as User
}

function getFunder(address: Address, pool: DPool): Funder {
  let user = Funder.load(address.toHex())
  if (user == null) {
    user = new Funder(address.toHex())
    user.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.address)
    user.pools = pools
    user.numPools = ZERO_INT
    user.numFundings = ZERO_INT
    user.totalInterestEarned = ZERO_DEC
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

export function handleEDeposit(event: EDeposit): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)

  // Create new Deposit entity
  let deposit = new Deposit(pool.address + DELIMITER + event.params.depositID.toString())
  deposit.nftID = event.params.depositID
  deposit.user = user.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.depositTimestamp = event.block.timestamp
  deposit.interestEarned = normalize(event.params.interestAmount)
  deposit.fundingID = ZERO_INT
  deposit.mintMPHAmount = normalize(event.params.mintMPHAmount)
  deposit.takeBackMPHAmount = ZERO_DEC
  deposit.save()

  // Update DPool statistics
  if (user.numActiveDeposits.equals(ZERO_INT)) {
    // User has become active
    let poolList = getPoolList()
    poolList.numActiveUsers = poolList.numActiveUsers.plus(ONE_INT)
    poolList.save()
  }
  pool.numDeposits = pool.numDeposits.plus(ONE_INT)
  pool.numActiveDeposits = pool.numActiveDeposits.plus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.plus(deposit.amount)
  pool.totalHistoricalDeposit = pool.totalHistoricalDeposit.plus(deposit.amount)
  pool.totalInterestPaid = pool.totalInterestPaid.plus(deposit.interestEarned)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update User
  if (!user.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = user.pools
    pools.push(pool.id)
    user.pools = pools
    user.numPools = user.numPools.plus(ONE_INT)
    pool.numUsers = pool.numUsers.plus(ONE_INT)
    pool.save()
  }
  user.numDeposits = user.numDeposits.plus(ONE_INT)
  user.numActiveDeposits = user.numActiveDeposits.plus(ONE_INT)
  user.totalActiveDeposit = user.totalActiveDeposit.plus(deposit.amount)
  user.totalHistoricalDeposit = user.totalHistoricalDeposit.plus(deposit.amount)
  user.totalInterestEarned = user.totalInterestEarned.plus(deposit.interestEarned)
  user.totalMPHEarned = user.totalMPHEarned.plus(deposit.mintMPHAmount)
  user.save()
}

export function handleEWithdraw(event: EWithdraw): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)
  let deposit = Deposit.load(pool.address + DELIMITER + event.params.depositID.toString())

  // Set Deposit entity to inactive
  deposit.active = false
  deposit.takeBackMPHAmount = normalize(event.params.takeBackMPHAmount)
  deposit.save()

  // Update User statistics
  user.numActiveDeposits = user.numActiveDeposits.minus(ONE_INT)
  user.totalActiveDeposit = user.totalActiveDeposit.minus(deposit.amount)
  user.totalMPHPaidBack = user.totalMPHPaidBack.plus(deposit.takeBackMPHAmount)
  user.save()

  // Update DPool statistics
  if (user.numActiveDeposits.equals(ZERO_INT)) {
    // User has become inactive
    let poolList = getPoolList()
    poolList.numActiveUsers = poolList.numActiveUsers.minus(ONE_INT)
    poolList.save()
  }
  pool.numActiveDeposits = pool.numActiveDeposits.minus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  let fundingID = event.params.fundingID
  if (fundingID.notEqual(ZERO_INT)) {
    // Update Funding
    let funding = Funding.load(pool.address + DELIMITER + fundingID.toString())
    let fundingObj = poolContract.getFunding(fundingID)
    let interestAmount = funding.recordedFundedDepositAmount.times(poolContract.moneyMarketIncomeIndex().toBigDecimal()).div(funding.recordedMoneyMarketIncomeIndex.toBigDecimal()).minus(funding.recordedFundedDepositAmount)
    funding.totalInterestEarned = funding.totalInterestEarned.plus(interestAmount)
    funding.recordedFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount)
    funding.recordedMoneyMarketIncomeIndex = fundingObj.recordedMoneyMarketIncomeIndex
    funding.save()

    // Update Funder
    let funder = Funder.load(funding.funder)
    funder.totalInterestEarned = funder.totalInterestEarned.plus(interestAmount)
    funder.save()
  }
}

export function handleEFund(event: EFund): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let funder = getFunder(event.params.sender, pool)

  // Create new Funding entity
  let fundingID = event.params.fundingID
  let funding = new Funding(pool.address + DELIMITER + fundingID.toString())
  funding.nftID = event.params.fundingID
  funding.funder = funder.id
  funding.pool = pool.id
  let fundingObj = poolContract.getFunding(fundingID)
  funding.fromDepositID = fundingObj.fromDepositID
  funding.toDepositID = fundingObj.toDepositID
  funding.recordedFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount)
  funding.recordedMoneyMarketIncomeIndex = fundingObj.recordedMoneyMarketIncomeIndex
  funding.initialFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount)
  funding.fundedDeficitAmount = normalize(event.params.deficitAmount)
  funding.totalInterestEarned = ZERO_DEC
  funding.mintMPHAmount = normalize(event.params.mintMPHAmount)
  funding.save()

  // Update DPool statistics
  pool.numFundings = pool.numFundings.plus(ONE_INT)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update Funder
  funder.numFundings = funder.numFundings.plus(ONE_INT)
  funder.totalMPHEarned = funder.totalMPHEarned.plus(funding.mintMPHAmount)
  funder.save()

  // Update funded Deposits
  for (let id = funding.fromDepositID.plus(ONE_INT); id.le(funding.toDepositID); id = id.plus(ONE_INT)) {
    let deposit = Deposit.load(pool.address + DELIMITER + id.toString())
    deposit.fundingID = fundingID
    deposit.save()
  }
}

export function handleBlock(block: ethereum.Block): void {
  let poolList = getPoolList()

  poolList.pools.forEach(poolID => {
    // Update DPool statistics
    let pool = DPool.load(poolID)
    let poolContract = DInterest.bind(Address.fromString(pool.address))
    pool.oneYearInterestRate = normalize(poolContract.calculateInterestAmount(ONE_INT, YEAR))
    let surplusResult = poolContract.surplus()
    pool.surplus = normalize(surplusResult.value1).times(surplusResult.value0 ? NEGONE_DEC : ONE_DEC)
    pool.moneyMarketIncomeIndex = poolContract.moneyMarketIncomeIndex()
    pool.save()
  });
}