import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { User, UserMarket } from "../../generated/schema";
import { ZERO_BD, ZERO_BI } from "../utils/constants";


export function createUserMarket(userAddress: Address, marketAddress: Address, blockNumber: BigInt): UserMarket {
    const userId = userAddress.toHexString();
    const marketId = marketAddress.toHexString();
    const userMarketId =  userId + marketId;
    const userMarket = new UserMarket(userMarketId);

    userMarket.user = userId;
    userMarket.market = marketId;
    userMarket.creationBlockNumber = blockNumber;
    userMarket.latestBlockNumber = blockNumber;
    userMarket.approvalAmount = ZERO_BD;
    userMarket.enteredMarket = false;
    userMarket.totalSupply = ZERO_BD;
    userMarket.totalBorrow = ZERO_BD;
    userMarket.cTokenBalance = ZERO_BD;

    return userMarket;
}
