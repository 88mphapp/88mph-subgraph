import { BigDecimal, BigInt, Address, crypto, ethereum, dataSource } from "@graphprotocol/graph-ts";
import { EDeposit, ETopupDeposit, EWithdraw, EFund, EPayFundingInterest, ESetParamAddress, ESetParamUint } from "../../generated/aDAIPool/DInterest";
import { DInterest } from '../../generated/aDAIPool/DInterest';
import { MoneyMarket } from '../../generated/aDAIPool/MoneyMarket';
import { ChainlinkPriceOracle } from '../../generated/aDAIPool/ChainlinkPriceOracle';
import { IInterestOracle } from "../../generated/aDAIPool/IInterestOracle";
import { FundingMultitoken } from "../../generated/aDAIPool/FundingMultitoken";
import { Deposit, Funding, FunderDetails } from "../../generated/schema";

import { YEAR, CHAINLINK_PRICE_ORACLE, BLOCK_HANDLER_INTERVAL, DELIMITER, ULTRA_PRECISION } from "../utils/constants";
import { ZERO_BD, ONE_BD, NEGONE_BD, ZERO_INT, ONE_INT } from "../utils/constants";
import { getProtocol, getPool, getUser, getFunderDetails } from '../utils/entities';
import { tenPow, normalize } from '../utils/math';
import { keccak256 } from '../utils/crypto';

export function handleEDeposit(event: EDeposit): void {
  // load entities
  let protocol = getProtocol();
  let pool = getPool(event.address.toHex());
  let user = getUser(event.params.sender);

  // load contracts
  let poolContract = DInterest.bind(event.address);

  // load storage
  let oldDepositUSD = pool.totalDepositUSD;
  let oldInterestOwedUSD = pool.totalInterestOwedUSD;
  let oldFeeOwedUSD = pool.totalFeeOwedUSD;

  // calcuate amounts
  let depositAmount = normalize(event.params.depositAmount, pool.stablecoinDecimals.toI32());
  let interestAmount = normalize(event.params.interestAmount, pool.stablecoinDecimals.toI32());
  let feeAmount = normalize(event.params.feeAmount, pool.stablecoinDecimals.toI32());

  // update stablecoin price in USD
  if (CHAINLINK_PRICE_ORACLE.has(pool.stablecoin)) {
    let oracleAddress = CHAINLINK_PRICE_ORACLE.get(pool.stablecoin);
    let priceOracle = ChainlinkPriceOracle.bind(Address.fromString(oracleAddress));

    let stablecoinPriceUSD = priceOracle.try_latestAnswer();
    if (!stablecoinPriceUSD.reverted) {
      pool.stablecoinPriceUSD = normalize(stablecoinPriceUSD.value, 8);
    }
  }

  // update Deposit
  let deposit = new Deposit(event.address.toHex() + DELIMITER + event.params.depositID.toString());
  let depositStruct = poolContract.getDeposit(event.params.depositID);
  deposit.nftID = event.params.depositID;
  if (user !== null) {
    deposit.user = user.id;
  }
  deposit.pool = pool.id;
  deposit.interestRate = normalize(depositStruct.interestRate);
  deposit.feeRate = normalize(depositStruct.feeRate);
  deposit.virtualTokenTotalSupply = normalize(depositStruct.virtualTokenTotalSupply, pool.stablecoinDecimals.toI32());
  deposit.interestOwed = interestAmount;
  deposit.feeOwed = feeAmount;
  deposit.amount = depositAmount;
  deposit.maturationTimestamp = event.params.maturationTimestamp;
  deposit.depositTimestamp = event.block.timestamp;
  deposit.depositLength = deposit.maturationTimestamp.minus(deposit.depositTimestamp);
  deposit.averageRecordedIncomeIndex = depositStruct.averageRecordedIncomeIndex;
  deposit.fundingInterestPaid = ZERO_BD;
  deposit.fundingRefundPaid = ZERO_BD;
  deposit.fundedAmount = ZERO_BD;
  deposit.save();

  if (user !== null) {
    if (!user.depositPools.includes(pool.id)) {
      let depositPools = user.depositPools;
      depositPools.push(pool.id);
      user.depositPools = depositPools;
      user.numDepositPools = user.numDepositPools.plus(ONE_INT);
      pool.numUsers = pool.numUsers.plus(ONE_INT);
    }
    user.numDeposits = user.numDeposits.plus(ONE_INT);
    user.save();
  }

  // update DPool
  pool.numDeposits = pool.numDeposits.plus(ONE_INT);
  pool.totalDeposit = pool.totalDeposit.plus(depositAmount);
  pool.totalDepositUSD = pool.totalDeposit.times(pool.stablecoinPriceUSD);
  pool.totalInterestOwed = pool.totalInterestOwed.plus(interestAmount);
  pool.totalInterestOwedUSD = pool.totalInterestOwed.times(pool.stablecoinPriceUSD);
  pool.totalFeeOwed = pool.totalFeeOwed.plus(feeAmount);
  pool.totalFeeOwedUSD = pool.totalFeeOwed.times(pool.stablecoinPriceUSD);
  pool.save();

  // update Protocol
  protocol.totalDepositUSD = protocol.totalDepositUSD.minus(oldDepositUSD).plus(pool.totalDepositUSD);
  protocol.totalInterestOwedUSD = protocol.totalInterestOwedUSD.minus(oldInterestOwedUSD).plus(pool.totalInterestOwedUSD);
  protocol.totalFeeOwedUSD = protocol.totalFeeOwedUSD.minus(oldFeeOwedUSD).plus(pool.totalFeeOwedUSD);
  protocol.save();
}

