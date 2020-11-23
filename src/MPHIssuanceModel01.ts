import { DInterest } from '../generated/cDAIPool/DInterest'
import { ERC20 } from '../generated/cDAIPool/ERC20'
import { SetPoolDepositorRewardMintMultiplierCall, SetPoolDepositorRewardTakeBackMultiplierCall, SetPoolFunderRewardMultiplierCall } from '../generated/MPHIssuanceModel01/MPHIssuanceModel01'
import { DPool } from '../generated/schema'
import { normalize } from './utils'

export function handleSetDepositorRewardMintMultiplier(call: SetPoolDepositorRewardMintMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    let poolContract = DInterest.bind(call.inputs.pool)
    let stablecoinContract = ERC20.bind(poolContract.stablecoin())
    let stablecoinDecimals: number = stablecoinContract.decimals()
    pool.mphDepositorRewardMintMultiplier = normalize(call.inputs.newMultiplier, 36 - stablecoinDecimals)
    pool.save()
  }
}

export function handleSetPoolDepositorRewardTakeBackMultiplier(call: SetPoolDepositorRewardTakeBackMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    pool.mphDepositorRewardTakeBackMultiplier = normalize(call.inputs.newMultiplier)
    pool.save()
  }
}

export function handleSetPoolFunderRewardMultiplier(call: SetPoolFunderRewardMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    let poolContract = DInterest.bind(call.inputs.pool)
    let stablecoinContract = ERC20.bind(poolContract.stablecoin())
    let stablecoinDecimals: number = stablecoinContract.decimals()
    pool.mphFunderRewardMultiplier = normalize(call.inputs.newMultiplier, 36 - stablecoinDecimals)
    pool.save()
  }
}
