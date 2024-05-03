import { Address, log } from "@graphprotocol/graph-ts";

import {
    MarketListed as MarketListedEvent,
    NewPriceOracle as NewPriceOracleEvent,
    MarketEntered as MarketEnteredEvent,
    MarketExited as MarketExitedEvent,
} from "../../generated/Comptroller/Comptroller";
import { Market, Protocol, User, UserMarket } from "../../generated/schema";
import { CToken as CTokenTemplate } from "../../generated/templates";

import { createMarket } from "../mapping-helpers/market";
import { createProtocol } from "../mapping-helpers/protocol";
import { createUser } from "../mapping-helpers/user";
import { createUserMarket } from "../mapping-helpers/userMarket";
import { PROTOCOL_ID } from "../utils/constants";

export function handleMarketListed(event: MarketListedEvent): void {
    const cTokenAddress = event.params.cToken;
    const blockNumber = event.block.number;

    // Dynamically create cToken data source
    CTokenTemplate.create(event.params.cToken);

    // Create the protocol if it doesn't exist, this is just here for easier testing.
    // It will already exist
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        const oracleAddress = "0x23658D27fCa1fc6BEF59e433eD476c56C13D99fa "; // hard coded price oracle 2 address
        protocol = createProtocol(Address.fromString(oracleAddress), blockNumber);
    }

    const market = createMarket(cTokenAddress, blockNumber);

    // Add the market to the list of markets in the protocol
    let marketList = protocol.markets;
    marketList.push(market.id);
    protocol.markets = marketList;

    market.save();
    protocol.save();
}

export function handleNewPriceOracle(event: NewPriceOracleEvent): void {
    let protocol = Protocol.load(PROTOCOL_ID);
    const blockNumber = event.block.number;

    // Create protocol if it doens't exist
    if (protocol == null) {
        protocol = createProtocol(event.params.newPriceOracle, blockNumber);
    }

    protocol.priceOracle = event.params.newPriceOracle;
    protocol.lastNewOracleBlockNumber = blockNumber;
    protocol.save();
}

/**
 * Emitted when a user decides to use this market as collatoral
 */
export function handleMarketEntered(event: MarketEnteredEvent): void {
    const marketAddress = event.params.cToken;
    const userAddress = event.params.account;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());
    let user = User.load(userAddress);

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleMarketEntered()", []);
        return;
    }

    // Create user if it doesn't exist
    if (user == null) {
        user = createUser(userAddress, blockNumber);
        user.save();
    }

    const userMarketId = market.id + user.id.toHexString();

    let userMarket = UserMarket.load(userMarketId);

    // Create marketUser if it doesn't exist
    if (userMarket == null) {
        userMarket = createUserMarket(userAddress, marketAddress, blockNumber);
    }

    userMarket.enteredMarket = true;

    userMarket.save();
}

/**
 * Emitted when a user decides to stop using this market as collatoral
 */
export function handleMarketExited(event: MarketExitedEvent): void {
    const marketAddress = event.address;
    const userAddress = event.params.account;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());
    let user = User.load(userAddress);

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleMarketEntered()", []);
        return;
    }

    // Create user if it doesn't exist
    if (user == null) {
        user = createUser(userAddress, blockNumber);
        user.save();
    }

    const userMarketId = market.id + user.id.toHexString();

    let userMarket = UserMarket.load(userMarketId);

    // Create marketUser if it doesn't exist
    if (userMarket == null) {
        userMarket = createUserMarket(userAddress, marketAddress, blockNumber);
    }

    userMarket.enteredMarket = false;

    userMarket.save();
}
