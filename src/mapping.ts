import { BigInt, BigDecimal, EthereumEvent, Address, EthereumBlock } from "@graphprotocol/graph-ts"
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
let YEAR = BigInt.fromI32(31556952) // One year in seconds
let PRECISION = new BigDecimal(tenPow(18))

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
    pool.poolList = DPOOLLIST_ID
    pool.address = event.address.toHex()
    pool.moneyMarket = poolContract.moneyMarket().toHex()
    pool.stablecoin = poolContract.stablecoin().toHex()
    pool.totalActiveDeposit = ZERO_DEC
    pool.totalHistoricalDeposit = ZERO_DEC
    pool.totalInterestPaid = ZERO_DEC
    pool.oneYearInterestRate = normalize(poolContract.calculateUpfrontInterestRate(YEAR))
    pool.deficit = ZERO_DEC
    pool.blocktime = normalize(poolContract.blocktime())
    pool.UIRMultiplier = normalize(poolContract.UIRMultiplier())
    pool.MinDepositPeriod = poolContract.MinDepositPeriod()
    pool.save()
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
    user.totalActiveDeposit = ZERO_DEC
    user.totalHistoricalDeposit = ZERO_DEC
    user.totalInterestEarned = ZERO_DEC
    user.save()
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
    sponsor.totalActiveDeposit = ZERO_DEC
    sponsor.totalHistoricalDeposit = ZERO_DEC
    sponsor.save()
  }
  return sponsor as Sponsor
}

export function handleEDeposit(event: EDeposit): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)

  // Create new Deposit entity
  let deposit = new Deposit(`${pool.address}---${user.address}---${event.params.depositID}`)
  deposit.user = user.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.interestEarned = normalize(event.params.upfrontInterestAmount)
  deposit.save()

  // Update DPool statistics
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
    user.save()
  }
}

export function handleESponsorDeposit(event: ESponsorDeposit): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let sponsor = getSponsor(event.params.sender, pool)

  // Create new SponsorDeposit entity
  let deposit = new SponsorDeposit(`${pool.address}---${sponsor.address}---${event.params.depositID}`)
  deposit.sponsor = sponsor.id
  deposit.pool = pool.id
  deposit.amount = normalize(event.params.amount)
  deposit.maturationTimestamp = event.params.maturationTimestamp
  deposit.active = true
  deposit.data = event.params.data
  deposit.save()

  // Update DPool statistics
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
    sponsor.save()
  }
}

export function handleEWithdraw(event: EWithdraw): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let user = getUser(event.params.sender, pool)
  let deposit = Deposit.load(`${pool.address}---${user.address}---${event.params.depositID}`)

  // Set Deposit entity to inactive
  deposit.active = false
  deposit.save()

  // Update DPool statistics
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update User statistics
  user.totalActiveDeposit = user.totalActiveDeposit.minus(deposit.amount)
  user.save()
}


export function handleESponsorWithdraw(event: ESponsorWithdraw): void {
  let pool = getPool(event)
  let poolContract = DInterest.bind(event.address)
  let sponsor = getSponsor(event.params.sender, pool)
  let deposit = SponsorDeposit.load(`${pool.address}---${sponsor.address}---${event.params.depositID}`)

  // Set SponsorDeposit entity to inactive
  deposit.active = false
  deposit.save()

  // Update DPool statistics
  pool.totalActiveDeposit = pool.totalActiveDeposit.minus(deposit.amount)
  pool.blocktime = normalize(poolContract.blocktime())
  pool.save()

  // Update Sponsor statistics
  sponsor.totalActiveDeposit = sponsor.totalActiveDeposit.minus(deposit.amount)
  sponsor.save()
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