export function handleETopupDeposit(event: ETopupDeposit): void {
  // load entities
  let pool = getPool(event.address.toHex());
  let protocol = getProtocol();

  // load contracts
  let poolContract = DInterest.bind(event.address);

  // load storage
  let oldDepositUSD = pool.totalDepositUSD;
  let oldInterestOwedUSD = pool.totalInterestOwedUSD;
  let oldFeeOwedUSD = pool.totalFeeOwedUSD;

  // calcuate amounts
  let depositAmount = normalize(event.params.depositAmount, pool.stablecoinDecimals.toI32());
  let interestAmount = normalize(event.params.interestAmount, pool.stablecoinDecimals.toI32());
  let feeAmount = normalize(event.params.feeAmount, pool.stablecoinDecimals.toI32());

  // update stablecoin price in USD
  if (CHAINLINK_PRICE_ORACLE.has(pool.stablecoin)) {
    let oracleAddress = CHAINLINK_PRICE_ORACLE.get(pool.stablecoin);
    let priceOracle = ChainlinkPriceOracle.bind(Address.fromString(oracleAddress));

    let stablecoinPriceUSD = priceOracle.try_latestAnswer();
    if (!stablecoinPriceUSD.reverted) {
      pool.stablecoinPriceUSD = normalize(stablecoinPriceUSD.value, 8);
    }
  }

  // update Deposit
  let deposit = Deposit.load(event.address.toHex() + DELIMITER + event.params.depositID.toString());
  if (deposit !== null) {
    let depositStruct = poolContract.getDeposit(event.params.depositID);
    deposit.interestRate = normalize(depositStruct.interestRate);
    deposit.feeRate = normalize(depositStruct.feeRate);
    deposit.virtualTokenTotalSupply = normalize(depositStruct.virtualTokenTotalSupply, pool.stablecoinDecimals.toI32());
    deposit.interestOwed = deposit.interestOwed.plus(interestAmount);
    deposit.feeOwed = deposit.feeOwed.plus(feeAmount);
    deposit.amount = deposit.amount.plus(depositAmount);
    deposit.averageRecordedIncomeIndex = depositStruct.averageRecordedIncomeIndex;
    deposit.save();
  }

  // update DPool
  pool.totalDeposit = pool.totalDeposit.plus(depositAmount);
  pool.totalDepositUSD = pool.totalDeposit.times(pool.stablecoinPriceUSD);
  pool.totalInterestOwed = pool.totalInterestOwed.plus(interestAmount);
  pool.totalInterestOwedUSD = pool.totalInterestOwed.times(pool.stablecoinPriceUSD);
  pool.totalFeeOwed = pool.totalFeeOwed.plus(feeAmount);
  pool.totalFeeOwedUSD = pool.totalFeeOwed.times(pool.stablecoinPriceUSD);
  pool.save();

  // update Protocol
  protocol.totalDepositUSD = protocol.totalDepositUSD.minus(oldDepositUSD).plus(pool.totalDepositUSD);
  protocol.totalInterestOwedUSD = protocol.totalInterestOwedUSD.minus(oldInterestOwedUSD).plus(pool.totalInterestOwedUSD);
  protocol.totalFeeOwedUSD = protocol.totalFeeOwedUSD.minus(oldFeeOwedUSD).plus(pool.totalFeeOwedUSD);
  protocol.save();
}

