import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";

import { Protocol } from "../../generated/schema";
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
    GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER,
} from "../utils/constants";
import { tokenAmountToDecimal } from "../utils/utils";

/**
 * Get the value of eth in USDC
 * @param blockNumber blockNumber you are currently on, this is used to determine which oracle to use, and how to manipulate the data correctly
 * @returns value of eth in usdc
 */
export function getUsdcPerEth(blockNumber: BigInt): BigDecimal {
    let usdcPerEth: BigDecimal;
    if (blockNumber.lt(PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER)) {
        usdcPerEth = getUsdcPerEthFromOracleOne();
    } else {
        usdcPerEth = getUsdcPerEthAfterOracleOne(blockNumber);
    }

    return usdcPerEth;
}

/**
 * Get the value of the underlying token in usdc
 * @param market the market to get this for
 * @param blockNumber the block number you are currently on
 * @param usdcPerEth the value of eth in usdc for this block number, you can get this with getUsdcPerEth
 * @returns the value of the underlying token in usdc
 */
export function getUsdcPerUnderlying(
    underlyingAddress: Address,
    cTokenAddress: Address,
    underlyingDecimals: BigInt,
    blockNumber: BigInt,
    usdcPerEth: BigDecimal
): BigDecimal {
    let usdcPerUnderlying: BigDecimal;
    if (blockNumber.lt(PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER)) {
        usdcPerUnderlying = getUsdcPerUnderlyingFromOracleOne(underlyingAddress, usdcPerEth);
    } else {
        usdcPerUnderlying = getUsdcPerUnderlyingAfterOracleOne(
            cTokenAddress,
            underlyingDecimals,
            blockNumber,
            usdcPerEth
        );
    }

    return usdcPerUnderlying;
}

//// Helpers

function getUsdcPerUnderlyingFromOracleOne(underlyingAddress: Address, usdcPerEth: BigDecimal): BigDecimal {
    const oracleAddress = Address.fromString(PRICE_ORACLE_1_ADDRESS);
    const oracle = PriceOracle1.bind(oracleAddress);

    // getPrice has a base of eth
    const ethPerUnderlyingScaled = oracle.try_getPrice(underlyingAddress);

    if (ethPerUnderlyingScaled.reverted) {
        log.warning("*** ERROR: getUsdcPerEthFromOracleOne failed", []);
        return ZERO_BD;
    }

    // Scaled by 10^18 when stored
    const ethPerUnderlying = tokenAmountToDecimal(ethPerUnderlyingScaled.value, BigInt.fromU32(18));

    const underlyingPerEth = ethPerUnderlying.notEqual(ZERO_BD) ? ONE_BD.div(ethPerUnderlying) : ZERO_BD;

    return usdcPerEth.notEqual(ZERO_BD) ? underlyingPerEth.div(usdcPerEth) : ZERO_BD;
}

function getUsdcPerUnderlyingAfterOracleOne(
    cTokenAddress: Address,
    underlyingDecimals: BigInt,
    blockNumber: BigInt,
    usdcPerEth: BigDecimal
): BigDecimal {
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        log.warning("*** ERROR: protocl was null in getTokenPrice()", []);
        return ZERO_BD;
    }

    const oracleAddress = changetype<Address>(protocol.priceOracle);
    const oracle = PriceOracle2.bind(oracleAddress);

    let usdcPerUnderlying: BigDecimal;

    if (blockNumber.lt(GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER)) {
        // Before this block number, getUnderlyingPrice uses an eth base
        const ethPerUnderlingScaled = oracle.try_getUnderlyingPrice(cTokenAddress);

        if (ethPerUnderlingScaled.reverted) {
            // Expect to get this when we ask for COMP price, but COMP doesn't exist yet
            log.warning(
                `*** ERROR: getUsdcPerEthAfterOracleOne failed with eth base for: ${cTokenAddress.toHexString()}`,
                []
            );
            return ZERO_BD;
        }

        // Unsclaing the value, this is 18 for the scale, 18 for eth decimals, 6 for usdc decimals
        const ethPerUnderlying = tokenAmountToDecimal(
            ethPerUnderlingScaled.value,
            BigInt.fromU32(36).minus(underlyingDecimals)
        );

        usdcPerUnderlying = ethPerUnderlying.times(usdcPerEth);
    } else {
        // After this block number, getUnderlyingPrice uses usdc as base

        const usdcPerUnderlyingScaled = oracle.try_getUnderlyingPrice(cTokenAddress);

        if (usdcPerUnderlyingScaled.reverted) {
            log.warning(
                `*** ERROR: getUsdcPerEthAfterOracleOne failed with usdc base for ${cTokenAddress.toHexString()}`,
                []
            );
            return ZERO_BD;
        }

        usdcPerUnderlying = tokenAmountToDecimal(
            usdcPerUnderlyingScaled.value,
            BigInt.fromU32(36).minus(underlyingDecimals)
        );
    }

    return usdcPerUnderlying;
}

function getUsdcPerEthFromOracleOne(): BigDecimal {
    const oracleAddress = Address.fromString(PRICE_ORACLE_1_ADDRESS);
    const oracle = PriceOracle1.bind(oracleAddress);

    // getPrice has a base of eth
    const ethPerUsdcScaled = oracle.try_getPrice(Address.fromString(USDC_ADDRESS));

    if (ethPerUsdcScaled.reverted) {
        log.warning("*** ERROR: getUsdcPerEthFromOracleOne failed", []);
        return ZERO_BD;
    }

    // Scaled by 10^18 when stored
    const ethPerUsdc = tokenAmountToDecimal(ethPerUsdcScaled.value, BigInt.fromU32(18));

    const usdcPerEth = ethPerUsdc.notEqual(ZERO_BD) ? ONE_BD.div(ethPerUsdc) : ZERO_BD;

    return usdcPerEth;
}

function getUsdcPerEthAfterOracleOne(blockNumber: BigInt): BigDecimal {
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        log.warning("*** ERROR: protocl was null in getTokenPrice()", []);
        return ZERO_BD;
    }

    const oracleAddress = changetype<Address>(protocol.priceOracle);
    const oracle = PriceOracle2.bind(oracleAddress);

    let usdcPerEth: BigDecimal;

    if (blockNumber.lt(GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER)) {
        // Before this block number, getUnderlyingPrice uses an eth base
        const ethPerUsdcScaled = oracle.try_getUnderlyingPrice(Address.fromString(CUSDC_ADDRESS));

        if (ethPerUsdcScaled.reverted) {
            log.warning("*** ERROR: getUsdcPerEthAfterOracleOne failed with eth base", []);
            return ZERO_BD;
        }

        // Unsclaing the value, this is 18 for the scale, 18 for eth decimals, 6 for usdc decimals
        const ethPerUsdc = tokenAmountToDecimal(ethPerUsdcScaled.value, BigInt.fromU32(18 - 6 + 18));

        usdcPerEth = ethPerUsdc.notEqual(ZERO_BD) ? ONE_BD.div(ethPerUsdc) : ZERO_BD;
    } else {
        // After this block number, getUnderlyingPrice uses usdc as base

        const usdcPerEthScaled = oracle.try_getUnderlyingPrice(Address.fromString(CETH_ADDRESS));

        if (usdcPerEthScaled.reverted) {
            log.warning("*** ERROR: getUsdcPerEthAfterOracleOne failed with usdc base", []);
            return ZERO_BD;
        }

        usdcPerEth = tokenAmountToDecimal(usdcPerEthScaled.value, BigInt.fromU32(18));
    }

    return usdcPerEth;
}
