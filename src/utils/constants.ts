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

export let YEARN_PRICE_ORACLE = Address.fromString("0x83d95e0D5f402511dB06817Aff3f9eA88224B030");

export let MPH_ID = '0x8888801af4d980682e47f1a9036e589479e835c5';
export let MPH_ADDR = Address.fromString('0x8888801af4d980682e47f1a9036e589479e835c5');

export let XMPH_ID = '0x1702f18c1173b791900f81ebae59b908da8f689b';
export let XMPH_ADDR = Address.fromString('0x1702f18c1173b791900f81ebae59b908da8f689b');

export let VEMPH_ID = '0xf183287df9cb613c16989c16bf60537592fa736c';
export let VEMPH_ADDR = Address.fromString('0xf183287df9cb613c16989c16bf60537592fa736c');

export let DAI_ADDR = Address.fromString('0x6b175474e89094c44da98b954eedeac495271d0f');
export let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000');

export let ULTRA_PRECISION = BigInt.fromI32(2).pow(128).toBigDecimal();
