import { BigDecimal, Address, ethereum } from "@graphprotocol/graph-ts";
import {
  DInterest,
  EDeposit,
  EWithdraw,
  EFund,
  ESetParamUint,
  ESetParamAddress,
  ETopupDeposit,
  EPayFundingInterest
} from "../generated/aave-dai/DInterest";
import { MoneyMarket } from "../generated/aave-dai/MoneyMarket";
import { IInterestOracle } from "../generated/aave-dai/IInterestOracle";
import { FundingMultitoken } from "../generated/aave-dai/FundingMultitoken";
import {
  Deposit,
  FunderDetails,
  Funding,
  UserTotalDeposit
} from "../generated/schema";
import {
  POOL_ADDRESSES,
  POOL_DEPLOY_BLOCKS,
  getPool,
  getUser,
  DELIMITER,
  normalize,
  ZERO_DEC,
  ZERO_INT,
  ONE_INT,
  getFunder,
  tenPow,
  BLOCK_HANDLER_START_BLOCK,
  YEAR,
  NEGONE_DEC,
  ONE_DEC,
  keccak256,
  BLOCK_HANDLER_INTERVAL,
  POOL_STABLECOIN_DECIMALS,
  ULTRA_PRECISION,
  getTokenDecimals,
  getGlobalStats
} from "./utils";

export function handleEDeposit(event: EDeposit): void {
  let pool = getPool(event.address.toHex());
  let user = getUser(event.params.sender, pool);
  let poolContract = DInterest.bind(Address.fromString(pool.address));
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  // Create new Deposit entity
  let deposit = new Deposit(
    pool.address + DELIMITER + event.params.depositID.toString()
  );
  let depositStruct = poolContract.getDeposit(event.params.depositID);
  deposit.nftID = event.params.depositID;
  deposit.user = user.id;
  deposit.pool = pool.id;
  // deposit.funding is set when Funding is created
  deposit.virtualTokenTotalSupply = normalize(
    depositStruct.virtualTokenTotalSupply,
    stablecoinDecimals
  );
  deposit.interestRate = normalize(depositStruct.interestRate);
  deposit.feeRate = normalize(depositStruct.feeRate);
  deposit.amount = deposit.virtualTokenTotalSupply.div(
    deposit.interestRate.plus(ONE_DEC)
  );
  deposit.maturationTimestamp = event.params.maturationTimestamp;
  deposit.depositTimestamp = event.block.timestamp;
  deposit.depositLength = deposit.maturationTimestamp.minus(
    deposit.depositTimestamp
  );
  deposit.averageRecordedIncomeIndex = depositStruct.averageRecordedIncomeIndex;
  deposit.fundingInterestPaid = ZERO_DEC;
  deposit.fundingRefundPaid = ZERO_DEC;
  deposit.save();

  // Update DPool statistics
  let depositAmount = normalize(event.params.depositAmount, stablecoinDecimals);
  let interestAmount = normalize(
    event.params.interestAmount,
    stablecoinDecimals
  );
  let feeAmount = normalize(event.params.feeAmount, stablecoinDecimals);
  pool.totalDeposit = pool.totalDeposit.plus(depositAmount);
  pool.totalInterestOwed = pool.totalInterestOwed.plus(interestAmount);
  pool.totalFeeOwed = pool.totalFeeOwed.plus(feeAmount);
  pool.numDeposits = pool.numDeposits.plus(ONE_INT);
  pool.save();

  // Update User
  if (!user.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = user.pools;
    pools.push(pool.id);
    user.pools = pools;
    user.numPools = user.numPools.plus(ONE_INT);
    pool.numUsers = pool.numUsers.plus(ONE_INT);
    pool.save();
  }
  user.numDeposits = user.numDeposits.plus(ONE_INT);
  user.save();

  // Update UserTotalDeposit
  let userTotalDepositID = user.id + DELIMITER + pool.id;
  let userTotalDepositEntity = UserTotalDeposit.load(userTotalDepositID);
  if (userTotalDepositEntity == null) {
    // Initialize UserTotalDeposits entity
    userTotalDepositEntity = new UserTotalDeposit(userTotalDepositID);
    userTotalDepositEntity.user = user.id;
    userTotalDepositEntity.pool = pool.id;
    userTotalDepositEntity.totalDeposit = ZERO_DEC;
    userTotalDepositEntity.totalInterestOwed = ZERO_DEC;
    userTotalDepositEntity.totalFeeOwed = ZERO_DEC;
  }
  userTotalDepositEntity.totalDeposit = userTotalDepositEntity.totalDeposit.plus(
    depositAmount
  );
  userTotalDepositEntity.totalInterestOwed = userTotalDepositEntity.totalInterestOwed.plus(
    interestAmount
  );
  userTotalDepositEntity.totalFeeOwed = userTotalDepositEntity.totalFeeOwed.plus(
    feeAmount
  );
  userTotalDepositEntity.save();
}