export function handleEWithdraw(event: EWithdraw): void {
  // load entities
  let protocol = getProtocol();
  let pool = getPool(event.address.toHex());
  let user = getUser(event.params.sender);

  // load contracts
  let poolContract = DInterest.bind(event.address);

  // load storage
  let oldDepositUSD = pool.totalDepositUSD;
  let oldInterestOwedUSD = pool.totalInterestOwedUSD;
  let oldInterestPaidUSD = pool.historicalInterestPaidUSD;
  let oldFeeOwedUSD = pool.totalFeeOwedUSD;
  let oldFeePaidUSD = pool.historicalFeePaidUSD;
  let oldFundedAmountUSD = pool.totalFundedAmountUSD;

  // update stablecoin price in USD
  if (CHAINLINK_PRICE_ORACLE.has(pool.stablecoin)) {
    let oracleAddress = CHAINLINK_PRICE_ORACLE.get(pool.stablecoin);
    let priceOracle = ChainlinkPriceOracle.bind(Address.fromString(oracleAddress));

    let stablecoinPriceUSD = priceOracle.try_latestAnswer();
    if (!stablecoinPriceUSD.reverted) {
      pool.stablecoinPriceUSD = normalize(stablecoinPriceUSD.value, 8);
    }
  }

  // update Deposit
  let deposit = Deposit.load(event.address.toHex() + DELIMITER + event.params.depositID.toString());
  if (deposit !== null) {
    // load storage
    let oldDepositFundedAmount = deposit.fundedAmount;

    // calculate amounts
    let virtualAmount = normalize(event.params.virtualTokenAmount, pool.stablecoinDecimals.toI32());
    let depositAmount = virtualAmount.div(deposit.interestRate.plus(ONE_BD));
    let interestAmount = virtualAmount.minus(depositAmount);
    let feeAmount = depositAmount.times(deposit.feeRate);

    // update Funding
    let depositFunding = deposit.funding;
    if (depositFunding !== null) {
      let funding = Funding.load(depositFunding);
      if (funding !== null) {
        let oldPrincipalPerToken = funding.principalPerToken;
        let fundingStruct = poolContract.getFunding(funding.nftID);
        funding.principalPerToken = fundingStruct.principalPerToken.divDecimal(ULTRA_PRECISION);
        funding.recordedMoneyMarketIncomeIndex = fundingStruct.recordedMoneyMarketIncomeIndex;
        funding.fundedDeficitAmount = funding.fundedDeficitAmount.div(oldPrincipalPerToken).times(funding.principalPerToken);
        funding.active = funding.principalPerToken.gt(ZERO_BD);
        funding.save();

        // update FunderDetails
        for (let i = 0; i < funding.numFunders.toI32(); i++) {
          let funderDetails = FunderDetails.load(funding.funderDetails[i]);
          if (funderDetails !== null) {
            funderDetails.fundAmount = funderDetails.fundAmount.div(oldPrincipalPerToken).times(funding.principalPerToken);
            funderDetails.save();
          }
        }

        // update Deposit
        deposit.fundedAmount = deposit.fundedAmount.div(oldPrincipalPerToken).times(funding.principalPerToken);
        deposit.save()
      }
    }

    // update Deposit
    deposit.virtualTokenTotalSupply = deposit.virtualTokenTotalSupply.minus(virtualAmount);
    deposit.interestOwed = deposit.interestOwed.minus(interestAmount);
    deposit.feeOwed = deposit.feeOwed.minus(feeAmount);
    deposit.amount = deposit.amount.minus(depositAmount);
    deposit.save();

    // update DPool
    pool.totalDeposit = pool.totalDeposit.minus(depositAmount);
    pool.totalDepositUSD = pool.totalDeposit.times(pool.stablecoinPriceUSD);
    pool.totalInterestOwed = pool.totalInterestOwed.minus(interestAmount);
    pool.totalInterestOwedUSD = pool.totalInterestOwed.times(pool.stablecoinPriceUSD);
    pool.totalFeeOwed = pool.totalFeeOwed.minus(feeAmount);
    pool.totalFeeOwedUSD = pool.totalFeeOwed.times(pool.stablecoinPriceUSD);
    if (!event.params.early) {
      pool.historicalInterestPaid = pool.historicalInterestPaid.plus(interestAmount);
      pool.historicalInterestPaidUSD = pool.historicalInterestPaidUSD.plus(interestAmount.times(pool.stablecoinPriceUSD));
    }
    pool.historicalFeePaid = pool.historicalFeePaid.plus(feeAmount);
    pool.historicalFeePaidUSD = pool.historicalFeePaidUSD.plus(feeAmount.times(pool.stablecoinPriceUSD));
    pool.totalFundedAmount = pool.totalFundedAmount.minus(oldDepositFundedAmount).plus(deposit.fundedAmount);
    pool.totalFundedAmountUSD = pool.totalFundedAmount.times(pool.stablecoinPriceUSD);
    pool.save();

    // update Protocol
    protocol.totalDepositUSD = protocol.totalDepositUSD.minus(oldDepositUSD).plus(pool.totalDepositUSD);
    protocol.totalInterestOwedUSD = protocol.totalInterestOwedUSD.minus(oldInterestOwedUSD).plus(pool.totalInterestOwedUSD);
    if (!event.params.early) {
      protocol.historicalInterestPaidUSD = protocol.historicalInterestPaidUSD.minus(oldInterestPaidUSD).plus(pool.historicalInterestPaidUSD);
    }
    protocol.totalFeeOwedUSD = protocol.totalFeeOwedUSD.minus(oldFeeOwedUSD).plus(pool.totalFeeOwedUSD);
    protocol.historicalFeePaidUSD = protocol.historicalFeePaidUSD.minus(oldFeePaidUSD).plus(pool.historicalFeePaidUSD);
    protocol.totalFundedAmountUSD = protocol.totalFundedAmountUSD.minus(oldFundedAmountUSD).plus(pool.totalFundedAmountUSD);
    protocol.save();
  }
}

