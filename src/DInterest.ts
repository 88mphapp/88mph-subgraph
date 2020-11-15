import { BigDecimal, Address, ethereum, log, ByteArray } from '@graphprotocol/graph-ts'
import {
  DInterest,
  EDeposit,
  EWithdraw,
  EFund,
  ESetParamUint,
  ESetParamAddress
} from '../generated/aUSDCPool/DInterest'
import { IInterestOracle } from '../generated/aUSDCPool/IInterestOracle'
import { ERC20 } from '../generated/aUSDCPool/ERC20'
import { DPool, Deposit, Funding, UserTotalDeposit, FunderTotalInterest } from '../generated/schema'
import { getPool, getUser, DELIMITER, normalize, ZERO_INT, ZERO_DEC, getPoolList, ONE_INT, getFunder, tenPow, BLOCK_HANDLER_START_BLOCK, YEAR, NEGONE_DEC, ONE_DEC, keccak256 } from './utils'

export function handleEDeposit(event: EDeposit): void {
  let pool = getPool(event)
  let user = getUser(event.params.sender, pool)
  let poolContract = DInterest.bind(Address.fromString(pool.address))
  let stablecoinContract = ERC20.bind(poolContract.stablecoin())
  let stablecoinDecimals: number = stablecoinContract.decimals()

  // Create new Deposit entity
  let deposit = new Deposit(pool.address + DELIMITER + event.params.depositID.toString())
  deposit.nftID = event.params.depositID
  deposit.user = user.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount, stablecoinDecimals)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.depositTimestamp = event.block.timestamp
  deposit.interestEarned = normalize(event.params.interestAmount, stablecoinDecimals)
  deposit.fundingID = ZERO_INT
  deposit.mintMPHAmount = normalize(event.params.mintMPHAmount)
  deposit.takeBackMPHAmount = ZERO_DEC
  deposit.initialMoneyMarketIncomeIndex = poolContract.moneyMarketIncomeIndex()
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
  let stablecoinContract = ERC20.bind(poolContract.stablecoin())
  let stablecoinDecimals: number = stablecoinContract.decimals()

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
    funding.recordedFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount, stablecoinDecimals)
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
    funderTotalInterestEntity.save()
  }
}

export function handleEFund(event: EFund): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let funder = getFunder(event.params.sender, pool)
  let stablecoinContract = ERC20.bind(poolContract.stablecoin())
  let stablecoinDecimals: number = stablecoinContract.decimals()

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
  funding.recordedFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount, stablecoinDecimals)
  funding.recordedMoneyMarketIncomeIndex = fundingObj.recordedMoneyMarketIncomeIndex
  funding.initialFundedDepositAmount = normalize(fundingObj.recordedFundedDepositAmount, stablecoinDecimals)
  funding.fundedDeficitAmount = normalize(event.params.deficitAmount, stablecoinDecimals)
  funding.totalInterestEarned = ZERO_DEC
  funding.mintMPHAmount = normalize(event.params.mintMPHAmount)
  funding.save()

  // Update DPool statistics
  pool.numFundings = pool.numFundings.plus(ONE_INT)
  pool.unfundedDepositAmount = pool.unfundedDepositAmount.minus(funding.fundedDeficitAmount)
  pool.save()

  // Update Funder
  if (!funder.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = funder.pools
    pools.push(pool.id)
    funder.pools = pools
    funder.numPools = funder.numPools.plus(ONE_INT)
  }
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

export function handleESetParamAddress(event: ESetParamAddress): void {
  let pool = getPool(event)
  let paramName = event.params.paramName
  if (paramName == keccak256('feeModel')) {
  } else if (paramName == keccak256('interestModel')) {
    pool.interestModel = event.params.newValue.toHex()
  } else if (paramName == keccak256('interestOracle')) {
  } else if (paramName == keccak256('moneyMarket.rewards')) { }
  pool.save()
}

export function handleESetParamUint(event: ESetParamUint): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(Address.fromString(pool.address))
  let stablecoinContract = ERC20.bind(poolContract.stablecoin())
  let stablecoinDecimals: number = stablecoinContract.decimals()
  let stablecoinPrecision = new BigDecimal(tenPow(stablecoinDecimals))
  let paramName = event.params.paramName
  if (paramName == keccak256('MinDepositPeriod')) {
    pool.MinDepositPeriod = event.params.newValue
  }
  else if (paramName == keccak256('MaxDepositPeriod')) {
    pool.MaxDepositPeriod = event.params.newValue
  }
  else if (paramName == keccak256('MinDepositAmount')) {
    pool.MinDepositAmount = event.params.newValue.toBigDecimal().div(stablecoinPrecision)
  }
  else if (paramName == keccak256('MaxDepositAmount')) {
    pool.MaxDepositAmount = event.params.newValue.toBigDecimal().div(stablecoinPrecision)
  }
  pool.save()
}

export function handleBlock(block: ethereum.Block): void {
  let poolList = getPoolList()

  if (block.number.ge(BLOCK_HANDLER_START_BLOCK)) {
    poolList.pools.forEach(poolID => {
      // Update DPool statistics
      let pool = DPool.load(poolID)
      let poolContract = DInterest.bind(Address.fromString(pool.address))
      let stablecoinContract = ERC20.bind(poolContract.stablecoin())
      let stablecoinDecimals: number = stablecoinContract.decimals()
      let oracleContract = IInterestOracle.bind(poolContract.interestOracle())
      pool.oneYearInterestRate = normalize(poolContract.calculateInterestAmount(tenPow(18), YEAR))
      let surplusResult = poolContract.surplus()
      pool.surplus = normalize(surplusResult.value1, stablecoinDecimals).times(surplusResult.value0 ? NEGONE_DEC : ONE_DEC)
      pool.moneyMarketIncomeIndex = poolContract.moneyMarketIncomeIndex()
      pool.oracleInterestRate = normalize(oracleContract.updateAndQuery().value1)
      pool.save()
    });
  }
}