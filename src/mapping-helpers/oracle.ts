import {
    Address,
    BigDecimal,
    BigInt,
    ByteArray,
    Bytes,
    log,
} from "@graphprotocol/graph-ts";

import { Market, Protocol } from "../../generated/schema";
import { PriceOracle1 } from "../../generated/templates/cToken/PriceOracle1";
import { PriceOracle2 } from "../../generated/templates/cToken/PriceOracle2";

import { ZERO_BD, ONE_BD } from "../utils/constants";
import {
    PROTOCOL_ID,
    PRICE_ORACLE_1_ADDRESS,
    CETH_ADDRESS,
    CUSDC_ADDRESS,
    USDC_ADDRESS,
    PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER,
} from "../utils/constants";
import { exponentToBigDecimal } from "../utils/utils";

// Used for all cERC20 contracts
export function getTokenPrice(
    blockNumber: BigInt,
    eventAddress: Address,
    underlyingAddress: Address,
    underlyingDecimals: BigInt
): BigDecimal {
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        log.warning("*** ERROR: protocl was null in getTokenPrice()", []);
        return ZERO_BD;
    }

    let oracleAddress = changetype<Address>(protocol.priceOracle);
    let underlyingPrice: BigDecimal;
    let priceOracle1Address = Address.fromString(PRICE_ORACLE_1_ADDRESS);

    /* PriceOracle2 is used at the block the Comptroller starts using it.
     * see here https://etherscan.io/address/0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b#events
     * Search for event topic 0xd52b2b9b7e9ee655fcb95d2e5b9e0c9f69e7ef2b8e9d2d0ea78402d576d22e22,
     * and see block 7715908.
     *
     * This must use the cToken address.
     *
     * Note this returns the value without factoring in token decimals and wei, so we must divide
     * the number by (ethDecimals - tokenDecimals) and again by the mantissa.
     * USDC would be 10 ^ ((18 - 6) + 18) = 10 ^ 30
     *
     * Note that they deployed 3 different PriceOracles at the beginning of the Comptroller,
     * and that they handle the decimals different, which can break the subgraph. So we actually
     * defer to Oracle 1 before block 7715908, which works,
     * until this one is deployed, which was used for 121 days */
    if (blockNumber.gt(PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER)) {
        let mantissaDecimalFactor = BigInt.fromI32(36).minus(
            underlyingDecimals
        );
        let bdFactor = exponentToBigDecimal(mantissaDecimalFactor);
        let oracle2 = PriceOracle2.bind(oracleAddress);
        let tryPrice = oracle2.try_getUnderlyingPrice(eventAddress);

        underlyingPrice = tryPrice.reverted
            ? ZERO_BD
            : tryPrice.value.toBigDecimal().div(bdFactor);

        /* PriceOracle(1) is used (only for the first ~100 blocks of Comptroller. Annoying but we must
         * handle this. We use it for more than 100 blocks, see reason at top of if statement
         * of PriceOracle2.
         *
         * This must use the token address, not the cToken address.
         *
         * Note this returns the value already factoring in token decimals and wei, therefore
         * we only need to divide by the mantissa, 10^18 */
    } else {
        let oracle1 = PriceOracle1.bind(priceOracle1Address);
        underlyingPrice = oracle1
            .getPrice(underlyingAddress)
            .toBigDecimal()
            .div(exponentToBigDecimal(BigInt.fromI32(18)));
    }
    return underlyingPrice;
}

// Returns the price of USDC in eth. i.e. 0.005 would mean ETH is $200
export function getUSDCpriceETH(blockNumber: BigInt): BigDecimal {
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        log.warning("*** ERROR: protocl was null in getUSDCpriceETH()", []);
        return ZERO_BD;
    }

    let oracleAddress = changetype<Address>(protocol.priceOracle);
    let priceOracle1Address = Address.fromString(
        "02557a5e05defeffd4cae6d83ea3d173b272c904"
    );
    let usdPrice: BigDecimal;

    // See notes on block number if statement in getTokenPrices()
    if (blockNumber.gt(PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER)) {
        let oracle2 = PriceOracle2.bind(oracleAddress);
        let mantissaDecimalFactorUSDC = BigInt.fromI32(18 - 6 + 18);
        let bdFactorUSDC = exponentToBigDecimal(mantissaDecimalFactorUSDC);
        let tryPrice = oracle2.try_getUnderlyingPrice(
            Address.fromString(CUSDC_ADDRESS)
        );

        usdPrice = tryPrice.reverted
            ? ZERO_BD
            : tryPrice.value.toBigDecimal().div(bdFactorUSDC);
    } else {
        let oracle1 = PriceOracle1.bind(priceOracle1Address);
        usdPrice = oracle1
            .getPrice(Address.fromString(USDC_ADDRESS))
            .toBigDecimal()
            .div(exponentToBigDecimal(BigInt.fromI32(18)));
    }
    return usdPrice;
}

// Only to be used after block 10678764, since it's aimed to fix the change to USD based price oracle.
export function getETHinUSD(blockNumber: BigInt): BigDecimal {
    const protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        log.warning("*** ERROR: protocol was null in getETHinUSD()", []);
        return ZERO_BD;
    }

    if (blockNumber.lt(BigInt.fromI32(10678764))) {
        log.warning(
            "*** ERROR: getETHinUSD was called before block 10678764",
            []
        );
        return ZERO_BD;
    }

    let oracleAddress = changetype<Address>(protocol.priceOracle);
    let oracle = PriceOracle2.bind(oracleAddress);
    let tryPrice = oracle.try_getUnderlyingPrice(
        Address.fromString(CETH_ADDRESS)
    );

    let ethPriceInUSD = tryPrice.reverted
        ? ZERO_BD
        : tryPrice.value
              .toBigDecimal()
              .div(exponentToBigDecimal(BigInt.fromI32(18)));

    return ethPriceInUSD;
}

export function getCOMPinUSD(blockNumber: BigInt): BigDecimal {
    // TODO: implement this!
    return ONE_BD;
}
