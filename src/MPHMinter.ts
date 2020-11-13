import { Address } from '@graphprotocol/graph-ts'
import { DInterest } from '../generated/aUSDCPool/DInterest'
import { ERC20 } from '../generated/aUSDCPool/ERC20'
import { SetPoolMintingMultiplierCall, SetPoolDepositorRewardMultiplierCall, SetPoolFunderRewardMultiplierCall, MPHMinter } from '../generated/MPHMinter/MPHMinter'
import { DPool } from '../generated/schema'
import { normalize } from './utils'

export function handleSetPoolMintingMultiplier(call: SetPoolMintingMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    let poolContract = DInterest.bind(call.inputs.pool)
    let stablecoinContract = ERC20.bind(poolContract.stablecoin())
    let stablecoinDecimals: number = stablecoinContract.decimals()
    pool.mphMintingMultiplier = normalize(call.inputs.newMultiplier, 36 - stablecoinDecimals)
    pool.save()
  }
}

export function handleSetPoolDepositorRewardMultiplier(call: SetPoolDepositorRewardMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    pool.mphDepositorRewardMultiplier = normalize(call.inputs.newMultiplier)
    pool.save()
  }
}

export function handleSetPoolFunderRewardMultiplier(call: SetPoolFunderRewardMultiplierCall): void {
  let pool = DPool.load(call.inputs.pool.toHex())
  if (pool != null) {
    pool.mphFunderRewardMultiplier = normalize(call.inputs.newMultiplier)
    pool.save()
  }
}
