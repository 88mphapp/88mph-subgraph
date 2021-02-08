import { OwnershipTransferred } from '../generated/templates/ZeroCouponBond/FractionalDeposit'
import { FractionalDeposit } from '../generated/schema'

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  let fractionalDeposit = FractionalDeposit.load(event.address.toHex())
  if (fractionalDeposit !== null) {
    fractionalDeposit.ownerAddress = event.params.newOwner.toHex()
    fractionalDeposit.save()
  }
}