import {
    Mint as MintEvent,
    Redeem as RedeemEvent,
    Borrow as BorrowEvent,
    RepayBorrow as RepayBorrowEvent,
    LiquidateBorrow as LiquidateBorrowEvent,
    AccrueInterest as AccrueInterestEvent,
    NewReserveFactor as NewReserveFactorEvent,
} from "../../generated/templates/cToken/cToken";
import { Market } from "../../generated/schema";

import { exponentToBigDecimal } from "../utils";
import { updateMarket } from "../market";

export function handleMint(event: MintEvent): void {
    const cTokenAddress = event.address;
    const blockNumber = event.block.number;

    updateMarket(cTokenAddress, blockNumber);
}

export function handleRedeem(event: RedeemEvent): void {
    // const cTokenAddress = event.address.toHexString();
    // const blockNumber = event.block.number;
    // const market = Market.load(cTokenAddress);
    // if (market == null) {
    //     return; // This won't happen
    // }
    // const underlyingRedeemAmount = convertTokenToDecimal(
    //     event.params.mintToken,
    //     market.underlyingDecimals
    // );
    // market.totalSupplied = market.totalSupplied.minus(underlyingRedeemAmount);
    // market.latestBlockNumber = blockNumber;
    // market.save();
}

export function handleBorrow(event: BorrowEvent): void {}

export function handleRepayBorrow(event: RepayBorrowEvent): void {}

export function handleLiquidateBorrow(event: LiquidateBorrowEvent): void {}

export function handleAccrueInterest(event: AccrueInterestEvent): void {}

export function handleNewReserveFactor(event: NewReserveFactorEvent): void {}
