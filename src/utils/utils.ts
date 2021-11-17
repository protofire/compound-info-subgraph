import { BigInt, BigDecimal, ethereum } from "@graphprotocol/graph-ts";

import { ZERO_BI, ONE_BI } from "./constants";

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
    let bd = BigDecimal.fromString("1");
    for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
        bd = bd.times(BigDecimal.fromString("10"));
    }
    return bd;
}

export function tokenAmountToDecimal(
    tokenAmount: BigInt,
    decimals: BigInt
): BigDecimal {
    if (ZERO_BI == decimals) {
        return tokenAmount.toBigDecimal();
    } else {
        return tokenAmount.toBigDecimal().div(exponentToBigDecimal(decimals));
    }
}
