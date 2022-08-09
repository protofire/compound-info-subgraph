import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { Market, User, UserMarket } from "../../generated/schema";
import { CToken } from "../../generated/templates/cToken/cToken";
import { ZERO_BD, ZERO_BI } from "../utils/constants";
import { tokenAmountToDecimal } from "../utils/utils";
import { createUser } from "./user";

export function createUserMarket(userAddress: Address, marketAddress: Address, blockNumber: BigInt): UserMarket {
    const marketId = marketAddress.toHexString();
    const userMarketId = userAddress.toHexString() + marketId;

    let user = User.load(userAddress);
    if (user == null) {
        // Should never happen
        log.warning("*** ERROR: create user market was called with a non existant user", []);
        user = createUser(userAddress, blockNumber);
        user.save();
    }

    const userMarket = new UserMarket(userMarketId);

    userMarket.user = userAddress;
    userMarket.market = marketId;
    userMarket.creationBlockNumber = blockNumber;
    userMarket.latestBlockNumber = blockNumber;
    userMarket.enteredMarket = false;
    userMarket.totalSupply = ZERO_BD;
    userMarket.totalSupplyUsd = ZERO_BD;
    userMarket.totalBorrow = ZERO_BD;
    userMarket.totalBorrowUsd = ZERO_BD;
    userMarket.cTokenBalance = ZERO_BD;

    // Add the userMarket to the list of userMarkets for the user
    let userMarketList = user.userMarkets;
    userMarketList.push(userMarket.id);
    user.userMarkets = userMarketList;

    userMarket.save();
    user.save();
    return userMarket;
}

export function updateUserMarketBalance(userAddress: Address, marketAddress: Address, blockNumber: BigInt): void {
    const marketId = marketAddress.toHexString();
    const userMarketId = userAddress.toHexString() + marketId;

    const market = Market.load(marketId);
    let user = User.load(userAddress);
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
        userMarket.cTokenBalance = tokenAmountToDecimal(tryBalanceOf.value, market.cTokenDecimals);
        userMarket.totalSupply = userMarket.cTokenBalance.times(market.underlyingPerCToken);
        userMarket.totalSupplyUsd = userMarket.totalSupply.times(market.usdcPerUnderlying);
    }

    const tryBorrowBalance = contract.try_borrowBalanceCurrent(userAddress);
    if (tryBorrowBalance.reverted) {
        log.warning("*** ERROR: borrowBalanceCurrent reverted in updateUserMarket()", []);
    } else {
        userMarket.totalBorrow = tokenAmountToDecimal(tryBorrowBalance.value, market.underlyingDecimals);
        userMarket.totalBorrowUsd = userMarket.totalBorrow.times(market.usdcPerUnderlying);
    }

    userMarket.save();
}
