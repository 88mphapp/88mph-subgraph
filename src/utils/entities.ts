import { Address, BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/aDAIPool/ERC20";
import { DInterest } from "../../generated/aDAIPool/DInterest";
import { Protocol, User, DPool, Deposit, Vest, FunderDetails } from "../../generated/schema";
import { ERC721 } from "../../generated/templates";

import { ZERO_BD, ZERO_INT, PROTOCOL_ID, DELIMITER, ZERO_ADDR } from "./constants";
import { normalize } from "./math";

export function getProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID);
  if (protocol === null) {
    protocol = new Protocol(PROTOCOL_ID);
    protocol.totalDepositUSD = ZERO_BD;
    protocol.totalSurplusUSD = ZERO_BD;
    protocol.totalInterestOwedUSD = ZERO_BD;
    protocol.historicalInterestPaidUSD = ZERO_BD;
    protocol.totalFeeOwedUSD = ZERO_BD;
    protocol.historicalFeePaidUSD = ZERO_BD;
    protocol.totalFundedAmountUSD = ZERO_BD;
    protocol.save();
  }
  return protocol as Protocol;
}

export function getPool(poolAddress: string): DPool {
  let pool = DPool.load(poolAddress);

  if (pool === null) {
    pool = new DPool(poolAddress);
    let poolContract = DInterest.bind(Address.fromString(poolAddress));
    let stablecoin = poolContract.stablecoin();
    let stablecoinContract = ERC20.bind(stablecoin);

    pool.address = poolAddress;
    pool.moneyMarket = poolContract.moneyMarket().toHex();
    pool.feeModel = poolContract.feeModel().toHex();
    pool.interestModel = poolContract.interestModel().toHex();
    pool.interestOracle = poolContract.interestOracle().toHex();
    pool.fundingMultitoken = poolContract.fundingMultitoken().toHex();
    pool.stablecoin = stablecoin.toHex();
    pool.stablecoinDecimals = BigInt.fromI32(stablecoinContract.decimals());
    pool.stablecoinPriceUSD = ZERO_BD;
    pool.MaxDepositPeriod = poolContract.MaxDepositPeriod();
    pool.MinDepositAmount = normalize(poolContract.MinDepositAmount(), pool.stablecoinDecimals.toI32());
    pool.GlobalDepositCap = normalize(poolContract.GlobalDepositCap(), pool.stablecoinDecimals.toI32());
    pool.numUsers = ZERO_INT;
    pool.numDeposits = ZERO_INT;
    pool.numFunders = ZERO_INT;
    pool.numFundings = ZERO_INT;
    pool.totalDeposit = ZERO_BD;
    pool.totalDepositUSD = ZERO_BD;
    pool.totalInterestOwed = ZERO_BD;
    pool.totalInterestOwedUSD = ZERO_BD;
    pool.totalFeeOwed = ZERO_BD;
    pool.totalFeeOwedUSD = ZERO_BD;
    pool.surplus = ZERO_BD;
    pool.surplusUSD = ZERO_BD;
    pool.moneyMarketIncomeIndex = ZERO_INT;
    pool.oneYearInterestRate = ZERO_BD;
    pool.oracleInterestRate = ZERO_BD;
    pool.historicalInterestPaid = ZERO_BD;
    pool.historicalInterestPaidUSD = ZERO_BD;
    pool.historicalFeePaid = ZERO_BD;
    pool.historicalFeePaidUSD = ZERO_BD;
    pool.poolDepositorRewardMintMultiplier = ZERO_BD;
    pool.poolFunderRewardMultiplier = ZERO_BD;
    pool.totalFundedAmount = ZERO_BD;
    pool.totalFundedAmountUSD = ZERO_BD;
    pool.save();

    // init deposit NFT
    let depositNFTContext = new DataSourceContext();
    depositNFTContext.setString("pool", poolAddress);
    ERC721.createWithContext(poolContract.depositNFT(), depositNFTContext);
  }

  return pool as DPool;
}

export function getUser(address: Address): User | null {
  if (address.equals(ZERO_ADDR)) {
    return null;
  }

  let user = User.load(address.toHex());

  if (user === null) {
    user = new User(address.toHex());
    user.address = address.toHex();

    user.numDeposits = ZERO_INT;
    user.depositPools = new Array<string>(0);
    user.numDepositPools = ZERO_INT;

    user.fundings = new Array<string>(0);
    user.numFundings = ZERO_INT;
    user.fundingPools = new Array<string>(0);
    user.numFundingPools = ZERO_INT;

    user.save();
  }

  return user as User;
}

export function getFunderDetails(funder: Address, pool: Address, fundingID: BigInt): FunderDetails {
  let funderDetails = FunderDetails.load(funder.toHex() + DELIMITER + pool.toHex() + DELIMITER + fundingID.toString());

  if (funderDetails === null) {
    funderDetails = new FunderDetails(funder.toHex() + DELIMITER + pool.toHex() + DELIMITER + fundingID.toString());
    funderDetails.funder = funder.toHex();
    funderDetails.balance = ZERO_BD;
    funderDetails.fundAmount = ZERO_BD;
    funderDetails.refundEarned = ZERO_BD;
    funderDetails.interestEarned = ZERO_BD;
    funderDetails.save();
  }

  return funderDetails as FunderDetails;
}
