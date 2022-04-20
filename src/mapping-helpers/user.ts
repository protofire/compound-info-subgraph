import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { User, UserMarket } from "../../generated/schema";
import { ZERO_BD } from "../utils/constants";

export function createUser(address: Address, blockNumber: BigInt): User {
    const user = new User(address);

    user.creationBlockNumber = blockNumber;
    user.lastBlockNumber = blockNumber;

    user.save();
    return user;
}

export function updateUserAggregates(userAddress: Address): void {
    const user = User.load(userAddress);

    if (user == null) {
        // Should never happen
        log.warning("*** ERROR: update user aggregates called with non existant user", []);
        return;
    }

    const userMarketIds = user.userMarkets;
    const numUserMarkets = userMarketIds.length;

    let totalSupplyUsd = ZERO_BD;
    let totalBorrowUsd = ZERO_BD;

    for (let i = 0; i < numUserMarkets; i++) {
        const userMarketId = userMarketIds[i];
        const userMarket = UserMarket.load(userMarketId);

        if (userMarket != null) {
            totalSupplyUsd = totalSupplyUsd.plus(userMarket.totalSupplyUsd);
            totalBorrowUsd = totalBorrowUsd.plus(userMarket.totalBorrowUsd);
        } else {
            // Won't happen
            log.warning("*** ERROR: a userMarket was null in the loop of updateUserAggregates()", []);
        }
    }

    user.totalSupplyUsd = totalSupplyUsd;
    user.totalBorrowUsd = totalBorrowUsd;

    user.save();
}
