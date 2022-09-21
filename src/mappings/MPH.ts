import { Transfer } from "../../generated/MPH/MPH";
import { RewardAdded } from "../../generated/Rewards/Rewards";
import { ESetParamUint } from "../../generated/MPHMinter/MPHMinter";
import { YearnPriceOracle } from '../../generated/MPH/YearnPriceOracle';
import { DPool } from "../../generated/schema";

import { BLOCK_HANDLER_INTERVAL, ZERO_ADDR, DAI_ADDR, MPH_ADDR, YEARN_PRICE_ORACLE } from "../utils/constants";
import { getUser, getMPH } from '../utils/entities';
import { keccak256 } from '../utils/crypto';
import { normalize } from '../utils/math';

export function handleTransfer(event: Transfer): void {
  let to = getUser(event.params.to);
  let from = getUser(event.params.from);
  let value = normalize(event.params.value);
  let mph = getMPH();

  // MPH minted, increment total supply
  if (event.params.from.equals(ZERO_ADDR)) {
    mph.totalSupply = mph.totalSupply.plus(value);
  }

  // MPH burned, decrement total supply
  if (event.params.to.equals(ZERO_ADDR)) {
    mph.totalSupply = mph.totalSupply.minus(value);
  }

  // update balance of FROM address
  if (from !== null) {
    from.mphBalance = from.mphBalance.minus(value);
    from.save();
  }

  // update balance of TO address
  if (to !== null) {
    to.mphBalance = to.mphBalance.plus(value);
    to.save();
  }

  mph.save();
}

export function handleRewardAdded(event: RewardAdded): void {
  let mph = getMPH();
  let value = normalize(event.params.reward);
  let priceOracleContract = YearnPriceOracle.bind(YEARN_PRICE_ORACLE);

  mph.totalRewardDistributed = mph.totalRewardDistributed.plus(value);

  let daiPriceUSD = priceOracleContract.try_getPriceUsdcRecommended(DAI_ADDR);
  if (!daiPriceUSD.reverted) {
    let valueUSD = value.times(normalize(daiPriceUSD.value, 6));
    mph.totalRewardDistributedUSD = mph.totalRewardDistributedUSD.plus(valueUSD);
  } else {
    mph.totalRewardDistributedUSD = mph.totalRewardDistributedUSD.plus(value);
  }

  mph.save();
}

export function handleESetParamUint(event: ESetParamUint): void {
  let pool = DPool.load(event.params.pool.toHex());

  if (pool !== null) {
    let paramName = event.params.paramName;

    if (paramName === keccak256("poolDepositorRewardMintMultiplier")) {
      pool.poolDepositorRewardMintMultiplier = normalize(event.params.newValue, 36 - pool.stablecoinDecimals.toI32());
    } else if (paramName === keccak256("poolFunderRewardMultiplier")) {
      pool.poolFunderRewardMultiplier = normalize(event.params.newValue, 36 - pool.stablecoinDecimals.toI32());
    }

    pool.save();
  }
}
