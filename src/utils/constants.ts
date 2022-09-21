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

export let CHAINLINK_PRICE_ORACLE = new Map<string, string>();
CHAINLINK_PRICE_ORACLE.set("0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7", "0x0a77230d17318075983913bc2145db16c7366156"); // WAVAX
CHAINLINK_PRICE_ORACLE.set("0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", "0xf096872672f44d6eba71458d74fe67f9a77a23b9"); // USDC
CHAINLINK_PRICE_ORACLE.set("0xd586e7f844cea2f87f50152665bcbc2c279d8d70", "0x51d7180eda2260cc4f6e4eebb82fef5c3c2b8300"); // DAI
CHAINLINK_PRICE_ORACLE.set("0xc7198437980c041c805a1edcba50c1ce5db95118", "0xebe676ee90fe1112671f19b6b7459bc678b67e8a"); // USDT
CHAINLINK_PRICE_ORACLE.set("0x50b7545627a5162f82a992c33b87adc75187b218", "0x2779d32d5166baaa2b2b658333ba7e6ec0c65743"); // WBTC
CHAINLINK_PRICE_ORACLE.set("0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab", "0x976b3d034e162d8bd72d6b9c989d545b839003b0"); // WETH
CHAINLINK_PRICE_ORACLE.set("0x5947bb275c521040051d82396192181b413227a3", "0x49ccd9ca821efeab2b98c60dc60f518e765ede9a"); // LINK

export let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000');

export let ULTRA_PRECISION = BigInt.fromI32(2).pow(128).toBigDecimal();