export function handleEFund(event: EFund): void {
  // load entities
  let protocol = getProtocol();
  let pool = getPool(event.address.toHex());
  let user = getUser(event.params.sender);
  let funding = Funding.load(pool.address + DELIMITER + event.params.fundingID.toString());
  let funderDetails = getFunderDetails(event.params.sender, event.address, event.params.fundingID);

  // load contracts
  let poolContract = DInterest.bind(event.address);
  let fundingMultitoken = FundingMultitoken.bind(Address.fromString(pool.fundingMultitoken));

  // load storage
  let oldFundedAmountUSD = pool.totalFundedAmountUSD;

  // update stablecoin price in USD
  if (CHAINLINK_PRICE_ORACLE.has(pool.stablecoin)) {
    let oracleAddress = CHAINLINK_PRICE_ORACLE.get(pool.stablecoin);
    let priceOracle = ChainlinkPriceOracle.bind(Address.fromString(oracleAddress));

    let stablecoinPriceUSD = priceOracle.try_latestAnswer();
    if (!stablecoinPriceUSD.reverted) {
      pool.stablecoinPriceUSD = normalize(stablecoinPriceUSD.value, 8);
    }
  }

  // calculate amounts
  let fundAmount = normalize(event.params.fundAmount, pool.stablecoinDecimals.toI32());

  let fundingStruct = poolContract.getFunding(event.params.fundingID);

  if (funding === null) {
    // Create new Funding entity
    funding = new Funding(pool.address + DELIMITER + event.params.fundingID.toString());
    funding.nftID = event.params.fundingID;
    funding.active = true;
    funding.pool = pool.id;
    funding.deposit = event.address.toHex() + DELIMITER + fundingStruct.depositID.toString();
    funding.recordedMoneyMarketIncomeIndex = ZERO_INT;
    funding.fundedDeficitAmount = ZERO_BD;
    funding.principalPerToken = ZERO_BD;
    funding.totalSupply = ZERO_BD;
    funding.totalMPHEarned = ZERO_BD;
    funding.totalRefundEarned = ZERO_BD;
    funding.totalInterestEarned = ZERO_BD;
    funding.numFunders = ZERO_INT;
    funding.funderDetails = new Array<string>(0);
    funding.save();

    // update Deposit
    let deposit = Deposit.load(funding.deposit);
    if (deposit !== null) {
      deposit.funding = funding.id;
      deposit.save();
    }

    // update DPool
    pool.numFundings = pool.numFundings.plus(ONE_INT);
    pool.save();
  }

  // update FunderDetails
  funderDetails.balance = funderDetails.balance.plus(normalize(event.params.tokenAmount, pool.stablecoinDecimals.toI32()));
  funderDetails.fundAmount = funderDetails.fundAmount.plus(normalize(event.params.fundAmount, pool.stablecoinDecimals.toI32()));
  funderDetails.save();

  // update Funding
  funding.recordedMoneyMarketIncomeIndex = fundingStruct.recordedMoneyMarketIncomeIndex;
  funding.fundedDeficitAmount = funding.fundedDeficitAmount.plus(fundAmount);
  funding.principalPerToken = fundingStruct.principalPerToken.divDecimal(ULTRA_PRECISION);
  funding.totalSupply = normalize(fundingMultitoken.totalSupply(event.params.fundingID), pool.stablecoinDecimals.toI32());
  if (!funding.funderDetails.includes(funderDetails.id)) {
    let details = funding.funderDetails;
    details.push(funderDetails.id);

    funding.numFunders = funding.numFunders.plus(ONE_INT);
    funding.funderDetails = details;
  }
  funding.save();

  // update User
  if (user !== null) {
    // update fundings
    if (!user.fundings.includes(funding.id)) {
      let fundings = user.fundings;
      fundings.push(funding.id);

      user.fundings = fundings;
      user.numFundings = user.numFundings.plus(ONE_INT);
      user.save();
    }
    // update funding pools
    if (!user.fundingPools.includes(pool.id)) {
      let fundingPools = user.fundingPools;
      fundingPools.push(pool.id);

      user.fundingPools = fundingPools;
      user.numFundingPools = user.numFundingPools.plus(ONE_INT);
      user.save();

      pool.numFunders = pool.numFunders.plus(ONE_INT);
      pool.save();
    }
  }

  // update Deposit
  let deposit = Deposit.load(funding.deposit);
  if (deposit !== null) {
    deposit.fundedAmount = deposit.fundedAmount.plus(fundAmount);
    deposit.save();
  }

  // update DPool
  pool.totalFundedAmount = pool.totalFundedAmount.plus(fundAmount);
  pool.totalFundedAmountUSD = pool.totalFundedAmount.times(pool.stablecoinPriceUSD);
  pool.save();

  // update Protocol
  protocol.totalFundedAmountUSD = protocol.totalFundedAmountUSD.minus(oldFundedAmountUSD).plus(pool.totalFundedAmountUSD);
  protocol.save();
}

