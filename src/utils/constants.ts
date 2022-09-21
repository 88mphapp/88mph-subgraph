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
CHAINLINK_PRICE_ORACLE.set("0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", "0xab594600376ec9fd91f8e885dadf0ce036862de0"); // WMATIC
CHAINLINK_PRICE_ORACLE.set("0x2791bca1f2de4661ed88a30c99a7a9449aa84174", "0xfe4a8cc5b5b2366c1b58bea3858e81843581b2f7"); // USDC
CHAINLINK_PRICE_ORACLE.set("0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", "0x4746dec9e833a82ec7c2c1356372ccf2cfcd2f3d"); // DAI
CHAINLINK_PRICE_ORACLE.set("0xc2132d05d31c914a87c6611c10748aeb04b58e8f", "0x0a6513e40db6eb1b165753ad52e80663aea50545"); // USDT
CHAINLINK_PRICE_ORACLE.set("0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", "0xc907e116054ad103354f2d350fd2514433d57f6f"); // WBTC
CHAINLINK_PRICE_ORACLE.set("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", "0xf9680d99d6c9589e2a93a78a04a279e509205945"); // WETH

export let ZERO_ADDR = Address.fromString('0x0000000000000000000000000000000000000000');

export let ULTRA_PRECISION = BigInt.fromI32(2).pow(128).toBigDecimal();
