import { BigInt, BigDecimal, Address, ethereum, log } from "@graphprotocol/graph-ts"
import {
  DInterest,
  EDeposit,
  EWithdraw,
  EFund
} from "../generated/aUSDCPool/DInterest"
import { IInterestOracle } from "../generated/aUSDCPool/IInterestOracle"
import { DPoolList, DPool, User, Deposit, Funder, Funding, UserTotalDeposit, FunderTotalInterest } from "../generated/schema"

let DPOOLLIST_ID = "0";
let ZERO_DEC = BigDecimal.fromString("0")
let ONE_DEC = BigDecimal.fromString("1")
let NEGONE_DEC = BigDecimal.fromString("-1")
let ZERO_INT = BigInt.fromI32(0)
let ONE_INT = BigInt.fromI32(1)
let YEAR = BigInt.fromI32(31556952) // One year in seconds
let PRECISION = new BigDecimal(tenPow(18))
let DELIMITER = "---"
let BLOCK_HANDLER_START_BLOCK = BigInt.fromI32(11202474)

let POOL_ADDRESSES = new Array<string>(0)
POOL_ADDRESSES.push("0xeb2f0a3045db12366a9f6a8e922d725d86a117eb"); // cUSDC
POOL_ADDRESSES.push("0xb5ee8910a93f8a450e97be0436f36b9458106682"); // aUSDC
POOL_ADDRESSES.push("0xf9761c1a244c66e40cf9b7efb4b0c29b562b6bc0"); // cUNI
POOL_ADDRESSES.push("0x25a5feb5ac6533fe3c4e8e8e2a55f9e1f1f8e5f0"); // yyCRV
POOL_ADDRESSES.push("0xd42f7c7463b261fac72510c638a877690bea8d68"); // ycrvSBTC


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
    // Initialize DPool entities
    POOL_ADDRESSES.forEach(poolAddress => {
      let pool = new DPool(poolAddress)
      let poolContract = DInterest.bind(Address.fromString(poolAddress))
      let oracleContract = IInterestOracle.bind(poolContract.interestOracle())
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
      pool.MinDepositAmount = normalize(poolContract.MinDepositAmount())
      pool.MaxDepositAmount = normalize(poolContract.MaxDepositAmount())
      pool.save()
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

function getPool(event: ethereum.Event): DPool {
  let pool = DPool.load(event.address.toHex())
  return pool as DPool
}

function getUser(address: Address, pool: DPool): User {
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
  let user = getUser(event.params.sender, pool)
  let poolContract = DInterest.bind(Address.fromString(pool.address))

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
  deposit.initialMoneyMarketIncomeIndex = normalize(poolContract.moneyMarketIncomeIndex())
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
  pool.unfundedDepositAmount = pool.unfundedDepositAmount.plus(deposit.amount)
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
  user.totalMPHEarned = user.totalMPHEarned.plus(deposit.mintMPHAmount)
  user.save()

  // Update UserTotalDeposit
  let userTotalDepositID = user.id + DELIMITER + pool.id
  let userTotalDepositEntity = UserTotalDeposit.load(userTotalDepositID)
  if (userTotalDepositEntity == null) {
    // Initialize UserTotalDeposits entity
    userTotalDepositEntity = new UserTotalDeposit(userTotalDepositID)
    userTotalDepositEntity.user = user.id
    userTotalDepositEntity.pool = pool.id
    userTotalDepositEntity.totalActiveDeposit = ZERO_DEC
    userTotalDepositEntity.totalHistoricalDeposit = ZERO_DEC
    userTotalDepositEntity.totalInterestEarned = ZERO_DEC
    userTotalDepositEntity.totalHistoricalInterestEarned = ZERO_DEC
  }
  userTotalDepositEntity.totalActiveDeposit = userTotalDepositEntity.totalActiveDeposit.plus(deposit.amount)
  userTotalDepositEntity.totalHistoricalDeposit = userTotalDepositEntity.totalHistoricalDeposit.plus(deposit.amount)
  userTotalDepositEntity.totalInterestEarned = userTotalDepositEntity.totalInterestEarned.plus(deposit.interestEarned)
  userTotalDepositEntity.totalHistoricalInterestEarned = userTotalDepositEntity.totalHistoricalInterestEarned.plus(deposit.interestEarned)
  userTotalDepositEntity.save()
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
  user.totalMPHPaidBack = user.totalMPHPaidBack.plus(deposit.takeBackMPHAmount)
  user.save()

  // Update UserTotalDeposit
  let userTotalDepositID = user.id + DELIMITER + pool.id
  let userTotalDepositEntity = UserTotalDeposit.load(userTotalDepositID)
  userTotalDepositEntity.totalActiveDeposit = userTotalDepositEntity.totalActiveDeposit.minus(deposit.amount)
  userTotalDepositEntity.totalInterestEarned = userTotalDepositEntity.totalInterestEarned.minus(deposit.interestEarned)
  userTotalDepositEntity.save()

  // Update DPool statistics
  if (user.numActiveDeposits.equals(ZERO_INT)) {
    // User has become inactive
    let poolList = getPoolList()
    poolList.numActiveUsers = poolList.numActiveUsers.minus(ONE_INT)
    poolList.save()
  }
  pool.numActiveDeposits = pool.numActiveDeposits.minus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.unfundedDepositAmount = pool.unfundedDepositAmount.minus(deposit.amount)
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
    funding.active = funding.recordedFundedDepositAmount.gt(ZERO_DEC)
    funding.save()

    // Update FunderTotalInterest
    let funderTotalInterestID = funding.funder + DELIMITER + pool.id
    let funderTotalInterestEntity = FunderTotalInterest.load(funderTotalInterestID)

    if (!funding.active) {
      funderTotalInterestEntity.totalDeficitFunded = funderTotalInterestEntity.totalDeficitFunded.minus(funding.fundedDeficitAmount)
      funderTotalInterestEntity.totalInterestEarned = funderTotalInterestEntity.totalInterestEarned.minus(funding.totalInterestEarned)
    } else {
      funderTotalInterestEntity.totalInterestEarned = funderTotalInterestEntity.totalInterestEarned.plus(interestAmount)
      funderTotalInterestEntity.totalHistoricalInterestEarned = funderTotalInterestEntity.totalHistoricalInterestEarned.plus(interestAmount)
    }
    funderTotalInterestEntity.totalRecordedFundedDepositAmount = funderTotalInterestEntity.totalRecordedFundedDepositAmount.minus(deposit.amount)
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
  funding.active = true
  funding.recordedFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount)
  funding.recordedMoneyMarketIncomeIndex = fundingObj.recordedMoneyMarketIncomeIndex
  funding.initialFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount)
  funding.fundedDeficitAmount = normalize(event.params.deficitAmount)
  funding.totalInterestEarned = ZERO_DEC
  funding.mintMPHAmount = normalize(event.params.mintMPHAmount)
  funding.save()

  // Update DPool statistics
  pool.numFundings = pool.numFundings.plus(ONE_INT)
  pool.unfundedDepositAmount = pool.unfundedDepositAmount.minus(funding.fundedDeficitAmount)
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

  // Update FunderTotalInterest
  let funderTotalInterestID = funder.id + DELIMITER + pool.id
  let funderTotalInterestEntity = FunderTotalInterest.load(funderTotalInterestID)
  if (funderTotalInterestEntity == null) {
    // Initialize UserTotalDeposits entity
    funderTotalInterestEntity = new FunderTotalInterest(funderTotalInterestID)
    funderTotalInterestEntity.funder = funder.id
    funderTotalInterestEntity.pool = pool.id
    funderTotalInterestEntity.totalDeficitFunded = ZERO_DEC
    funderTotalInterestEntity.totalHistoricalDeficitFunded = ZERO_DEC
    funderTotalInterestEntity.totalInterestEarned = ZERO_DEC
    funderTotalInterestEntity.totalHistoricalInterestEarned = ZERO_DEC
    funderTotalInterestEntity.totalRecordedFundedDepositAmount = ZERO_DEC
  }
  funderTotalInterestEntity.totalDeficitFunded = funderTotalInterestEntity.totalDeficitFunded.plus(funding.fundedDeficitAmount)
  funderTotalInterestEntity.totalHistoricalDeficitFunded = funderTotalInterestEntity.totalHistoricalDeficitFunded.plus(funding.fundedDeficitAmount)
  funderTotalInterestEntity.totalRecordedFundedDepositAmount = funderTotalInterestEntity.totalRecordedFundedDepositAmount.plus(funding.recordedFundedDepositAmount)
  funderTotalInterestEntity.save()
}

export function handleBlock(block: ethereum.Block): void {
  let poolList = getPoolList()

  if (block.number.ge(BLOCK_HANDLER_START_BLOCK)) {
    poolList.pools.forEach(poolID => {
      // Update DPool statistics
      let pool = DPool.load(poolID)
      let poolContract = DInterest.bind(Address.fromString(pool.address))
      let oracleContract = IInterestOracle.bind(poolContract.interestOracle())
      pool.oneYearInterestRate = normalize(poolContract.calculateInterestAmount(tenPow(18), YEAR))
      let surplusResult = poolContract.surplus()
      pool.surplus = normalize(surplusResult.value1).times(surplusResult.value0 ? NEGONE_DEC : ONE_DEC)
      pool.moneyMarketIncomeIndex = poolContract.moneyMarketIncomeIndex()
      pool.oracleInterestRate = normalize(oracleContract.updateAndQuery().value1)
      pool.save()
    });
  }
}