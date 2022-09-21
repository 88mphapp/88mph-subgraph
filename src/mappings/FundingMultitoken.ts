import { dataSource } from "@graphprotocol/graph-ts";
import { DividendsDistributed } from "../../generated/templates/FundingMultitoken/FundingMultitoken";
import { Funding } from "../../generated/schema";

import { DELIMITER, MPH_ADDR } from "../utils/constants";
import { getPool } from '../utils/entities';
import { normalize } from '../utils/math';

export function handleDividendsDistributed(event: DividendsDistributed): void {
  let context = dataSource.context();
  let pool = getPool(context.getString("pool"));

  // update Funding
  let funding = Funding.load(pool.id + DELIMITER + event.params.tokenID.toString());
  if (funding !== null && event.params.dividendToken.equals(MPH_ADDR)) {
    funding.totalMPHEarned = funding.totalMPHEarned.plus(normalize(event.params.weiAmount));
    funding.save();
  }
}