export function handleETopupDeposit(event: ETopupDeposit): void {
  let pool = getPool(event.address.toHex());
  let user = getUser(event.params.sender, pool);
  let poolContract = DInterest.bind(Address.fromString(pool.address));
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  // Update Deposit
  let deposit = Deposit.load(
    pool.address + DELIMITER + event.params.depositID.toString()
  );
  let depositStruct = poolContract.getDeposit(event.params.depositID);
  deposit.virtualTokenTotalSupply = normalize(
    depositStruct.virtualTokenTotalSupply,
    stablecoinDecimals
  );
  deposit.interestRate = normalize(depositStruct.interestRate);
  deposit.feeRate = normalize(depositStruct.feeRate);
  deposit.amount = deposit.virtualTokenTotalSupply.div(
    deposit.interestRate.plus(ONE_DEC)
  );
  deposit.averageRecordedIncomeIndex = depositStruct.averageRecordedIncomeIndex;
  deposit.save();

  // Update DPool statistics
  let depositAmount = normalize(event.params.depositAmount, stablecoinDecimals);
  let interestAmount = normalize(
    event.params.interestAmount,
    stablecoinDecimals
  );
  let feeAmount = normalize(event.params.feeAmount, stablecoinDecimals);
  pool.totalDeposit = pool.totalDeposit.plus(depositAmount);
  pool.totalInterestOwed = pool.totalInterestOwed.plus(interestAmount);
  pool.totalFeeOwed = pool.totalFeeOwed.plus(feeAmount);
  pool.save();

  // Update UserTotalDeposit
  let userTotalDepositID = user.id + DELIMITER + pool.id;
  let userTotalDepositEntity = UserTotalDeposit.load(userTotalDepositID);
  userTotalDepositEntity.totalDeposit = userTotalDepositEntity.totalDeposit.plus(
    depositAmount
  );
  userTotalDepositEntity.totalInterestOwed = userTotalDepositEntity.totalInterestOwed.plus(
    interestAmount
  );
  userTotalDepositEntity.totalFeeOwed = userTotalDepositEntity.totalFeeOwed.plus(
    feeAmount
  );
  userTotalDepositEntity.save();
}

export function handleEWithdraw(event: EWithdraw): void {
  let pool = getPool(event.address.toHex());
  let poolContract = DInterest.bind(event.address);
  let user = getUser(event.params.sender, pool);
  let deposit = Deposit.load(
    pool.address + DELIMITER + event.params.depositID.toString()
  );
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  // Update UserTotalDeposit
  let userTotalDepositID = user.id + DELIMITER + pool.id;
  let userTotalDepositEntity = UserTotalDeposit.load(userTotalDepositID);
  let depositAmount = normalize(
    event.params.virtualTokenAmount,
    stablecoinDecimals
  ).div(deposit.interestRate.plus(ONE_DEC));
  let interestAmount = normalize(
    event.params.virtualTokenAmount,
    stablecoinDecimals
  ).minus(depositAmount);
  let feeAmount = depositAmount.times(deposit.feeRate);
  userTotalDepositEntity.totalDeposit = userTotalDepositEntity.totalDeposit.minus(
    depositAmount
  );
  userTotalDepositEntity.totalInterestOwed = userTotalDepositEntity.totalInterestOwed.minus(
    interestAmount
  );
  userTotalDepositEntity.totalFeeOwed = userTotalDepositEntity.totalFeeOwed.minus(
    feeAmount
  );
  userTotalDepositEntity.save();

  // Update DPool statistics
  if (!event.params.early) {
    pool.historicalInterestPaid = pool.historicalInterestPaid.plus(
      interestAmount
    );
  }
  pool.totalDeposit = pool.totalDeposit.minus(depositAmount);
  pool.totalInterestOwed = pool.totalInterestOwed.minus(interestAmount);
  pool.totalFeeOwed = pool.totalFeeOwed.minus(feeAmount);
  pool.save();

  if (deposit.funding != null) {
    // Update Funding
    let funding = Funding.load(deposit.funding);
    let fundingID = funding.nftID;
    let fundingObj = poolContract.getFunding(fundingID);
    funding.principalPerToken = fundingObj.principalPerToken.divDecimal(
      ULTRA_PRECISION
    );
    funding.recordedMoneyMarketIncomeIndex =
      fundingObj.recordedMoneyMarketIncomeIndex;
    funding.active = funding.principalPerToken.gt(ZERO_DEC);

    funding.save();
  }

  // Update Deposit
  deposit.virtualTokenTotalSupply = deposit.virtualTokenTotalSupply.minus(
    normalize(event.params.virtualTokenAmount, stablecoinDecimals)
  );
  deposit.amount = deposit.virtualTokenTotalSupply.div(
    deposit.interestRate.plus(ONE_DEC)
  );
  deposit.save();
}

