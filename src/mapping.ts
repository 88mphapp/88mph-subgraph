import { BigInt, BigDecimal, EthereumEvent, Address, EthereumBlock, log } from "@graphprotocol/graph-ts"
import {
  DInterest,
  EDeposit,
  ESponsorDeposit,
  ESponsorWithdraw,
  EWithdraw
} from "../generated/DInterest/DInterest"
import { DPoolList, DPool, User, Deposit, Sponsor, SponsorDeposit } from "../generated/schema"

let DPOOLLIST_ID = "0";
let ZERO_DEC = BigDecimal.fromString("0")
let ONE_DEC = BigDecimal.fromString("1")
let NEGONE_DEC = BigDecimal.fromString("-1")
let ZERO_INT = BigInt.fromI32(0)
let ONE_INT = BigInt.fromI32(1)
let YEAR = BigInt.fromI32(31556952) // One year in seconds
let PRECISION = new BigDecimal(tenPow(18))
let DELIMITER = "---"

function tenPow(exponent: number): BigInt {
  let result = BigInt.fromI32(1)
  for (let i = 0; i < exponent; i++) {
    result = result.times(BigInt.fromI32(10))
  }
  return result
}

function normalize(i: BigInt): BigDecimal {
  return i.toBigDecimal().div(PRECISION)
}

function getPoolList(): DPoolList {
  let poolList = DPoolList.load(DPOOLLIST_ID)
  if (poolList == null) {
    poolList = new DPoolList(DPOOLLIST_ID)
    poolList.pools = new Array<string>()
    poolList.numPools = ZERO_INT
    poolList.numUsers = ZERO_INT
    poolList.numActiveUsers = ZERO_INT
    poolList.numSponsors = ZERO_INT
    poolList.numActiveSponsors = ZERO_INT
    poolList.save()
  }
  return poolList as DPoolList
}

function getPool(event: EthereumEvent): DPool {
  let poolList = getPoolList()
  let pool = DPool.load(event.address.toHex())
  // Init DPool entity if it doesn't exist
  if (pool == null) {
    let poolContract = DInterest.bind(event.address)
    pool = new DPool(event.address.toHex())
    pool.address = event.address.toHex()
    pool.moneyMarket = poolContract.moneyMarket().toHex()
    pool.stablecoin = poolContract.stablecoin().toHex()
    pool.numUsers = ZERO_INT
    pool.numDeposits = ZERO_INT
    pool.numActiveDeposits = ZERO_INT
    pool.numSponsors = ZERO_INT
    pool.numSponsorDeposits = ZERO_INT
    pool.numActiveSponsorDeposits = ZERO_INT
    pool.totalActiveDeposit = ZERO_DEC
    pool.totalHistoricalDeposit = ZERO_DEC
    pool.totalInterestPaid = ZERO_DEC
    pool.oneYearInterestRate = normalize(poolContract.calculateUpfrontInterestRate(YEAR))
    pool.deficit = ZERO_DEC
    pool.blocktime = normalize(poolContract.blocktime())
    pool.UIRMultiplier = normalize(poolContract.UIRMultiplier())
    pool.MinDepositPeriod = poolContract.MinDepositPeriod()
    pool.save()

    let pools = poolList.pools
    pools.push(pool.id)
    poolList.pools = pools
    poolList.numPools = poolList.numPools.plus(ONE_INT)
    poolList.save()
  }
  return pool as DPool
}

function getUser(address: Address, pool: DPool): User {
  let user = User.load(address.toHex())
  if (user == null) {
    user = new User(address.toHex())
    user.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.address)
    user.pools = pools
    user.numPools = ZERO_INT
    user.numDeposits = ZERO_INT
    user.numActiveDeposits = ZERO_INT
    user.totalActiveDeposit = ZERO_DEC
    user.totalHistoricalDeposit = ZERO_DEC
    user.totalInterestEarned = ZERO_DEC
    user.save()

    pool.numUsers = pool.numUsers.plus(ONE_INT)
    pool.save()

    let poolList = getPoolList()
    poolList.numUsers = poolList.numUsers.plus(ONE_INT)
    poolList.save()
  }
  return user as User
}

function getSponsor(address: Address, pool: DPool): Sponsor {
  let sponsor = Sponsor.load(address.toHex())
  if (sponsor == null) {
    sponsor = new Sponsor(address.toHex())
    sponsor.address = address.toHex()
    let pools = new Array<string>(0)
    pools.push(pool.address)
    sponsor.pools = pools
    sponsor.numPools = ZERO_INT
    sponsor.numDeposits = ZERO_INT
    sponsor.numActiveDeposits = ZERO_INT
    sponsor.totalActiveDeposit = ZERO_DEC
    sponsor.totalHistoricalDeposit = ZERO_DEC
    sponsor.save()

    pool.numSponsors = pool.numSponsors.plus(ONE_INT)
    pool.save()

    let poolList = getPoolList()
    poolList.numSponsors = poolList.numSponsors.plus(ONE_INT)
    poolList.save()
  }
  return sponsor as Sponsor
}

