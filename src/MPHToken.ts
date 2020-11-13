import {
  Transfer as ETransfer
} from '../generated/MPHToken/MPHToken'
import { ZERO_ADDR, normalize, getMPH, getMPHHolder } from './utils'

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