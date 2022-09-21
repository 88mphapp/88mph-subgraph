import { veMPH, Deposit, Withdraw, Supply } from "../../generated/veMPH/veMPH";
import { VotingLock } from "../../generated/schema";

import { ZERO_BD, ZERO_INT } from '../utils/constants';
import { getUser, getVEMPH, getVotingLock } from '../utils/entities';
import { normalize} from '../utils/math';

export function handleDeposit(event: Deposit): void {
  let user = getUser(event.params.provider);
  let votingLock = getVotingLock(event.params.provider);
  let depositAmount = normalize(event.params.value);

  if (user !== null) {
    votingLock.user = user.id;
  }
  votingLock.lockedBPT = votingLock.lockedBPT.plus(depositAmount);
  votingLock.unlockTimestamp = event.params.locktime;
  votingLock.save();
}

export function handleWithdraw(event: Withdraw): void {
  let votingLock = getVotingLock(event.params.provider);
  votingLock.lockedBPT = ZERO_BD;
  votingLock.unlockTimestamp = ZERO_INT;
  votingLock.save();
}

export function handleSupply(event: Supply): void {
  let vemph = getVEMPH();
  vemph.lockedBPT = normalize(event.params.supply);
  vemph.save();
}
