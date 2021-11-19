import { Address, BigInt, log } from "@graphprotocol/graph-ts";

import { Protocol, Market } from "../../generated/schema";

import { PROTOCOL_ID, ZERO_BD } from "../utils/constants";

/**
 * Helper function to create a new protocol
 * @param priceOracleAddress address of the cToken corresponding to the market
 * @param blockNumber block number when this was created
 * @returns a new Market object
 */
export function createProtocol(
    priceOracleAddress: Address,
    blockNumber: BigInt
): Protocol {
    let protocol = new Protocol(PROTOCOL_ID);

    protocol.priceOracle = priceOracleAddress;
    protocol.lastNewOracleBlockNumber = blockNumber;
    protocol.latestBlockNumber = blockNumber;

    protocol.markets = [];
    protocol.totalSupplyUsd = ZERO_BD;
    protocol.totalBorrowUsd = ZERO_BD;
    protocol.totalReservesUsd = ZERO_BD;
    protocol.utalization = ZERO_BD;

    return protocol;
}

/**
 * Helper function to update the protocol summary data, this will save it if successful
 * @param blockNumber block number that this function is being called
 */
export function updateProtocolSummaryData(blockNumber: BigInt): void {
    let protocol = Protocol.load(PROTOCOL_ID);

    if (protocol == null) {
        log.warning(
            "*** ERROR: protocol was null in updateProtocolSummaryData()",
            []
        );
        return;
    }

    protocol.latestBlockNumber = blockNumber;

    const marketsIds = protocol.markets;
    const numMarkets = marketsIds.length;

    let totalSupplyUsd = ZERO_BD;
    let totalBorrowUsd = ZERO_BD;
    let totalReservesUsd = ZERO_BD;

    for (let i = 0; i < numMarkets; i++) {
        const marketId = marketsIds[i];
        const market = Market.load(marketId);

        if (market != null) {
            const usdcPerUnderlying = market.usdcPerUnderlying;

            totalSupplyUsd = totalSupplyUsd.plus(
                market.totalSupply.times(usdcPerUnderlying)
            );
            totalBorrowUsd = totalBorrowUsd.plus(
                market.totalBorrow.times(usdcPerUnderlying)
            );
            totalReservesUsd = totalReservesUsd.plus(
                market.totalReserves.times(usdcPerUnderlying)
            );
            totalSupplyUsd = totalSupplyUsd.plus(
                market.totalSupply.times(usdcPerUnderlying)
            );
        } else {
            // Won't happen
            log.warning(
                "*** ERROR: a market was null in the loop of updateProtocolSummaryData()",
                []
            );
        }
    }

    let utalization = totalSupplyUsd.equals(ZERO_BD)
        ? ZERO_BD
        : totalBorrowUsd.div(totalSupplyUsd);

    protocol.totalSupplyUsd = totalSupplyUsd;
    protocol.totalBorrowUsd = totalBorrowUsd;
    protocol.totalReservesUsd = totalReservesUsd;
    protocol.utalization = utalization;

    protocol.save();
}
