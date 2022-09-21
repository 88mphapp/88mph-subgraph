import { Address } from "@graphprotocol/graph-ts";
import { Vesting02, ECreateVest, EUpdateVest, EWithdraw, Transfer } from "../../generated/Vesting02/Vesting02";
import { DInterest } from '../../generated/Vesting02/DInterest';
import { Deposit } from "../../generated/schema";

import { DELIMITER, ZERO_ADDR, ZERO_BD, ONE_BD } from "../utils/constants";
import { getPool, getVest } from '../utils/entities';
import { normalize } from '../utils/math';

export function handleCreateVest(event: ECreateVest): void {
  // load entities
  let pool = getPool(event.params.pool.toHex());
  let vest = getVest(event.address, event.params.vestID);

  // load contracts
  let poolContract = DInterest.bind(Address.fromString(pool.id));
  let vestContract = Vesting02.bind(event.address);

  // load structs
  let vestStruct = vestContract.getVest(event.params.vestID);
  let depositStruct = poolContract.getDeposit(event.params.depositID);

  // calculate amounts
  let vestAmountPerStablecoinPerSecond = normalize(event.params.vestAmountPerStablecoinPerSecond, 36 - pool.stablecoinDecimals.toI32());
  let depositAmount = normalize(depositStruct.virtualTokenTotalSupply, pool.stablecoinDecimals.toI32()).div(normalize(depositStruct.interestRate).plus(ONE_BD));
  let depositTime = depositStruct.maturationTimestamp.minus(event.block.timestamp);
  let totalExpectedMPHAmount = depositAmount.times(vestAmountPerStablecoinPerSecond).times(depositTime.toBigDecimal());

  // update Vest
  vest.lastUpdateTimestamp = event.block.timestamp;
  vest.accumulatedAmount = normalize(vestStruct.accumulatedAmount);
  vest.withdrawnAmount = normalize(vestStruct.withdrawnAmount);
  vest.vestAmountPerStablecoinPerSecond = vestAmountPerStablecoinPerSecond;
  vest.totalExpectedMPHAmount = totalExpectedMPHAmount;
  vest.save();

  // update Deposit
  let deposit = Deposit.load(vest.deposit);
  if (deposit !== null) {
    deposit.vest = vest.id
    deposit.save();
  }
}

export function handleUpdateVest(event: EUpdateVest): void {
  let vest = getVest(event.address, event.params.vestID);
  let vestContract = Vesting02.bind(event.address);
  let vestStruct = vestContract.getVest(event.params.vestID);

  let pool = getPool(vestStruct.pool.toHex());
  let deposit = Deposit.load(vest.deposit);

  vest.lastUpdateTimestamp = event.block.timestamp;
  vest.accumulatedAmount = normalize(vestStruct.accumulatedAmount);
  vest.vestAmountPerStablecoinPerSecond = normalize(vestStruct.vestAmountPerStablecoinPerSecond, 36 - pool.stablecoinDecimals.toI32());
  if (deposit !== null) {
    if (event.block.timestamp.lt(deposit.maturationTimestamp)) {
      let depositAmount = normalize(event.params.currentDepositAmount.plus(event.params.depositAmount), pool.stablecoinDecimals.toI32());
      let depositTime = deposit.maturationTimestamp.minus(event.block.timestamp);
      vest.totalExpectedMPHAmount = vest.accumulatedAmount.plus(depositAmount.times(vest.vestAmountPerStablecoinPerSecond).times(depositTime.toBigDecimal()));
    } else {
      vest.totalExpectedMPHAmount = vest.accumulatedAmount;
    }
  }
  vest.save();
}

export function handleWithdraw(event: EWithdraw): void {
  let vest = getVest(event.address, event.params.vestID);

  let amount = normalize(event.params.withdrawnAmount);
  vest.withdrawnAmount = vest.withdrawnAmount.plus(amount);
  vest.save();
}

export function handleTransfer(event: Transfer): void {
  let vest = getVest(event.address, event.params.tokenId);
  vest.owner = event.params.to.toHex();
  vest.save();
}
