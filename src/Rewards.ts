import {
  Rewards,
  RewardAdded as ERewardAdded,
  Staked as EStaked,
  Withdrawn as EWithdrawn,
  RewardPaid as ERewardPaid
} from '../generated/Rewards/Rewards'
import { ZERO_DEC, normalize, getMPH, getMPHHolder } from './utils'

export function handleRewardAdded(event: ERewardAdded): void {
  let mph = getMPH()
  let rewards = Rewards.bind(event.address)

  mph.rewardPerMPHPerSecond = mph.totalStakedMPHBalance.equals(ZERO_DEC) ?
    ZERO_DEC :
    normalize(rewards.rewardRate()).div(mph.totalStakedMPHBalance)

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
  mph.rewardPerMPHPerSecond = mph.totalStakedMPHBalance.equals(ZERO_DEC) ?
    ZERO_DEC :
    normalize(rewards.rewardRate()).div(mph.totalStakedMPHBalance)

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