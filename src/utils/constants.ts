import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export let ZERO_BD = BigDecimal.fromString('0');
export let ONE_BD = BigDecimal.fromString('1');
export let NEGONE_BD = BigDecimal.fromString('-1');

export let ZERO_INT = BigInt.fromI32(0);
export let ONE_INT = BigInt.fromI32(1);

export let YEAR = BigInt.fromI32(31556952); // one year in seconds
export let PROTOCOL_ID = "0";
export let BLOCK_HANDLER_INTERVAL = BigInt.fromI32(240); // call block handler every 240 blocks (roughly 1 hour)
export let DELIMITER = "---";

export let YEARN_PRICE_ORACLE = Address.fromString("0x57aa88a0810dfe3f9b71a9b179dd8bf5f956c46a");

export let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000');

export let ULTRA_PRECISION = BigInt.fromI32(2).pow(128).toBigDecimal();
