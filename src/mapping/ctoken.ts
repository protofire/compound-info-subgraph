import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";
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
} from "../../generated/templates/cToken/cToken";

import { Market, User, UserMarket, Mint, Redeem, Borrow, RepayBorrow, Transfer, Liquidation} from "../../generated/schema";


import { updateMarket } from "../mapping-helpers/market";
import { createUser } from "../mapping-helpers/user";
import { updateProtocolSummaryData } from "../mapping-helpers/protocol";
import {
    updateMarketDayData,
    updateMarketHourData,
    updateMarketWeekData,
    updateProtocolWeekData,
} from "../mapping-helpers/historical-data";
import { createUserMarket } from "../mapping-helpers/userMarket";
import { tokenAmountToDecimal } from "../utils/utils";
import { GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER } from "../utils/constants";


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

export function handleApproval(event: ApprovalEvent): void {
    const userAddress = event.params.owner;
    const marketAddress = event.params.spender;
    const blockNumber = event.block.number;

    let user = User.load(userAddress.toHexString());
    let market = Market.load(marketAddress.toHexString());

    if(market == null) {
        // Won't happen
        log.warning("*** ERROR: market was null in handleApproval()", []);
        return;
    }

    // Create user if they don't exist already
    if(user == null) {
        user = createUser(userAddress, blockNumber);
        user.save();
    }

    const userMarketId = market.id + user.id;

    let userMarket = UserMarket.load(userMarketId);

    // Create marketUser if it doesn't exist
    if(userMarket == null) {
        userMarket = createUserMarket(userAddress, marketAddress, blockNumber)
    }

    userMarket.approvalAmount = tokenAmountToDecimal(event.params.amount, market.underlyingDecimals);
    userMarket.latestBlockNumber = event.block.number;

    userMarket.save();
}

/**
 * Emitted when a user supplies a token to a market
 * cTokens are minted and given to the supplier 
 * Also emits a transfer right after
 */
export function handleMint(event: MintEvent): void {
    const userAddress = event.params.minter;
    const marketAddress = event.address;

    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();

    const market = Market.load(marketAddress.toHexString());
    const userMarket = UserMarket.load(userMarketId);

    if(market == null || userMarket == null) {
       // Won't happen
       log.warning("*** ERROR: market or userMarket was null in handleMint()", []);
       return; 
    }

    // The user and userMarket will already exists
    // because the user would have needed to approve first and handleApproval creates these

    // Create mint event
    const mint = new Mint(event.transaction.hash.toString());
    mint.blockNumber = event.block.number;
    mint.date = event.block.timestamp;
    mint.userMarket = userMarket.id;
    mint.underlyingAmount = tokenAmountToDecimal(event.params.mintAmount, market.underlyingDecimals); 
    mint.cTokenAmount = tokenAmountToDecimal(event.params.mintTokens, market.cTokenDecimals);

    // Update user market summary stats
    userMarket.cTokenBalance = userMarket.cTokenBalance.plus(mint.cTokenAmount);
    userMarket.totalSupply = userMarket.totalSupply.plus(mint.underlyingAmount);
    userMarket.latestBlockNumber = event.block.number;

    userMarket.save();
    mint.save();
}

/**
 * Emitted when a user redeems cTokens for the underlying token
 * Also emits a transfer event right before
 */
export function handleRedeem(event: RedeemEvent): void {
    const userAddress = event.params.redeemer;
    const marketAddress = event.address;

    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();

    const market = Market.load(marketAddress.toHexString());
    const userMarket = UserMarket.load(userMarketId);

    if(market == null || userMarket == null) {
       // Won't happen
       log.warning("*** ERROR: market or userMarket was null in handleRedeem()", []);
       return; 
    }

    // The user and userMarket will already exist because the user got cTokens in one of 2 ways
    //     1. calling mint function, which already gaurentees they exist through approval
    //     2. getting transfered it, and handleTransfer creates the user and userMarket if it doesn't exist

    // Create redeem event
    const redeem = new Redeem(event.transaction.hash.toString());
    redeem.blockNumber = event.block.number;
    redeem.date = event.block.timestamp;
    redeem.userMarket = userMarketId;
    redeem.underlyingAmount = tokenAmountToDecimal(event.params.redeemAmount, market.underlyingDecimals); 
    redeem.cTokenAmount = tokenAmountToDecimal(event.params.redeemTokens, market.cTokenDecimals);

    // Update userMarket summary states
    userMarket.totalSupply = userMarket.totalSupply.minus(redeem.underlyingAmount);
    userMarket.cTokenBalance = userMarket.cTokenBalance.minus(redeem.cTokenAmount);
    userMarket.latestBlockNumber = event.block.number;

    userMarket.save();
    redeem.save();
}

/**
 * Emitted when a user borrows a token 
 */