export function handleEPayFundingInterest(event: EPayFundingInterest): void {
  let pool = getPool(event.address.toHex());
  let funding = Funding.load(
    pool.address + DELIMITER + event.params.fundingID.toString()
  );
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  // Update Funding
  let interestAmount = normalize(
    event.params.interestAmount,
    stablecoinDecimals
  );
  let refundAmount = normalize(event.params.refundAmount, stablecoinDecimals);
  funding.totalInterestEarned = funding.totalInterestEarned.plus(
    interestAmount
  );
  funding.totalRefundEarned = funding.totalRefundEarned.plus(refundAmount);
  funding.save();

  // Update Deposit
  let deposit = Deposit.load(funding.deposit);
  deposit.fundingInterestPaid = deposit.fundingInterestPaid.plus(
    interestAmount
  );
  deposit.fundingRefundPaid = deposit.fundingRefundPaid.plus(refundAmount);
  deposit.save();
}

export function handleEFund(event: EFund): void {
  let pool = getPool(event.address.toHex());
  let poolContract = DInterest.bind(event.address);
  let funder = getFunder(event.params.sender, pool);
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );

  let fundingID = event.params.fundingID;
  let fundingObj = poolContract.getFunding(fundingID);
  let funding = Funding.load(pool.address + DELIMITER + fundingID.toString());
  let fundingMultitoken = FundingMultitoken.bind(
    poolContract.fundingMultitoken()
  );
  if (funding == null) {
    // Create new Funding entity
    funding = new Funding(pool.address + DELIMITER + fundingID.toString());
    funding.nftID = event.params.fundingID;
    funding.pool = pool.id;
    funding.deposit =
      pool.address + DELIMITER + fundingObj.depositID.toString();
    funding.fundedDeficitAmount = ZERO_DEC;
    funding.totalInterestEarned = ZERO_DEC;
    funding.totalRefundEarned = ZERO_DEC;
    funding.totalMPHEarned = ZERO_DEC;
    funding.funderDetails = new Array<string>(0);

    // Update Deposit
    let deposit = Deposit.load(funding.deposit);
    deposit.funding = funding.id;
    deposit.save();

    // Update DPool statistics
    pool.numFundings = pool.numFundings.plus(ONE_INT);
    pool.save();

    // Update Funder
    if (!funder.pools.includes(pool.id)) {
      // Add pool to list of pools
      let pools = funder.pools;
      pools.push(pool.id);
      funder.pools = pools;
      funder.numPools = funder.numPools.plus(ONE_INT);
    }
    let fundings = funder.fundings;
    fundings.push(funding.id);
    funder.fundings = fundings;
    funder.numFundings = funder.numFundings.plus(ONE_INT);
    funder.save();
  }

  // Update Funder Details
  let funderDetails = FunderDetails.load(
    funder.address + DELIMITER + pool.address + DELIMITER + fundingID.toString()
  );
  if (funderDetails == null) {
    funderDetails = new FunderDetails(
      funder.address +
        DELIMITER +
        pool.address +
        DELIMITER +
        fundingID.toString()
    );
    funderDetails.address = funder.address;
    funderDetails.fundAmount = ZERO_DEC;
    funderDetails.balance = ZERO_DEC;
  }
  funderDetails.fundAmount = funderDetails.fundAmount.plus(
    normalize(event.params.fundAmount, stablecoinDecimals)
  );
  funderDetails.balance = funderDetails.balance.plus(
    normalize(event.params.tokenAmount, stablecoinDecimals)
  );
  funderDetails.save();

  // Update funding
  funding.active = true;
  funding.recordedMoneyMarketIncomeIndex =
    fundingObj.recordedMoneyMarketIncomeIndex;
  funding.principalPerToken = fundingObj.principalPerToken.divDecimal(
    ULTRA_PRECISION
  );
  funding.totalSupply = normalize(
    fundingMultitoken.totalSupply(fundingID),
    stablecoinDecimals
  );
  funding.fundedDeficitAmount = funding.fundedDeficitAmount.plus(
    normalize(event.params.fundAmount, stablecoinDecimals)
  );
  if (!funding.funderDetails.includes(funderDetails.id)) {
    let details = funding.funderDetails;
    details.push(funderDetails.id);
    funding.funderDetails = details;
  }
  funding.save();
}

