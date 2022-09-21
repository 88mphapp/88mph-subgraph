import { dataSource } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/templates/ERC721/ERC721";
import { Deposit } from "../../generated/schema";

import { DELIMITER, ONE_INT, ZERO_ADDR } from "../utils/constants";
import { getPool, getUser } from '../utils/entities';

export function handleTransfer(event: Transfer): void {
  if (event.params.from.equals(ZERO_ADDR) || event.params.to.equals(ZERO_ADDR)) {
    // mint of burn, ignore
    return;
  }

  let to = event.params.to;
  let from = event.params.from;
  let tokenId = event.params.tokenId;
  let context = dataSource.context();

  let pool = getPool(context.getString("pool"));
  let toUser = getUser(event.params.to);
  let fromUser = getUser(event.params.from);
  let deposit = Deposit.load(pool.address + DELIMITER + tokenId.toString());

  // update from user
  // @dev if this is fromUser's only deposit in this pool, we must update fromUser.pools, fromUser.numPools and pool.numUsers
  if (fromUser !== null) {
    fromUser.numDeposits = fromUser.numDeposits.minus(ONE_INT);
    fromUser.save();
  }

  // update to user
  if (toUser !== null) {
    toUser.numDeposits = toUser.numDeposits.plus(ONE_INT);
    if (!toUser.depositPools.includes(pool.id)) {
      let depositPools = toUser.depositPools;
      depositPools.push(pool.id);
      toUser.depositPools = depositPools;
      toUser.numDepositPools = toUser.numDepositPools.plus(ONE_INT);

      pool.numUsers = pool.numUsers.plus(ONE_INT);
      pool.save();
    }
    toUser.save();

    // update deposit
    if (deposit !== null) {
      deposit.user = toUser.id;
      deposit.save();
    }
  }


}
