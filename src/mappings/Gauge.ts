import { VoteForGauge, NewGauge } from "../../generated/GaugeController/GaugeController";
import { RewardDistributed } from "../../generated/GaugeRewardDistributor/GaugeRewardDistributor";
import { Gauge } from "../../generated/schema";

import { ZERO_BD } from '../utils/constants';
import { getUser, getGauge, getGaugeVote } from '../utils/entities';
import { normalize } from '../utils/math';

export function handleVoteForGauge(event: VoteForGauge): void {
  let user = getUser(event.params.user);
  let vote = getGaugeVote(event.params.user, event.params.gauge_addr);
  if (user !== null) {
    vote.user = user.id;
  }
  vote.weight = event.params.weight;
  vote.timestamp = event.params.time;
  vote.save();
}

export function handleNewGauge(event: NewGauge): void {
  let gauge = getGauge(event.params.addr);
  gauge.type = event.params.gauge_type;
  gauge.save();
}

export function handleRewardDistributed(event: RewardDistributed): void {
  let gauge = getGauge(event.params.gauge_address);
  let amount = normalize(event.params.reward_amount);
  gauge.totalRewardDistributed = gauge.totalRewardDistributed.plus(amount);
  gauge.save();
}
