import { DividendsDistributed as DividendsDistributedEvent, FundingMultitoken } from "../generated/templates/FundingMultitoken/FundingMultitoken";
import { DPool, Funding } from "../generated/schema";
import { dataSource } from "@graphprotocol/graph-ts";
import { DELIMITER, MPH_ADDR, normalize } from "./utils";

export function handleDividendsDistributed(
  event: DividendsDistributedEvent
): void {
  let context = dataSource.context();
  let pool = DPool.load(context.getString("pool")) as DPool;

  // update Funding
  let fundingID = event.params.tokenID;
  let funding = Funding.load(pool.id + DELIMITER + fundingID.toString());
  if (funding != null && event.params.dividendToken.equals(MPH_ADDR)) {
    funding.totalMPHEarned = funding.totalMPHEarned.plus(normalize(event.params.weiAmount));
    funding.save()
  }
}
