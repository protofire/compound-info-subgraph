import { BigInt, BigDecimal, ethereum, log } from "@graphprotocol/graph-ts";

import {
    ZERO_BI,
    ONE_BI,
    ZERO_BD,
    ONE_BD,
    BLOCKS_PER_DAY_PRE_MERGE,
    DAYS_PER_YEAR,
    MERGE_BLOCK_NUMBER,
    BLOCKS_PER_DAY_POST_MERGE,
} from "./constants";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
    let bd = BigDecimal.fromString("1");
    for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
        bd = bd.times(BigDecimal.fromString("10"));
    }
    return bd;
}

export function tokenAmountToDecimal(tokenAmount: BigInt, decimals: BigInt): BigDecimal {
    if (ZERO_BI == decimals) {
        return tokenAmount.toBigDecimal();
    } else {
        return tokenAmount.toBigDecimal().div(exponentToBigDecimal(decimals));
    }
}

export function calculateApy(ratePerBlock: BigDecimal, blockNumber: BigInt): BigDecimal {
    const base = ratePerBlock.times(getBlocksPerData(blockNumber)).plus(ONE_BD);

    let apy = BigDecimal.fromString("1");
    for (let i = ZERO_BI; i.lt(DAYS_PER_YEAR); i = i.plus(ONE_BI)) {
        apy = apy.times(base);
    }
    return apy.minus(ONE_BD);
}

// Following the calculation here: https://gist.github.com/ajb413/d32442edae9251ad395436d5b80d4480
export function calculateCompDistrubtionApy(
    totalSupplyOrBorrow: BigDecimal,
    compSpeed: BigDecimal,
    usdcPerComp: BigDecimal,
    usdcPerUnderlying: BigDecimal,
    blockNumber: BigInt
): BigDecimal {
    // log.warning("COMP APY - tsb: {}, speed: {}, usdcPerComd: {}, usdcPerUnderly: {}, block: {}", [
    //     totalSupplyOrBorrow.toString(),
    //     compSpeed.toString(),
    //     usdcPerComp.toString(),
    //     usdcPerUnderlying.toString(),
    //     blockNumber.toString(),
    // ]);

    // TEMP: ride through block 15209048 insane usdcPerComp
    if (usdcPerComp.gt(BigDecimal.fromString("1000000000000000000"))) {
        log.warning("usdcPerComp ERROR: {}", [usdcPerComp.toString()]);
        return ZERO_BD;
    }

    const compDistributionPerDay = BigDecimal.fromString('0')

    const denom = totalSupplyOrBorrow.times(usdcPerUnderlying);

    const base = denom.notEqual(ZERO_BD) ? ONE_BD.plus(usdcPerComp.times(compDistributionPerDay).div(denom)) : ZERO_BD;

    let apy = BigDecimal.fromString("1");
    for (let i = ZERO_BI; i.lt(DAYS_PER_YEAR); i = i.plus(ONE_BI)) {
        apy = apy.times(base);
    }
    return apy.minus(ONE_BD);
}

export function minBigDecimal(a: BigDecimal, b: BigDecimal): BigDecimal {
    if (a.lt(b)) {
        return a;
    } else {
        return b;
    }
}

export function maxBigDecimal(a: BigDecimal, b: BigDecimal): BigDecimal {
    if (a.gt(b)) {
        return a;
    } else {
        return b;
    }
}

export function getBlocksPerData(currentBlockNumber: BigInt): BigDecimal {
    return currentBlockNumber.lt(MERGE_BLOCK_NUMBER) ? BLOCKS_PER_DAY_PRE_MERGE : BLOCKS_PER_DAY_POST_MERGE;
}
