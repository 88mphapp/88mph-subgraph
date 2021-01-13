import { dataSource } from '@graphprotocol/graph-ts'
import {
  Transfer as ETransfer
} from '../generated/templates/NFT/NFT'
import { Deposit, Funding, DPool, UserTotalDeposit, FunderTotalInterest } from '../generated/schema'
import { DELIMITER, getFunder, getPoolList, getUser, ONE_INT, stringEqual, ZERO_ADDR, ZERO_DEC, ZERO_INT } from './utils'

export function handleTransfer(event: ETransfer): void {
  if (event.params.from.equals(ZERO_ADDR) || event.params.to.equals(ZERO_ADDR)) {
    // mint or burn, ignore
    return
  }

  let tokenId = event.params.tokenId
  let from = event.params.from
  let to = event.params.to
  let context = dataSource.context()
  let pool = DPool.load(context.getString('pool')) as DPool
  let type = context.getString('type')
  let poolList = getPoolList()

  if (stringEqual(type, 'deposit')) {
    let fromUser = getUser(from, pool)
    let toUser = getUser(to, pool)
    let deposit = Deposit.load(pool.address + DELIMITER + tokenId.toString())

    // update from user
    fromUser.numDeposits = fromUser.numDeposits.minus(ONE_INT)
    if (deposit.active) {
      fromUser.numActiveDeposits = fromUser.numActiveDeposits.minus(ONE_INT)
    }
    if (fromUser.numActiveDeposits.equals(ZERO_INT)) {
      // User has become inactive
      poolList.numActiveUsers = poolList.numActiveUsers.minus(ONE_INT)
    }
    fromUser.save()

    // update from user total deposits
    let fromUserTotalDepositID = fromUser.id + DELIMITER + pool.id
    let fromUserTotalDepositEntity = UserTotalDeposit.load(fromUserTotalDepositID)
    fromUserTotalDepositEntity.totalActiveDeposit = fromUserTotalDepositEntity.totalActiveDeposit.minus(deposit.amount)
    fromUserTotalDepositEntity.totalHistoricalDeposit = fromUserTotalDepositEntity.totalHistoricalDeposit.minus(deposit.amount)
    fromUserTotalDepositEntity.totalInterestEarned = fromUserTotalDepositEntity.totalInterestEarned.minus(deposit.interestEarned)
    fromUserTotalDepositEntity.totalHistoricalInterestEarned = fromUserTotalDepositEntity.totalHistoricalInterestEarned.minus(deposit.interestEarned)
    fromUserTotalDepositEntity.save()

    // update to user
    toUser.numDeposits = toUser.numDeposits.plus(ONE_INT)
    if (toUser.numActiveDeposits.equals(ZERO_INT)) {
      // User has become active
      poolList.numActiveUsers = poolList.numActiveUsers.plus(ONE_INT)
    }
    if (deposit.active) {
      toUser.numActiveDeposits = toUser.numActiveDeposits.plus(ONE_INT)
    }
    if (!toUser.pools.includes(pool.id)) {
      // Add pool to list of pools
      let pools = toUser.pools
      pools.push(pool.id)
      toUser.pools = pools
      toUser.numPools = toUser.numPools.plus(ONE_INT)
      pool.numUsers = pool.numUsers.plus(ONE_INT)
    }
    toUser.save()

    let toUserTotalDepositID = toUser.id + DELIMITER + pool.id
    let toUserTotalDepositEntity = UserTotalDeposit.load(toUserTotalDepositID)
    if (toUserTotalDepositEntity == null) {
      // Initialize UserTotalDeposits entity
      toUserTotalDepositEntity = new UserTotalDeposit(toUserTotalDepositID)
      toUserTotalDepositEntity.user = toUser.id
      toUserTotalDepositEntity.pool = pool.id
      toUserTotalDepositEntity.totalActiveDeposit = ZERO_DEC
      toUserTotalDepositEntity.totalHistoricalDeposit = ZERO_DEC
      toUserTotalDepositEntity.totalInterestEarned = ZERO_DEC
      toUserTotalDepositEntity.totalHistoricalInterestEarned = ZERO_DEC
    }
    toUserTotalDepositEntity.totalActiveDeposit = toUserTotalDepositEntity.totalActiveDeposit.plus(deposit.amount)
    toUserTotalDepositEntity.totalHistoricalDeposit = toUserTotalDepositEntity.totalHistoricalDeposit.plus(deposit.amount)
    toUserTotalDepositEntity.totalInterestEarned = toUserTotalDepositEntity.totalInterestEarned.plus(deposit.interestEarned)
    toUserTotalDepositEntity.totalHistoricalInterestEarned = toUserTotalDepositEntity.totalHistoricalInterestEarned.plus(deposit.interestEarned)
    toUserTotalDepositEntity.save()

    // update deposit
    deposit.user = toUser.id
    deposit.save()
  } else if (stringEqual(type, 'funding')) {
    let fromFunder = getFunder(from, pool)
    let toFunder = getFunder(to, pool)
    let funding = Funding.load(pool.address + DELIMITER + tokenId.toString())

    // update fromFunder
    fromFunder.numFundings = fromFunder.numFundings.minus(ONE_INT)
    fromFunder.save()

    // update fromFunder total interest
    let fromFunderTotalInterestID = fromFunder.id + DELIMITER + pool.id
    let fromFunderTotalInterestEntity = FunderTotalInterest.load(fromFunderTotalInterestID)
    fromFunderTotalInterestEntity.totalDeficitFunded = fromFunderTotalInterestEntity.totalDeficitFunded.minus(funding.fundedDeficitAmount)
    fromFunderTotalInterestEntity.totalHistoricalDeficitFunded = fromFunderTotalInterestEntity.totalHistoricalDeficitFunded.minus(funding.fundedDeficitAmount)
    fromFunderTotalInterestEntity.totalRecordedFundedDepositAmount = fromFunderTotalInterestEntity.totalRecordedFundedDepositAmount.minus(funding.recordedFundedDepositAmount)
    fromFunderTotalInterestEntity.save()

    // update toFunder
    toFunder.numFundings = toFunder.numFundings.plus(ONE_INT)
    toFunder.save()

    // update toFunder total interest
    let toFunderTotalInterestID = toFunder.id + DELIMITER + pool.id
    let toFunderTotalInterestEntity = FunderTotalInterest.load(toFunderTotalInterestID)
    if (toFunderTotalInterestEntity == null) {
      // Initialize UserTotalDeposits entity
      toFunderTotalInterestEntity = new FunderTotalInterest(toFunderTotalInterestID)
      toFunderTotalInterestEntity.funder = toFunder.id
      toFunderTotalInterestEntity.pool = pool.id
      toFunderTotalInterestEntity.totalDeficitFunded = ZERO_DEC
      toFunderTotalInterestEntity.totalHistoricalDeficitFunded = ZERO_DEC
      toFunderTotalInterestEntity.totalInterestEarned = ZERO_DEC
      toFunderTotalInterestEntity.totalHistoricalInterestEarned = ZERO_DEC
      toFunderTotalInterestEntity.totalRecordedFundedDepositAmount = ZERO_DEC
    }
    toFunderTotalInterestEntity.totalDeficitFunded = toFunderTotalInterestEntity.totalDeficitFunded.plus(funding.fundedDeficitAmount)
    toFunderTotalInterestEntity.totalHistoricalDeficitFunded = toFunderTotalInterestEntity.totalHistoricalDeficitFunded.plus(funding.fundedDeficitAmount)
    toFunderTotalInterestEntity.totalRecordedFundedDepositAmount = toFunderTotalInterestEntity.totalRecordedFundedDepositAmount.plus(funding.recordedFundedDepositAmount)
    toFunderTotalInterestEntity.save()

    // update funding
    funding.funder = toFunder.id
    funding.save()
  }

  poolList.save()
  pool.save()
}