export function handleEPayFundingInterest(event: EPayFundingInterest): void {
  // load entities
  let pool = getPool(event.address.toHex());
  let funding = Funding.load(pool.address + DELIMITER + event.params.fundingID.toString());

  // calculate amounts
  let interestAmount = normalize(event.params.interestAmount, pool.stablecoinDecimals.toI32());
  let refundAmount = normalize(event.params.refundAmount, pool.stablecoinDecimals.toI32());

  if (funding !== null) {
    // update Funding
    funding.totalRefundEarned = funding.totalRefundEarned.plus(refundAmount);
    funding.totalInterestEarned = funding.totalInterestEarned.plus(interestAmount);
    funding.save();

    // update FunderDetails
    for (let i = 0; i < funding.numFunders.toI32(); i++) {
      let funderDetails = FunderDetails.load(funding.funderDetails[i]);
      if (funderDetails !== null) {
        let funderShare = funderDetails.balance.div(funding.totalSupply);
        funderDetails.refundEarned = funderDetails.refundEarned.plus(refundAmount.times(funderShare));
        funderDetails.interestEarned = funderDetails.interestEarned.plus(interestAmount.times(funderShare));
        funderDetails.save();
      }
    }

    // update Deposit
    let deposit = Deposit.load(funding.deposit);
    if (deposit !== null) {
      deposit.fundingInterestPaid = deposit.fundingInterestPaid.plus(interestAmount);
      deposit.fundingRefundPaid = deposit.fundingRefundPaid.plus(refundAmount);
      deposit.save();
    }
  }
}

export function handleESetParamAddress(event: ESetParamAddress): void {
  let pool = getPool(event.address.toHex());
  let paramName = event.params.paramName;

  if (paramName === keccak256('feeModel')) {
    pool.interestModel = event.params.newValue.toHex();
  } else if (paramName === keccak256("interestModel")) {
    pool.interestModel = event.params.newValue.toHex();
  } else if (paramName === keccak256("interestOracle")) {
    pool.interestOracle = event.params.newValue.toHex();
  }

  pool.save();
}

