import { dataSource } from "@graphprotocol/graph-ts";
import { Transfer as ETransfer } from "../generated/templates/NFT/NFT";
import { Deposit, DPool, UserTotalDeposit } from "../generated/schema";
import {
  DELIMITER,
  getPool,
  getUser,
  ONE_DEC,
  ONE_INT,
  ZERO_ADDR,
  ZERO_DEC
} from "./utils";

export function handleTransfer(event: ETransfer): void {
  if (
    event.params.from.equals(ZERO_ADDR) ||
    event.params.to.equals(ZERO_ADDR)
  ) {
    // mint or burn, ignore
    return;
  }

  let tokenId = event.params.tokenId;
  let from = event.params.from;
  let to = event.params.to;
  let context = dataSource.context();
  let pool = getPool(context.getString("pool"));

  let fromUser = getUser(from, pool);
  let toUser = getUser(to, pool);
  let deposit = Deposit.load(pool.address + DELIMITER + tokenId.toString());
  let depositAmount = deposit.virtualTokenTotalSupply.div(
    deposit.interestRate.plus(ONE_DEC)
  );
  let interestAmount = deposit.virtualTokenTotalSupply.minus(depositAmount);
  let feeAmount = interestAmount.times(deposit.feeRate);

  // update from user
  fromUser.numDeposits = fromUser.numDeposits.minus(ONE_INT);
  fromUser.save();

  // update from user total deposits
  let fromUserTotalDepositID = fromUser.id + DELIMITER + pool.id;
  let fromUserTotalDepositEntity = UserTotalDeposit.load(
    fromUserTotalDepositID
  );
  fromUserTotalDepositEntity.totalDeposit = fromUserTotalDepositEntity.totalDeposit.plus(
    depositAmount
  );
  fromUserTotalDepositEntity.totalInterestOwed = fromUserTotalDepositEntity.totalInterestOwed.plus(
    interestAmount
  );
  fromUserTotalDepositEntity.totalFeeOwed = fromUserTotalDepositEntity.totalFeeOwed.plus(
    feeAmount
  );
  fromUserTotalDepositEntity.save();

  // update to user
  toUser.numDeposits = toUser.numDeposits.plus(ONE_INT);
  if (!toUser.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = toUser.pools;
    pools.push(pool.id);
    toUser.pools = pools;
    toUser.numPools = toUser.numPools.plus(ONE_INT);
    pool.numUsers = pool.numUsers.plus(ONE_INT);
  }
  toUser.save();

  let toUserTotalDepositID = toUser.id + DELIMITER + pool.id;
  let toUserTotalDepositEntity = UserTotalDeposit.load(toUserTotalDepositID);
  if (toUserTotalDepositEntity == null) {
    // Initialize UserTotalDeposits entity
    toUserTotalDepositEntity = new UserTotalDeposit(toUserTotalDepositID);
    toUserTotalDepositEntity.user = toUser.id;
    toUserTotalDepositEntity.pool = pool.id;
    toUserTotalDepositEntity.totalDeposit = ZERO_DEC;
    toUserTotalDepositEntity.totalInterestOwed = ZERO_DEC;
    toUserTotalDepositEntity.totalFeeOwed = ZERO_DEC;
  }
  toUserTotalDepositEntity.totalDeposit = toUserTotalDepositEntity.totalDeposit.plus(
    depositAmount
  );
  toUserTotalDepositEntity.totalInterestOwed = toUserTotalDepositEntity.totalInterestOwed.plus(
    interestAmount
  );
  toUserTotalDepositEntity.totalFeeOwed = toUserTotalDepositEntity.totalFeeOwed.plus(
    feeAmount
  );
  toUserTotalDepositEntity.save();

  // update deposit
  deposit.user = toUser.id;
  deposit.save();

  pool.save();
}
