import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { User } from "../../generated/schema";

export function createUser(address: Address, blockNumber: BigInt): User {
    const user = new User(address.toHexString());

    user.creationBlockNumber = blockNumber;
    user.lastBlockNumber = blockNumber;

    user.save();
    return user;
}