export function handleEDeposit(event: EDeposit): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)

  // Create new Deposit entity
  let deposit = new Deposit(pool.address + DELIMITER + user.address + DELIMITER + event.params.depositID.toString())
  deposit.idx = event.params.depositID
  deposit.user = user.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.depositTimestamp = event.block.timestamp
  deposit.interestEarned = normalize(event.params.upfrontInterestAmount)
  deposit.save()

  // Update DPool statistics
  if (user.numActiveDeposits.equals(ZERO_INT)) {
    // User has become active
    let poolList = getPoolList()
    poolList.numActiveUsers = poolList.numActiveUsers.plus(ONE_INT)
    poolList.save()
  }
  pool.numDeposits = pool.numDeposits.plus(ONE_INT)
  pool.numActiveDeposits = pool.numActiveDeposits.plus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.plus(deposit.amount)
  pool.totalHistoricalDeposit = pool.totalHistoricalDeposit.plus(deposit.amount)
  pool.totalInterestPaid = pool.totalInterestPaid.plus(deposit.interestEarned)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update User
  if (!user.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = user.pools
    pools.push(pool.id)
    user.pools = pools
    user.numPools = user.numPools.plus(ONE_INT)
    pool.numUsers = pool.numUsers.plus(ONE_INT)
    pool.save()
  }
  user.numDeposits = user.numDeposits.plus(ONE_INT)
  user.numActiveDeposits = user.numActiveDeposits.plus(ONE_INT)
  user.totalActiveDeposit = user.totalActiveDeposit.plus(deposit.amount)
  user.totalHistoricalDeposit = user.totalHistoricalDeposit.plus(deposit.amount)
  user.totalInterestEarned = user.totalInterestEarned.plus(deposit.interestEarned)
  user.save()
}

export function handleESponsorDeposit(event: ESponsorDeposit): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let sponsor = getSponsor(event.params.sender, pool)

  // Create new SponsorDeposit entity
  let deposit = new SponsorDeposit(pool.address + DELIMITER + sponsor.address + DELIMITER + event.params.depositID.toString())
  deposit.idx = event.params.depositID
  deposit.sponsor = sponsor.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.depositTimestamp = event.block.timestamp
  deposit.data = event.params.data
  deposit.save()

  // Update DPool statistics
  if (sponsor.numActiveDeposits.equals(ZERO_INT)) {
    // Sponsor has become active
    let poolList = getPoolList()
    poolList.numActiveSponsors = poolList.numActiveSponsors.plus(ONE_INT)
    poolList.save()
  }
  pool.numSponsorDeposits = pool.numSponsorDeposits.plus(ONE_INT)
  pool.numActiveSponsorDeposits = pool.numActiveSponsorDeposits.plus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.plus(deposit.amount)
  pool.totalHistoricalDeposit = pool.totalHistoricalDeposit.plus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update Sponsor
  if (!sponsor.pools.includes(pool.id)) {
    // Add pool to list of pools
    let pools = sponsor.pools
    pools.push(pool.id)
    sponsor.pools = pools
    sponsor.numPools = sponsor.numPools.plus(ONE_INT)
    pool.numSponsors = pool.numSponsors.plus(ONE_INT)
    pool.save()
  }
  sponsor.numDeposits = sponsor.numDeposits.plus(ONE_INT)
  sponsor.numActiveDeposits = sponsor.numActiveDeposits.plus(ONE_INT)
  sponsor.totalActiveDeposit = sponsor.totalActiveDeposit.plus(deposit.amount)
  sponsor.totalHistoricalDeposit = sponsor.totalHistoricalDeposit.plus(deposit.amount)
  sponsor.save()
}

export function handleEWithdraw(event: EWithdraw): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)
  let deposit = Deposit.load(pool.address + DELIMITER + user.address + DELIMITER + event.params.depositID.toString())

  // Set Deposit entity to inactive
  deposit.active = false
  deposit.save()

  // Update User statistics
  user.numActiveDeposits = user.numActiveDeposits.minus(ONE_INT)
  user.totalActiveDeposit = user.totalActiveDeposit.minus(deposit.amount)
  user.save()

  // Update DPool statistics
  if (user.numActiveDeposits.equals(ZERO_INT)) {
    // User has become inactive
    let poolList = getPoolList()
    poolList.numActiveUsers = poolList.numActiveUsers.minus(ONE_INT)
    poolList.save()
  }
  pool.numActiveDeposits = pool.numActiveDeposits.minus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()
}

export function handleESponsorWithdraw(event: ESponsorWithdraw): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let sponsor = getSponsor(event.params.sender, pool)
  let deposit = SponsorDeposit.load(pool.address + DELIMITER + sponsor.address + DELIMITER + event.params.depositID.toString())

  // Set SponsorDeposit entity to inactive
  deposit.active = false
  deposit.save()

  // Update Sponsor statistics
  sponsor.numActiveDeposits = sponsor.numActiveDeposits.minus(ONE_INT)
  sponsor.totalActiveDeposit = sponsor.totalActiveDeposit.minus(deposit.amount)
  sponsor.save()

  // Update DPool statistics
  if (sponsor.numActiveDeposits.equals(ZERO_INT)) {
    // Sponsor has become inactive
    let poolList = getPoolList()
    poolList.numActiveSponsors = poolList.numActiveSponsors.minus(ONE_INT)
    poolList.save()
  }
  pool.numActiveSponsorDeposits = pool.numActiveSponsorDeposits.minus(ONE_INT)
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()
}

export function handleBlock(block: EthereumBlock): void {
  let poolList = getPoolList()

  poolList.pools.forEach(poolID => {
    // Update DPool statistics
    let pool = DPool.load(poolID)
    let poolContract = DInterest.bind(Address.fromString(pool.address))
    pool.oneYearInterestRate = normalize(poolContract.calculateUpfrontInterestRate(YEAR))
    let deficitResult = poolContract.deficit()
    pool.deficit = normalize(deficitResult.value1).times(deficitResult.value0 ? NEGONE_DEC : ONE_DEC)
    pool.save()
  });
}