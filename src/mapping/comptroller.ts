import { BigDecimal } from "@graphprotocol/graph-ts";

import { MarketListed as MarketListedEvent } from "../../generated/comptroller/comptroller";
import { Market } from "../../generated/schema";
import { CToken as CTokenTemplate } from "../../generated/templates";

import { createMarket } from "../market";

export function handleMarketListed(event: MarketListedEvent): void {
    const cTokenAddress = event.params.cToken;
    const blockNumber = event.block.number;

    // Dynamically create cToken data source
    CTokenTemplate.create(event.params.cToken);

    const market = createMarket(cTokenAddress, blockNumber);
    market.save();
}
