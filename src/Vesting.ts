import {
  VestCall,
  WithdrawVestedCall,
} from '../generated/Vesting/Vesting'
import { ZERO_DEC, normalize, DELIMITER } from './utils'
import { Vest } from '../generated/schema'

export function handleVest(call: VestCall): void {
  let vestID = call.inputs.to.toHex() + DELIMITER + call.outputs.vestIdx.toString()
  let vest = new Vest(vestID)
  vest.index = call.outputs.vestIdx
  vest.user = call.inputs.to.toHex()
  vest.amount = normalize(call.inputs.amount)
  vest.vestPeriodInSeconds = call.inputs.vestPeriodInSeconds
  vest.creationTimestamp = call.block.timestamp
  vest.withdrawnAmount = ZERO_DEC
  vest.save()
}

export function handleWithdrawVested(call: WithdrawVestedCall): void {
  let vestID = call.inputs.account.toHex() + DELIMITER + call.inputs.vestIdx.toString()
  let vest = Vest.load(vestID)
  vest.withdrawnAmount = vest.withdrawnAmount.plus(normalize(call.outputs.withdrawnAmount))
  vest.save()
}