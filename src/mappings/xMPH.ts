import { Address, ethereum } from "@graphprotocol/graph-ts";

import { xMPH, Transfer, DistributeReward } from "../../generated/xMPH/xMPH";
import { YearnPriceOracle } from '../../generated/xMPH/YearnPriceOracle';

import { BLOCK_HANDLER_INTERVAL, ZERO_ADDR, MPH_ADDR, YEARN_PRICE_ORACLE } from "../utils/constants";
import { getUser, getXMPH } from '../utils/entities';
import { normalize } from '../utils/math';

export function handleTransfer(event: Transfer): void {
  let to = getUser(event.params.to);
  let from = getUser(event.params.from);
  let value = normalize(event.params.value);
  let xmph = getXMPH();

  // xMPH minted, increment total supply
  if (event.params.from.equals(ZERO_ADDR)) {
    xmph.totalSupply = xmph.totalSupply.plus(value);
  }

  // xMPH burned, decrement total supply
  if (event.params.to.equals(ZERO_ADDR)) {
    xmph.totalSupply = xmph.totalSupply.minus(value);
  }

  // update balance of FROM address
  if (from !== null) {
    from.xmphBalance = from.xmphBalance.minus(value);
    from.save();
  }

  // update balance of TO address
  if (to !== null) {
    to.xmphBalance = to.xmphBalance.plus(value);
    to.save();
  }

  xmph.save();
}

export function handleDistributeReward(event: DistributeReward): void {
  let xmph = getXMPH();
  let xmphContract = xMPH.bind(Address.fromString(xmph.id));
  let priceOracleContract = YearnPriceOracle.bind(YEARN_PRICE_ORACLE);

  // update last reward timestamp
  xmph.lastRewardTimestamp = event.block.timestamp;

  // update total reward distributed
  let reward = normalize(event.params.rewardAmount);
  xmph.totalRewardDistributed = xmph.totalRewardDistributed.plus(reward);

  // update total reward distributed in USD
  let mphPriceUSD = priceOracleContract.try_getPriceUsdcRecommended(MPH_ADDR);
  if (!mphPriceUSD.reverted) {
    let rewardUSD = reward.times(normalize(mphPriceUSD.value, 6));
    xmph.totalRewardDistributedUSD = xmph.totalRewardDistributedUSD.plus(rewardUSD);
  }

  // update current unlock end timestamp
  let currentUnlockEndTimestamp = xmphContract.try_currentUnlockEndTimestamp();
  if (!currentUnlockEndTimestamp.reverted) {
    xmph.currentUnlockEndTimestamp = currentUnlockEndTimestamp.value;
  }

  // update last reward amount
  let lastRewardAmount = xmphContract.try_lastRewardAmount();
  if (!lastRewardAmount.reverted) {
    xmph.lastRewardAmount = normalize(lastRewardAmount.value);
  }

  xmph.save();
}

export function handleBlock(block: ethereum.Block): void {
  if (block.number.mod(BLOCK_HANDLER_INTERVAL).isZero()) {
    let xmph = getXMPH();
    let xmphContract = xMPH.bind(Address.fromString(xmph.id));

    // update pricePerFullShare
    let pricePerFullShare = xmphContract.try_getPricePerFullShare();
    if (!pricePerFullShare.reverted) {
      xmph.pricePerFullShare = normalize(pricePerFullShare.value);
    }

    xmph.save();
  }
}
