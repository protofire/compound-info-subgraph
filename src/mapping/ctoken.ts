import {
    Mint as MintEvent,
    Redeem as RedeemEvent,
    Borrow as BorrowEvent,
    RepayBorrow as RepayBorrowEvent,
    LiquidateBorrow as LiquidateBorrowEvent,
    AccrueInterest as AccrueInterestEventOld,
    AccrueInterest as AccrueInterestEvent,
    NewReserveFactor as NewReserveFactorEvent,
    Transfer as TransferEvent,
} from "../../generated/templates/cToken/cToken";

import { updateMarket } from "../mapping-helpers/market";
import { updateProtocolSummaryData } from "../mapping-helpers/protocol";
import {
    updateMarketDayData,
    updateMarketHourData,
    updateMarketWeekData,
    updateProtocolWeekData,
} from "../mapping-helpers/historical-data";


/**
 * This interface for accrue interest was used for ETH, USDC, WBTC, ZRX and BATT
 */
export function handleAccrueInterestOld(event: AccrueInterestEventOld): void {
    updateMarket(event.address, event.block.number);
    updateProtocolSummaryData(event.block.number);

    // Update historical data after updateMarket and updateProtocolSummaryData is called
    updateMarketHourData(event);
    updateMarketDayData(event);
    updateMarketWeekData(event);
    updateProtocolWeekData(event);
}

/**
 * After ETH, USDC, WBTC, ZRX and BATT, the accrue interest function changed
 */
export function handleAccrueInterest(event: AccrueInterestEvent): void {
    updateMarket(event.address, event.block.number);
    updateProtocolSummaryData(event.block.number);

    // Update historical data after updateMarket and updateProtocolSummaryData is called
    updateMarketHourData(event);
    updateMarketDayData(event);
    updateMarketWeekData(event);
    updateProtocolWeekData(event);
}

/**
 * Emitted when a user supplies a token to a market
 * cTokens are minted and given to the supplier 
 * Also emits a transfer right after
 */
export function handleMint(event: MintEvent): void {

}

/**
 * Emitted when a user redeems cTokens for the underlying token
 * Also emits a transfer event right before
 */
export function handleRedeem(event: RedeemEvent): void {}

/**
 * Emitted when a user borrows a token 
 */
export function handleBorrow(event: BorrowEvent): void {}

/**
 * Emmiteed when a user repays their borrow 
 */
export function handleRepayBorrow(event: RepayBorrowEvent): void {}

/**
 * Emitted when a user is liquidated
 * @param LiquidateBorrowEvent.borrower The borrower of this cToken to be liquidated
 * @param LiquidateBorrowEvent.liqidator The address repaying the borrow and seizing collateral
 * @param LiquidateBorrowEvent.cTokenCollateral The market in which to seize collateral from the borrower
 * @param LiquidateBorrowEvent.repayAmount The amount of the underlying borrowed asset to repay
 */
export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {}

export function handleTransfer(event: TransferEvent): void {}