export function handleBorrow(event: BorrowEvent): void {
    const userAddress = event.params.borrower;
    const marketAddress = event.address;

    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();

    const market = Market.load(marketAddress.toHexString());
    const userMarket = UserMarket.load(userMarketId);

    if(market == null || userMarket == null) {
       // Won't happen
       log.warning("*** ERROR: market or userMarket was null in handleBorrow()", []);
       return; 
    }

    // user would already exist becuase they would have needed to mint first

    // Create borrow event
    const borrow = new Borrow(event.transaction.hash.toString());
    borrow.blockNumber = event.block.number;
    borrow.date = event.block.timestamp;
    borrow.userMarket = userMarketId;
    borrow.underlyingAmount = tokenAmountToDecimal(event.params.borrowAmount, market.underlyingDecimals); 

    // Update userMarket summary states
    userMarket.totalBorrow = userMarket.totalBorrow.plus(borrow.underlyingAmount);
    userMarket.latestBlockNumber = event.block.number;

    userMarket.save();
    borrow.save();
}

/**
 * Emmiteed when a user repays their borrow 
 */
export function handleRepayBorrow(event: RepayBorrowEvent): void {
    const userAddress = event.params.borrower;
    const marketAddress = event.address;

    const userMarketId = userAddress.toHexString() + marketAddress.toHexString();

    const market = Market.load(marketAddress.toHexString());
    const userMarket = UserMarket.load(userMarketId);

    if(market == null || userMarket == null) {
       // Won't happen
       log.warning("*** ERROR: market or userMarket was null in handleBorrow()", []);
       return; 
    }

    // user would already exist becuase they would have needed to borrow first

    // Create borrow event
    const repayBorrow = new RepayBorrow(event.transaction.hash.toString());
    repayBorrow.blockNumber = event.block.number;
    repayBorrow.date = event.block.timestamp;
    repayBorrow.userMarket = userMarketId;
    repayBorrow.underlyingAmount = tokenAmountToDecimal(event.params.repayAmount, market.underlyingDecimals); 

    // Update userMarket summary states
    userMarket.totalBorrow = userMarket.totalBorrow.minus(repayBorrow.underlyingAmount);
    userMarket.latestBlockNumber = event.block.number;

    userMarket.save();
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

    const borrowerUserLiquidationMarketId = borrowerAddress.toHexString() + liquidationMarketAddress.toHexString();
    const borrowerUserSeizeMarketId = borrowerAddress.toHexString() + seizeMarketAddress.toHexString();
    const liquidatorUserMarketId = liquidatorAddress.toHexString() + seizeMarketAddress.toHexString();
    
    const liquidationMarket = Market.load(liquidationMarketAddress.toHexString());
    const seizeMarket = Market.load(seizeMarketAddress.toHexString());
    const borrowerUserLiquidationMarket = UserMarket.load(borrowerUserLiquidationMarketId);
    const borrowerUserSeizeMarket = UserMarket.load(borrowerUserSeizeMarketId);

    if(liquidationMarket == null || seizeMarket == null || borrowerUserLiquidationMarket == null || borrowerUserSeizeMarket == null) {
       // Won't happen
       log.warning("*** ERROR: liquidationMarket or seizeMarket or borrowerUserLiquidationMarket or borrowerUserSeizeMarket was null in handleLiquidateBorrow()", []);
       return; 
    }

    let liquidatorUserMarket = UserMarket.load(liquidatorUserMarketId);

    // It is possible for the liquidator user, and userMarket to not exist yet. Create them if so
    if (liquidatorUserMarket == null) {
        let liquidatorUser = User.load(liquidatorAddress.toHexString());

        if(liquidatorUser == null) {
            // Create liquidator user if it doesn't exist
            liquidatorUser = createUser(liquidatorAddress, blockNumber);
            liquidatorUser.save();
        }

        liquidatorUserMarket = createUserMarket(liquidatorAddress, seizeMarketAddress, blockNumber);
    }

    // borrower user would already exist becuase they would have needed to borrow first

    // Create liquidation event
    const liquidation = new Liquidation(event.transaction.hash.toString());
    liquidation.blockNumber = event.block.number;
    liquidation.date = event.block.timestamp;
    liquidation.borrowerUserLiquidationMarket = borrowerUserLiquidationMarket.id;
    liquidation.borrowerUserSeizeMarket = borrowerUserSeizeMarket.id;
    liquidation.liquidatorUserMarket = liquidatorUserMarket.id;
    liquidation.repayAmount = tokenAmountToDecimal(event.params.repayAmount, liquidationMarket.underlyingDecimals);
    liquidation.seizeAmount = tokenAmountToDecimal(event.params.seizeTokens, seizeMarket.cTokenDecimals) ;

    // Update userMarket summary states
    borrowerUserLiquidationMarket.totalBorrow = borrowerUserLiquidationMarket.totalBorrow.minus(liquidation.repayAmount);
    borrowerUserSeizeMarket.cTokenBalance = borrowerUserSeizeMarket.cTokenBalance.minus(liquidation.seizeAmount);
    liquidatorUserMarket.cTokenBalance = liquidatorUserMarket.cTokenBalance.plus(liquidation.seizeAmount)

    borrowerUserLiquidationMarket.save();
    borrowerUserSeizeMarket.save();
    liquidatorUserMarket.save();
    liquidation.save();
}

/**
 * Transfer event is called anyime a cToken is transfered: mint, redeem, liquidation, and a transfer from wallet to wallet
 * We care only about wallet to wallet transfer, the rest are captured in their respective handler 
 */
export function handleTransfer(event: TransferEvent): void {
    // TODO: create user and userMarket for the transfer to wallet if it doesn't exist. This is the only other way besides approve 
}
