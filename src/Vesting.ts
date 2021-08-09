import {
  ECreateVest,
  EUpdateVest,
  EWithdraw,
  Transfer
} from "../generated/Vesting/Vesting02";
import { DInterest } from "../generated/Vesting/DInterest";
import {
  ZERO_DEC,
  normalize,
  DELIMITER,
  ZERO_ADDR,
  getPool,
  ONE_DEC,
  getTokenDecimals
} from "./utils";
import { Deposit, Vest } from "../generated/schema";
import { Vesting02 as VestContract } from "../generated/Vesting/Vesting02";
import { Address, log } from "@graphprotocol/graph-ts";

export function handleCreateVest(event: ECreateVest): void {
  let pool = getPool(event.params.pool.toHex());
  let poolContract = DInterest.bind(Address.fromString(pool.address));
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  let depositEntityID =
    event.params.pool.toHex() + DELIMITER + event.params.depositID.toString();
  let vest = new Vest(event.params.vestID.toString());
  vest.pool = event.params.pool.toHex();
  vest.deposit = depositEntityID;
  vest.owner = event.params.to.toHex();
  vest.nftID = event.params.vestID;
  vest.lastUpdateTimestamp = event.block.timestamp;
  vest.accumulatedAmount = ZERO_DEC;
  vest.withdrawnAmount = ZERO_DEC;
  vest.vestAmountPerStablecoinPerSecond = normalize(
    event.params.vestAmountPerStablecoinPerSecond,
    36 - stablecoinDecimals
  );

  let depositStructResult = poolContract.try_getDeposit(event.params.depositID);
  if (depositStructResult.reverted) {
    vest.totalExpectedMPHAmount = ZERO_DEC;
  } else {
    let depositStruct = poolContract.getDeposit(event.params.depositID);
    let depositAmount = normalize(
      depositStruct.virtualTokenTotalSupply,
      stablecoinDecimals
    ).div(normalize(depositStruct.interestRate).plus(ONE_DEC));
    let depositTime = depositStruct.maturationTimestamp.minus(
      event.block.timestamp
    );
    vest.totalExpectedMPHAmount = depositAmount
      .times(vest.vestAmountPerStablecoinPerSecond)
      .times(depositTime.toBigDecimal());
  }

  vest.save();

  let deposit = Deposit.load(depositEntityID);
  if (deposit != null) {
    deposit.vest = vest.id;
    deposit.save();
  }
}

export function handleUpdateVest(event: EUpdateVest): void {
  let vest = Vest.load(event.params.vestID.toString());
  if (vest != null) {
    let vestContract = VestContract.bind(event.address);
    let vestStruct = vestContract.getVest(event.params.vestID);
    let pool = getPool(vestStruct.pool.toHex());
    let stablecoinDecimals: number = getTokenDecimals(
      Address.fromString(pool.stablecoin)
    );

    vest.lastUpdateTimestamp = event.block.timestamp;
    vest.accumulatedAmount = normalize(vestStruct.accumulatedAmount);
    vest.vestAmountPerStablecoinPerSecond = normalize(
      vestStruct.vestAmountPerStablecoinPerSecond,
      36 - stablecoinDecimals
    );

    let deposit = Deposit.load(vest.deposit);
    if (event.block.timestamp.lt(deposit.maturationTimestamp)) {
      // total MPH equals accumulated plus future
      let depositAmount = normalize(
        event.params.currentDepositAmount.plus(event.params.depositAmount),
        stablecoinDecimals
      );
      vest.totalExpectedMPHAmount = vest.accumulatedAmount.plus(
        depositAmount
          .times(vest.vestAmountPerStablecoinPerSecond)
          .times(
            deposit.maturationTimestamp
              .minus(event.block.timestamp)
              .toBigDecimal()
          )
      );
    } else {
      // total MPH is accumulated
      vest.totalExpectedMPHAmount = vest.accumulatedAmount;
    }

    vest.save();
  }
}

export function handleWithdraw(event: EWithdraw): void {
  let vest = Vest.load(event.params.vestID.toString());
  if (vest != null) {
    vest.withdrawnAmount = vest.withdrawnAmount.plus(
      normalize(event.params.withdrawnAmount)
    );
    vest.save();
  }
}

export function handleTransfer(event: Transfer): void {
  if (
    event.params.from.equals(ZERO_ADDR) ||
    event.params.to.equals(ZERO_ADDR)
  ) {
    // mint or burn, ignore
    return;
  }
  let vest = Vest.load(event.params.tokenId.toString());
  if (vest != null) {
    vest.owner = event.params.to.toHex();
    vest.save();
  }
}