export function handleESetParamUint(event: ESetParamUint): void {
  let pool = getPool(event.address.toHex());
  let paramName = event.params.paramName;

  if (paramName === keccak256("MaxDepositPeriod")) {
    pool.MaxDepositPeriod = event.params.newValue;
  } else if (paramName === keccak256("MinDepositAmount")) {
    pool.MinDepositAmount = normalize(event.params.newValue, pool.stablecoinDecimals.toI32());
  } else if (paramName === keccak256("GlobalDepositCap")) {
    pool.GlobalDepositCap = normalize(event.params.newValue, pool.stablecoinDecimals.toI32());
  }

  pool.save();
}

export function handleBlock(block: ethereum.Block): void {
  if (block.number.mod(BLOCK_HANDLER_INTERVAL).isZero()) {
    // load entities
    let pool = getPool(dataSource.address().toHex());
    let protocol = getProtocol();

    // load contracts
    let poolContract = DInterest.bind(dataSource.address());
    let moneyMarketContract = MoneyMarket.bind(Address.fromString(pool.moneyMarket));
    let poolOracleContract = IInterestOracle.bind(Address.fromString(pool.interestOracle));

    // load storage
    let oldDepositUSD = pool.totalDepositUSD;
    let oldInterestOwedUSD = pool.totalInterestOwedUSD;
    let oldFeeOwedUSD = pool.totalFeeOwedUSD;
    let oldSurplusUSD = pool.surplusUSD;
    let oldFundedAmountUSD = pool.totalFundedAmountUSD;

    // update stablecoin price in USD
    if (CHAINLINK_PRICE_ORACLE.has(pool.stablecoin)) {
      let oracleAddress = CHAINLINK_PRICE_ORACLE.get(pool.stablecoin);
      let priceOracle = ChainlinkPriceOracle.bind(Address.fromString(oracleAddress));

      let stablecoinPriceUSD = priceOracle.try_latestAnswer();
      if (!stablecoinPriceUSD.reverted) {
        pool.stablecoinPriceUSD = normalize(stablecoinPriceUSD.value, 8);
      }
    }

    // update pool surplus
    let surplus = poolContract.try_surplus();
    if (!surplus.reverted) {
      pool.surplus = normalize(surplus.value.value1, pool.stablecoinDecimals.toI32()).times(surplus.value.value0 ? NEGONE_BD : ONE_BD);
    }

    // update pool moneyMarketIncomeIndex
    let moneyMarketIncomeIndex = moneyMarketContract.try_incomeIndex();
    if (!moneyMarketIncomeIndex.reverted) {
      pool.moneyMarketIncomeIndex = moneyMarketIncomeIndex.value;
    }

    // update pool oneYearInterestRate
    let oneYearInterestRate = poolContract.try_calculateInterestAmount(tenPow(pool.stablecoinDecimals.toI32()), YEAR);
    if (!oneYearInterestRate.reverted) {
      pool.oneYearInterestRate = normalize(oneYearInterestRate.value);
    }

    // update pool oracleInterestRate
    let oracleInterestRate = poolOracleContract.try_updateAndQuery();
    if (!oracleInterestRate.reverted) {
      pool.oracleInterestRate = normalize(oracleInterestRate.value.value1);
    }

    // update pool USD data
    pool.totalDepositUSD = pool.totalDeposit.times(pool.stablecoinPriceUSD);
    pool.totalInterestOwedUSD = pool.totalInterestOwed.times(pool.stablecoinPriceUSD);
    pool.totalFeeOwedUSD = pool.totalFeeOwed.times(pool.stablecoinPriceUSD);
    pool.surplusUSD = pool.surplus.times(pool.stablecoinPriceUSD);
    pool.totalFundedAmountUSD = pool.totalFundedAmount.times(pool.stablecoinPriceUSD);

    // update protocol USD data
    protocol.totalDepositUSD = protocol.totalDepositUSD.minus(oldDepositUSD).plus(pool.totalDepositUSD);
    protocol.totalInterestOwedUSD = protocol.totalInterestOwedUSD.minus(oldInterestOwedUSD).plus(pool.totalInterestOwedUSD);
    protocol.totalFeeOwedUSD = protocol.totalFeeOwedUSD.minus(oldFeeOwedUSD).plus(pool.totalFeeOwedUSD);
    protocol.totalSurplusUSD = protocol.totalSurplusUSD.minus(oldSurplusUSD).plus(pool.surplusUSD);
    protocol.totalFundedAmountUSD = protocol.totalFundedAmountUSD.minus(oldFundedAmountUSD).plus(pool.totalFundedAmountUSD);

    protocol.save();
    pool.save();
  }
}
