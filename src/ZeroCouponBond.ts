import {
  Mint as MintEvent
} from '../generated/templates/ZeroCouponBond/ZeroCouponBond'
import { FractionalDeposit as FractionalDepositContract } from '../generated/templates/ZeroCouponBond/FractionalDeposit'
import { FractionalDeposit } from '../generated/schema'
import { DELIMITER } from './utils'

export function handleMint(event: MintEvent): void {
  let fractionalDeposit = FractionalDeposit.load(event.params.fractionalDepositAddress.toHex())
  if (fractionalDeposit == null) {
    // Initialize fractionalDeposit
    fractionalDeposit = new FractionalDeposit(event.params.fractionalDepositAddress.toHex())
    fractionalDeposit.address = event.params.fractionalDepositAddress.toHex()
    fractionalDeposit.zeroCouponBondAddress = event.address.toHex()

    let fractionalDepositContract = FractionalDepositContract.bind(event.params.fractionalDepositAddress)
    let depositID = fractionalDepositContract.nftID()
    let poolAddress = fractionalDepositContract.pool()
    let depositEntityID = poolAddress.toHex() + DELIMITER + depositID.toString()
    fractionalDeposit.deposit = depositEntityID

    fractionalDeposit.save()
  }
}