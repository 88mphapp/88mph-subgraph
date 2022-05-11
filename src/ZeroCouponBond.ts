import {
  Mint as MintEvent,
  RedeemFractionalDepositShares as RedeemFractionalDepositSharesEvent
} from '../generated/templates/ZeroCouponBond/ZeroCouponBond'
import { FractionalDeposit as FractionalDepositContract } from '../generated/templates/ZeroCouponBond/FractionalDeposit'
import { FractionalDeposit } from '../generated/schema'
import { FractionalDeposit as FractionalDepositTemplate } from '../generated/templates'
import { DELIMITER } from './utils'

export function handleMint(event: MintEvent): void {
  let fractionalDeposit = FractionalDeposit.load(event.params.fractionalDepositAddress.toHex())
  if (fractionalDeposit == null) {
    // Initialize fractionalDeposit
    fractionalDeposit = new FractionalDeposit(event.params.fractionalDepositAddress.toHex())
    fractionalDeposit.address = event.params.fractionalDepositAddress.toHex()
    fractionalDeposit.zeroCouponBondAddress = event.address.toHex()
    fractionalDeposit.active = true

    // fetch info from the fractional deposit contract
    let fractionalDepositContract = FractionalDepositContract.bind(event.params.fractionalDepositAddress)
    let depositID = fractionalDepositContract.nftID()
    let poolAddress = fractionalDepositContract.pool()
    let depositEntityID = poolAddress.toHex() + DELIMITER + depositID.toString()
    fractionalDeposit.deposit = depositEntityID
    fractionalDeposit.ownerAddress = fractionalDepositContract.owner().toHex()

    fractionalDeposit.save()

    // create template for tracking fractional deposit ownership
    FractionalDepositTemplate.create(event.params.fractionalDepositAddress)
  }
}

export function handleRedeemFractionalDepositShares(event: RedeemFractionalDepositSharesEvent): void {
  let fractionalDeposit = FractionalDeposit.load(event.params.fractionalDepositAddress.toHex())
  fractionalDeposit.active = false
  fractionalDeposit.save()
}