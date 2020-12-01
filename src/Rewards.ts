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

  mph.rewardPerSecond = normalize(rewards.rewardRate())
  mph.rewardPerMPHPerSecond = mph.totalStakedMPHBalance.equals(ZERO_DEC) ?
    ZERO_DEC :
    mph.rewardPerSecond.div(mph.totalStakedMPHBalance)
  mph.totalHistoricalReward = mph.totalHistoricalReward.plus(normalize(event.params.reward))

  mph.save()
}

export function handleStaked(event: EStaked): void {
  let mph = getMPH()
  let mphHolder = getMPHHolder(event.params.user)
  let rewards = Rewards.bind(event.address)

  let stakeAmount = normalize(event.params.amount)
  mph.totalStakedMPHBalance = mph.totalStakedMPHBalance.plus(stakeAmount)
  mphHolder.stakedMPHBalance = mphHolder.stakedMPHBalance.plus(stakeAmount)
  mph.rewardPerSecond = normalize(rewards.rewardRate())
  mph.rewardPerMPHPerSecond = mph.rewardPerSecond.div(mph.totalStakedMPHBalance)

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
  mph.rewardPerSecond = normalize(rewards.rewardRate())
  mph.rewardPerMPHPerSecond = mph.totalStakedMPHBalance.equals(ZERO_DEC) ?
    ZERO_DEC :
    mph.rewardPerSecond.div(mph.totalStakedMPHBalance)

  mphHolder.save()
  mph.save()
}

export function handleRewardPaid(event: ERewardPaid): void {
  let mph = getMPH()
  let mphHolder = getMPHHolder(event.params.user)

  let rewardAmount = normalize(event.params.reward)
  mphHolder.totalHistoricalReward = mphHolder.totalHistoricalReward.plus(rewardAmount)

  mphHolder.save()
  mph.save()
}