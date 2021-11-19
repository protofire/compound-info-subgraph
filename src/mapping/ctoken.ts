import {
    Mint as MintEvent,
    Redeem as RedeemEvent,
    Borrow as BorrowEvent,
    RepayBorrow as RepayBorrowEvent,
    LiquidateBorrow as LiquidateBorrowEvent,
    AccrueInterest as AccrueInterestEvent,
    NewReserveFactor as NewReserveFactorEvent,
} from "../../generated/templates/cToken/cToken";

import { updateMarket } from "../mapping-helpers/market";
import { updateProtocolSummaryData } from "../mapping-helpers/protocol";
import {
    updateMarketDayData,
    updateMarketHourData,
    updateMarketWeekData,
    updateProtocolWeekData,
} from "../mapping-helpers/historical-data";

export function handleMint(event: MintEvent): void {}

export function handleAccrueInterest(event: AccrueInterestEvent): void {
    updateMarket(event.address, event.block.number);
    updateProtocolSummaryData(event.block.number);

    // Update historical data after updateMarket and updateProtocolSummaryData is called
    updateMarketHourData(event);
    updateMarketDayData(event);
    updateMarketWeekData(event);
    updateProtocolWeekData(event);
}

export function handleRedeem(event: RedeemEvent): void {}

export function handleBorrow(event: BorrowEvent): void {}

export function handleRepayBorrow(event: RepayBorrowEvent): void {}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {}

export function handleNewReserveFactor(event: NewReserveFactorEvent): void {}