export function handleESetParamAddress(event: ESetParamAddress): void {
  let pool = getPool(event.address.toHex());
  let paramName = event.params.paramName;
  if (paramName == keccak256("feeModel")) {
  } else if (paramName == keccak256("interestModel")) {
    pool.interestModel = event.params.newValue.toHex();
  } else if (paramName == keccak256("interestOracle")) {
  } else if (paramName == keccak256("moneyMarket.rewards")) {
  }
  pool.save();
}

export function handleESetParamUint(event: ESetParamUint): void {
  let pool = getPool(event.address.toHex());
  let stablecoinDecimals: number = getTokenDecimals(
    Address.fromString(pool.stablecoin)
  );
  let stablecoinPrecision = new BigDecimal(tenPow(stablecoinDecimals));
  let paramName = event.params.paramName;
  if (paramName == keccak256("MaxDepositPeriod")) {
    pool.MaxDepositPeriod = event.params.newValue;
  } else if (paramName == keccak256("MinDepositAmount")) {
    pool.MinDepositAmount = event.params.newValue
      .toBigDecimal()
      .div(stablecoinPrecision);
  }
  pool.save();
}

export function handleBlock(block: ethereum.Block): void {
  // initialize GlobalStats ASAP
  getGlobalStats();

  if (
    block.number.ge(BLOCK_HANDLER_START_BLOCK) &&
    block.number.mod(BLOCK_HANDLER_INTERVAL).isZero()
  ) {
    let blockNumber = block.number.toI32();
    for (let i = 0; i < POOL_ADDRESSES.length; i++) {
      // Update DPool statistics
      let poolID = POOL_ADDRESSES[i];
      if (blockNumber >= POOL_DEPLOY_BLOCKS[i]) {
        let pool = getPool(poolID);
        let poolContract = DInterest.bind(Address.fromString(pool.address));
        let stablecoinDecimals: number = POOL_STABLECOIN_DECIMALS[i];
        let oracleContract = IInterestOracle.bind(
          poolContract.interestOracle()
        );

        let oneYearInterestRate = poolContract.try_calculateInterestAmount(
          tenPow(18),
          YEAR
        );
        pool.oneYearInterestRate = oneYearInterestRate.reverted
          ? ZERO_DEC
          : normalize(oneYearInterestRate.value);

        let surplusResult = poolContract.try_surplus();
        pool.surplus = surplusResult.reverted
          ? ZERO_DEC
          : normalize(surplusResult.value.value1, stablecoinDecimals).times(
              surplusResult.value.value0 ? NEGONE_DEC : ONE_DEC
            );

        let moneyMarket = MoneyMarket.bind(
          Address.fromString(pool.moneyMarket)
        );
        let moneyMarketIncomeIndex = moneyMarket.try_incomeIndex();
        pool.moneyMarketIncomeIndex = moneyMarketIncomeIndex.reverted
          ? ZERO_INT
          : moneyMarketIncomeIndex.value;

        let oracleInterestRate = oracleContract.try_updateAndQuery();
        pool.oracleInterestRate = oracleInterestRate.reverted
          ? ZERO_DEC
          : normalize(oracleInterestRate.value.value1);

        pool.save();
      }
    }
  }
}
