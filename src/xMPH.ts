import { DistributeReward as DistributeRewardEvent } from "../generated/xMPH/xMPH";
import { getGlobalStats, normalize } from "./utils";

export function handleDistributeReward(event: DistributeRewardEvent): void {
  let globalStats = getGlobalStats();
  globalStats.xMPHRewardDistributed = globalStats.xMPHRewardDistributed.plus(
    normalize(event.params.rewardAmount)
  );
  globalStats.save();
}
