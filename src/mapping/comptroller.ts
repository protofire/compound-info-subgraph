import { Address } from "@graphprotocol/graph-ts";

import {
    MarketListed as MarketListedEvent,
    NewPriceOracle as NewPriceOracleEvent,
} from "../../generated/comptroller/comptroller";
import { Protocol } from "../../generated/schema";
import { CToken as CTokenTemplate } from "../../generated/templates";

import { createMarket } from "../mapping-helpers/market";
import { createProtocol } from "../mapping-helpers/protocol";
import {
    PROTOCOL_ID,
    PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER,
    PRICE_ORACLE_1_ADDRESS,
} from "../utils/constants";

export function handleMarketListed(event: MarketListedEvent): void {
    const cTokenAddress = event.params.cToken;
    const blockNumber = event.block.number;

    // Dynamically create cToken data source
    CTokenTemplate.create(event.params.cToken);

    // Create the protocol if it doesn't exist, this is just here for easier testing.
    // TODO: remove later
    let protocol = Protocol.load(PROTOCOL_ID);
    if (protocol == null) {
        let oracleAddress = PRICE_ORACLE_1_ADDRESS;
        if (event.block.number.gt(PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER)) {
            oracleAddress = "0x6d2299c48a8dd07a872fdd0f8233924872ad1071 "; // hard coded price oracle 2 address
        }

        protocol = createProtocol(
            Address.fromString(oracleAddress),
            blockNumber
        );
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
