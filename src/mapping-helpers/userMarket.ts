import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { Market, User, UserMarket } from "../../generated/schema";
import { CToken } from "../../generated/templates/cToken/cToken";
import { ZERO_BD, ZERO_BI } from "../utils/constants";
import { tokenAmountToDecimal } from "../utils/utils";
import { createUser } from "./user";

export function createUserMarket(
    userAddress: Address,
    marketAddress: Address,
    blockNumber: BigInt
): UserMarket {
    const userId = userAddress.toHexString();
    const marketId = marketAddress.toHexString();
    const userMarketId = userId + marketId;
    const userMarket = new UserMarket(userMarketId);

    userMarket.user = userId;
    userMarket.market = marketId;
    userMarket.creationBlockNumber = blockNumber;
    userMarket.latestBlockNumber = blockNumber;
    userMarket.enteredMarket = false;
    userMarket.totalSupply = ZERO_BD;
    userMarket.totalBorrow = ZERO_BD;
    userMarket.cTokenBalance = ZERO_BD;

    userMarket.save();
    return userMarket;
}

export function updateUserMarketBalance(
    userAddress: Address,
    marketAddress: Address,
    blockNumber: BigInt
): void {
    const userId = userAddress.toHexString();
    const marketId = marketAddress.toHexString();
    const userMarketId = userId + marketId;

    const market = Market.load(marketId);
    let user = User.load(userId);
    let userMarket = UserMarket.load(userMarketId);

    if (market == null) {
        log.warning("*** ERROR: market was null in updateUserMarket()", []);
        return;
    }

    if (user == null) {
        user = createUser(userAddress, blockNumber);
        user.save();
    }

    if (userMarket == null) {
        userMarket = createUserMarket(userAddress, marketAddress, blockNumber);
    }

    userMarket.latestBlockNumber = blockNumber;

    const contract = CToken.bind(marketAddress);

    const tryBalanceOf = contract.try_balanceOf(userAddress);
    if (tryBalanceOf.reverted) {
        log.warning("*** ERROR: balanceOf reverted in updateUserMarket()", []);
    } else {
        userMarket.cTokenBalance = tokenAmountToDecimal(
            tryBalanceOf.value,
            market.cTokenDecimals
        );
        userMarket.totalSupply = userMarket.cTokenBalance.times(
            market.underlyingPerCToken
        );
    }

    const tryBorrowBalance = contract.try_borrowBalanceCurrent(userAddress);
    if (tryBorrowBalance.reverted) {
        log.warning(
            "*** ERROR: borrowBalanceCurrent reverted in updateUserMarket()",
            []
        );
    } else {
        userMarket.totalBorrow = tokenAmountToDecimal(
            tryBorrowBalance.value,
            market.underlyingDecimals
        );
    }

    userMarket.save();
}
