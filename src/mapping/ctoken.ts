import { Address, BigInt, BigDecimal, log, bigDecimal } from "@graphprotocol/graph-ts";
import {
    Approval as ApprovalEvent,
    Mint as MintEvent,
    Redeem as RedeemEvent,
    Borrow as BorrowEvent,
    RepayBorrow as RepayBorrowEvent,
    LiquidateBorrow as LiquidateBorrowEvent,
    AccrueInterest as AccrueInterestEventOld,
    AccrueInterest as AccrueInterestEvent,
    NewReserveFactor as NewReserveFactorEvent,
    Transfer as TransferEvent,
} from "../../generated/templates/CToken/CToken";

import {
    Market,
    User,
    UserMarket,
    Mint,
    Redeem,
    Borrow,
    RepayBorrow,
    Transfer,
    Liquidation,
} from "../../generated/schema";

import { updateMarket } from "../mapping-helpers/market";
import { createUser, updateUserAggregates } from "../mapping-helpers/user";
import { updateProtocolSummaryData } from "../mapping-helpers/protocol";
import {
    updateMarketDayData,
    updateMarketHourData,
    updateMarketWeekData,
    updateProtocolWeekData,
} from "../mapping-helpers/historical-data";
import { createUserMarket, updateUserMarketBalance } from "../mapping-helpers/userMarket";
import { maxBigDecimal, tokenAmountToDecimal } from "../utils/utils";
import {
    GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER,
    PRICE_ORACLE_1_ADDRESS,
    ZERO_BD,
} from "../utils/constants";

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
    const userAddress = event.params.minter;
    const marketAddress = event.address;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleMint()", []);
        return;
    }

    // Update balances, this will also create the user and userMarket if they don't exist already
    updateUserMarketBalance(userAddress, marketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(userAddress);

    // Create mint event
    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();
    const mint = new Mint(event.transaction.hash);
    mint.blockNumber = blockNumber;
    mint.date = event.block.timestamp;
    mint.userMarket = userMarketId;
    mint.underlyingAmount = tokenAmountToDecimal(event.params.mintAmount, market.underlyingDecimals);
    mint.cTokenAmount = tokenAmountToDecimal(event.params.mintTokens, market.cTokenDecimals);

    mint.save();
}

/**
 * Emitted when a user redeems cTokens for the underlying token
 * Also emits a transfer event right before
 */
export function handleRedeem(event: RedeemEvent): void {
    const userAddress = event.params.redeemer;
    const marketAddress = event.address;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleMint()", []);
        return;
    }

    // Update balances, this will also create the user and userMarket if they don't exist already
    updateUserMarketBalance(userAddress, marketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(userAddress);

    // Create redeem event
    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();
    const redeem = new Redeem(event.transaction.hash);
    redeem.blockNumber = blockNumber;
    redeem.date = event.block.timestamp;
    redeem.userMarket = userMarketId;
    redeem.underlyingAmount = tokenAmountToDecimal(event.params.redeemAmount, market.underlyingDecimals);
    redeem.cTokenAmount = tokenAmountToDecimal(event.params.redeemTokens, market.cTokenDecimals);

    redeem.save();
}

/**
 * Emitted when a user borrows a token
 */
export function handleBorrow(event: BorrowEvent): void {
    const userAddress = event.params.borrower;
    const marketAddress = event.address;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleBorrow()", []);
        return;
    }

    // Update balances, this will also create the user and userMarket if they don't exist already
    updateUserMarketBalance(userAddress, marketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(userAddress);

    // Create borrow event
    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();
    const borrow = new Borrow(event.transaction.hash);
    borrow.blockNumber = blockNumber;
    borrow.date = event.block.timestamp;
    borrow.userMarket = userMarketId;
    borrow.underlyingAmount = tokenAmountToDecimal(event.params.borrowAmount, market.underlyingDecimals);

    borrow.save();
}

/**
 * Emmiteed when a user repays their borrow
 */
export function handleRepayBorrow(event: RepayBorrowEvent): void {
    const userAddress = event.params.borrower;
    const marketAddress = event.address;
    const blockNumber = event.block.number;

    const market = Market.load(marketAddress.toHexString());

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleBorrow()", []);
        return;
    }

    // Update balances, this will also create the user and userMarket if they don't exist already
    updateUserMarketBalance(userAddress, marketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(userAddress);

    // Create repay borrow event
    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();
    const repayBorrow = new RepayBorrow(event.transaction.hash);
    repayBorrow.blockNumber = event.block.number;
    repayBorrow.date = event.block.timestamp;
    repayBorrow.userMarket = userMarketId;
    repayBorrow.underlyingAmount = tokenAmountToDecimal(event.params.repayAmount, market.underlyingDecimals);

    repayBorrow.save();
}

