import { Address, BigInt, DataSourceContext } from "@graphprotocol/graph-ts";
import { ERC20 } from "../../generated/cDAIPool/ERC20";
import { DInterest } from "../../generated/cDAIPool/DInterest";
import { Vesting03 } from "../../generated/Vesting03/Vesting03";
import { Protocol, User, DPool, Deposit, Vest, MPH, xMPH, veMPH, VotingLock, Gauge, GaugeVote, FunderDetails } from "../../generated/schema";
import { ERC721, FundingMultitoken } from "../../generated/templates";

import { ZERO_BD, ZERO_INT, PROTOCOL_ID, MPH_ID, XMPH_ID, VEMPH_ID, DELIMITER, ZERO_ADDR, VEMPH_ADDR } from "./constants";
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

    // init FundingMultitoken
    let fundingMultitokenContext = new DataSourceContext();
    fundingMultitokenContext.setString("pool", poolAddress);
    FundingMultitoken.createWithContext(poolContract.fundingMultitoken(), fundingMultitokenContext);
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
    user.mphBalance = ZERO_BD;
    user.xmphBalance = ZERO_BD;

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

export function getVest(address: Address, vestID: BigInt): Vest {
  let vest = Vest.load(vestID.toString());

  if (vest === null) {
    let vestContract = Vesting03.bind(address);
    let vestStruct = vestContract.getVest(vestID);

    vest = new Vest(vestID.toString());
    vest.nftID = vestID;
    vest.owner = ZERO_ADDR.toHex();
    vest.pool = vestStruct.pool.toHex();
    vest.deposit = vestStruct.pool.toHex() + DELIMITER + vestStruct.depositID.toString();
    vest.lastUpdateTimestamp = ZERO_INT;
    vest.vestAmountPerStablecoinPerSecond = ZERO_BD;
    vest.totalExpectedMPHAmount = ZERO_BD;
    vest.accumulatedAmount = ZERO_BD;
    vest.withdrawnAmount = ZERO_BD;
    vest.save();
  }

  return vest as Vest;
}

export function getMPH(): MPH {
  let mph = MPH.load(MPH_ID);

  if (mph === null) {
    mph = new MPH(MPH_ID);
    mph.totalSupply = ZERO_BD;
    mph.totalRewardDistributed = ZERO_BD;
    mph.totalRewardDistributedUSD = ZERO_BD;
    mph.save();
  }

  return mph as MPH;
}

export function getXMPH(): xMPH {
  let xmph = xMPH.load(XMPH_ID);

  if (xmph === null) {
    xmph = new xMPH(XMPH_ID);
    xmph.totalSupply = ZERO_BD;
    xmph.pricePerFullShare = ZERO_BD;
    xmph.totalRewardDistributed = ZERO_BD;
    xmph.totalRewardDistributedUSD = ZERO_BD;
    xmph.currentUnlockEndTimestamp = ZERO_INT;
    xmph.lastRewardTimestamp = ZERO_INT;
    xmph.lastRewardAmount = ZERO_BD;
    xmph.save();
  }

  return xmph as xMPH;
}

export function getVEMPH(): veMPH {
  let vemph = veMPH.load(VEMPH_ID);

  if (vemph === null) {
    vemph = new veMPH(VEMPH_ID);
    vemph.lockedBPT = ZERO_BD;
    vemph.save();
  }

  return vemph as veMPH;
}

export function getVotingLock(address: Address): VotingLock {
  let votingLock = VotingLock.load(address.toHex());

  if (votingLock === null) {
    votingLock = new VotingLock(address.toHex());
    votingLock.user = ZERO_ADDR.toHex();
    votingLock.escrow = VEMPH_ADDR.toHex();
    votingLock.lockedBPT = ZERO_BD;
    votingLock.unlockTimestamp = ZERO_INT;
    votingLock.save();
  }

  return votingLock as VotingLock;
}

export function getGauge(address: Address): Gauge {
  let gauge = Gauge.load(address.toHex());

  if (gauge === null) {
    gauge = new Gauge(address.toHex());
    gauge.type = ZERO_INT;
    gauge.address = address.toHex();
    gauge.totalRewardDistributed = ZERO_BD;
    gauge.save();
  }

  return gauge as Gauge;
}

export function getGaugeVote(userAddress: Address, gaugeAddress: Address): GaugeVote {
  let vote = GaugeVote.load(userAddress.toHex() + DELIMITER + gaugeAddress.toHex());

  if (vote === null) {
    vote = new GaugeVote(userAddress.toHex() + DELIMITER + gaugeAddress.toHex());
    vote.user = ZERO_ADDR.toHex();
    vote.gauge = gaugeAddress.toHex();
    vote.weight = ZERO_INT;
    vote.timestamp = ZERO_INT;
    vote.save();
  }

  return vote as GaugeVote;
}
