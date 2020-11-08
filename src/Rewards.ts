import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import {
  Rewards,
  RewardAdded as ERewardAdded,
  Staked as EStaked,
  Withdrawn as EWithdrawn,
  RewardPaid as ERewardPaid
} from '../generated/Rewards/Rewards'
import { MPHHolder, MPH } from '../generated/schema'

let MPH_ID = "0"
let ZERO_DEC = BigDecimal.fromString("0")
let PRECISION = new BigDecimal(tenPow(18))

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

function getMPH(): MPH {
  let entity = MPH.load(MPH_ID)
  if (entity == null) {
    entity.totalSupply = ZERO_DEC
    entity.totalStakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.rewardPerMPHPerSecond = ZERO_DEC
    entity.save()
  }
  return entity as MPH
}

function getMPHHolder(address: Address): MPHHolder {
  let entity = MPHHolder.load(address.toHex())
  if (entity == null) {
    entity.address = address.toHex()
    entity.mphBalance = ZERO_DEC
    entity.stakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}

export function handleRewardAdded(event: ERewardAdded): void {
  let mph = getMPH()
  let rewards = Rewards.bind(event.address)

  mph.rewardPerMPHPerSecond = normalize(rewards.rewardRate()).div(mph.totalStakedMPHBalance)

  mph.save()
}

export function handleStaked(event: EStaked): void {
  let mph = getMPH()
  let mphHolder = getMPHHolder(event.params.user)
  let rewards = Rewards.bind(event.address)

  let stakeAmount = normalize(event.params.amount)
  mph.totalStakedMPHBalance = mph.totalStakedMPHBalance.plus(stakeAmount)
  mphHolder.stakedMPHBalance = mphHolder.stakedMPHBalance.plus(stakeAmount)
  mph.rewardPerMPHPerSecond = normalize(rewards.rewardRate()).div(mph.totalStakedMPHBalance)

  mphHolder.save()
  mph.save()
}

export function handleWithdrawn(event: EWithdrawn): void {
  let mph = getMPH()
  let mphHolder = getMPHHolder(event.params.user)
  let rewards = Rewards.bind(event.address)

  let stakeAmount = normalize(event.params.amount)
  mph.totalStakedMPHBalance = mph.totalStakedMPHBalance.minus(stakeAmount)
  mphHolder.stakedMPHBalance = mphHolder.stakedMPHBalance.minus(stakeAmount)
  mph.rewardPerMPHPerSecond = normalize(rewards.rewardRate()).div(mph.totalStakedMPHBalance)

  mphHolder.save()
  mph.save()
}

export function handleRewardPaid(event: ERewardPaid): void {
  let mph = getMPH()
  let mphHolder = getMPHHolder(event.params.user)

  let rewardAmount = normalize(event.params.reward)
  mph.totalHistoricalReward = mph.totalHistoricalReward.plus(rewardAmount)
  mphHolder.totalHistoricalReward = mphHolder.totalHistoricalReward.plus(rewardAmount)

  mphHolder.save()
  mph.save()
}