/**
 * Emitted when a user is liquidated
 * @param LiquidateBorrowEvent.borrower The borrower of this cToken to be liquidated
 * @param LiquidateBorrowEvent.liqidator The address repaying the borrow and seizing collateral
 * @param LiquidateBorrowEvent.cTokenCollateral The market in which to seize collateral from the borrower
 * @param LiquidateBorrowEvent.repayAmount The amount of the underlying borrowed asset to repay
 */
export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {
    const borrowerAddress = event.params.borrower;
    const liquidatorAddress = event.params.liquidator;
    const liquidationMarketAddress = event.address;
    const seizeMarketAddress = event.params.cTokenCollateral;
    const blockNumber = event.block.number;

    const seizeMarket = Market.load(seizeMarketAddress.toHexString());
    const liquidationMarket = Market.load(liquidationMarketAddress.toHexString());

    if (liquidationMarket == null || seizeMarket == null) {
        // Won't happen
        log.warning("*** ERROR: liquidationMarket or seizeMarket was null in handleLiquidateBorrow()", []);
        return;
    }

    // these also create the user and userMarket if they don't exist
    // Borrower got liquidated, the totalBorrow for this userMarket will decreace.
    updateUserMarketBalance(borrowerAddress, liquidationMarketAddress, blockNumber);
    // Borrower got seized, the cTokenBalance for this userMarket will decrease
    updateUserMarketBalance(borrowerAddress, seizeMarketAddress, blockNumber);
    // Liquidator got the seized cTokens, the cTokenBalance for this userMarket will increase
    updateUserMarketBalance(liquidatorAddress, seizeMarketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(borrowerAddress);
    updateUserAggregates(liquidatorAddress);

    // Create liquidation event
    const borrowerUserLiquidationMarketId = borrowerAddress.toHexString() + liquidationMarketAddress.toHexString();
    const borrowerUserSeizeMarketId = borrowerAddress.toHexString() + seizeMarketAddress.toHexString();
    const liquidatorUserMarketId = liquidatorAddress.toHexString() + seizeMarketAddress.toHexString();
    const liquidation = new Liquidation(event.transaction.hash);
    liquidation.blockNumber = blockNumber;
    liquidation.date = event.block.timestamp;
    liquidation.borrowerUserLiquidationMarket = borrowerUserLiquidationMarketId;
    liquidation.borrowerUserSeizeMarket = borrowerUserSeizeMarketId;
    liquidation.liquidatorUserMarket = liquidatorUserMarketId;
    liquidation.repayAmount = tokenAmountToDecimal(event.params.repayAmount, liquidationMarket.underlyingDecimals);
    liquidation.seizeAmount = tokenAmountToDecimal(event.params.seizeTokens, seizeMarket.cTokenDecimals);

    liquidation.save();
}

/**
 * Transfer event is called anyime a cToken is transfered: mint, redeem, liquidation, and a transfer from wallet to wallet
 * We care only about wallet to wallet transfer, the rest are captured in their respective handler
 * Event orders:
 *     * mint: accrueInterest -> mint -> transfer
 *     * redeem: accrueInterest -> transfer -> redeem
 *     * liquidation: accrueInterest -> transfer(borrower, liq) -> transfer(borrower, market) -> seize -> liquidateBorrow
 *             the borrower -> liqudator transaction is also condidered a transfer
 *     * transfer: transfer
 */
export function handleTransfer(event: TransferEvent): void {
    const marketAddress = event.address;
    const fromAddress = event.params.from;
    const toAddress = event.params.to;
    const blockNumber = event.block.number;

    // Corner case is if the user trasnfers funds directly to cToken address by accident
    if (fromAddress == marketAddress || toAddress == marketAddress) {
        return;
    }

    const market = Market.load(marketAddress.toHexString());

    if (market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleTransfer()", []);
        return;
    }

    // Update balances, this will also create the user and userMarket if they don't exist already
    updateUserMarketBalance(fromAddress, marketAddress, blockNumber);
    updateUserMarketBalance(toAddress, marketAddress, blockNumber);

    // Update the user aggregates after the UserMarket has been updated
    updateUserAggregates(fromAddress);
    updateUserAggregates(toAddress);

    // Create transfer event
    const fromUserMarketId = fromAddress.toHexString() + marketAddress.toHexString();
    const toUserMarketId = toAddress.toHexString() + marketAddress.toHexString();
    const transfer = new Transfer(event.transaction.hash);
    transfer.blockNumber = blockNumber;
    transfer.date = event.block.timestamp;
    transfer.fromUserMarket = fromUserMarketId;
    transfer.toUserMarket = toUserMarketId;
    transfer.cTokenAmount = tokenAmountToDecimal(event.params.amount, market.cTokenDecimals);

    transfer.save();

    // accrueInterest wasn't called, so update market and protocol
    updateMarket(event.address, event.block.number);
    updateProtocolSummaryData(event.block.number);

    // Update historical data after updateMarket and updateProtocolSummaryData is called
    updateMarketHourData(event);
    updateMarketDayData(event);
    updateMarketWeekData(event);
    updateProtocolWeekData(event);
}
