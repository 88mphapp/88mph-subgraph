import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import {
  Transfer as ETransfer
} from '../generated/MPHToken/MPHToken'
import { MPHHolder, MPH } from '../generated/schema'

let MPH_ID = "0"
let ZERO_DEC = BigDecimal.fromString("0")
let PRECISION = new BigDecimal(tenPow(18))
let ZERO_ADDR = Address.fromString("0x0000000000000000000000000000000000000000")

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
    entity = new MPH(MPH_ID)
    entity.totalSupply = ZERO_DEC
    entity.totalStakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.rewardPerMPHPerSecond = ZERO_DEC
    entity.save()
  }
  return entity as MPH
}

function getMPHHolder(address: Address): MPHHolder | null {
  if (address.equals(ZERO_ADDR)) {
    return null
  }
  let entity = MPHHolder.load(address.toHex())
  if (entity == null) {
    entity = new MPHHolder(address.toHex())
    entity.address = address.toHex()
    entity.mphBalance = ZERO_DEC
    entity.stakedMPHBalance = ZERO_DEC
    entity.totalHistoricalReward = ZERO_DEC
    entity.save()
  }
  return entity as MPHHolder
}

export function handleTransfer(event: ETransfer): void {
  let mph = getMPH()
  let value = normalize(event.params.value)

  if (event.params.from.equals(ZERO_ADDR)) {
    // mint
    mph.totalSupply = mph.totalSupply.plus(value)
  } else if (event.params.to.equals(ZERO_ADDR)) {
    // burn
    mph.totalSupply = mph.totalSupply.minus(value)
  }
  mph.save()

  let from = getMPHHolder(event.params.from)

  if (from != null) {
    from.mphBalance = from.mphBalance.minus(value)
    from.save()
  }

  let to = getMPHHolder(event.params.to)

  if (to != null) {
    to.mphBalance = to.mphBalance.plus(value)
    to.save()
  }
}