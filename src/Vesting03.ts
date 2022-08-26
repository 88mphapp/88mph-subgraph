import { Staked, RewardPaid, Transfer } from "../generated/Vesting03/Vesting03";
import { Vesting02 } from "../generated/Vesting/Vesting02";
import { Deposit, Vest } from "../generated/schema";
import {
  ZERO_DEC,
  ZERO_INT,
  normalize,
  DELIMITER,
  ZERO_ADDR,
  getPool,
  ONE_DEC,
  getTokenDecimals
} from "./utils";

export function handleStaked(event: Staked): void {
  let vestContract = Vesting02.bind(event.address);
  let vestStruct = vestContract.getVest(event.params.vestID);

  let vest = new Vest(event.params.vestID.toString());
  vest.pool = vestStruct.pool.toHex();
  vest.deposit =
    vestStruct.pool.toHex() + DELIMITER + vestStruct.depositID.toString();
  // vest.owner = event.params.to.toHex();
  vest.owner = ZERO_ADDR.toHex();
  vest.nftID = event.params.vestID;
  vest.lastUpdateTimestamp = ZERO_INT;
  vest.accumulatedAmount = ZERO_DEC;
  vest.withdrawnAmount = ZERO_DEC;
  vest.vestAmountPerStablecoinPerSecond = ZERO_DEC;
  vest.totalExpectedMPHAmount = ZERO_DEC;
  vest.save();

  let deposit = Deposit.load(
    vestStruct.pool.toHex() + DELIMITER + vestStruct.depositID.toString()
  );
  if (deposit !== null) {
    deposit.vest = vest.id;
    deposit.save();
  }
}

export function handleRewardPaid(event: RewardPaid): void {
  let vest = Vest.load(event.params.vestID.toString());
  if (vest !== null) {
    let amount = normalize(event.params.reward);
    vest.withdrawnAmount = vest.withdrawnAmount.plus(amount);
    vest.save();
  }
}

export function handleTransfer(event: Transfer): void {
  let vest = Vest.load(event.params.tokenId.toString());
  if (vest !== null) {
    vest.owner = event.params.to.toHex();
    vest.save();
  }
}
