import {
    Address,
    BigDecimal,
    BigInt,
    ByteArray,
    Bytes,
    log,
} from "@graphprotocol/graph-ts";

import { Market } from "../generated/schema";
import { CToken } from "../generated/templates/cToken/cToken";
import { ERC20 } from "../generated/templates/cToken/ERC20";

import { ETH_ADDRESS, CETH_ADDRESS, ZERO_BI, ZERO_BD } from "./constants";

/**
 * Helper function to create a new market. This populates all fields which won't change throughout the lifetime of the market
 * @param marketAddress address of the cToken corresponding to the market
 * @param blockNumber block number when the new market got created
 * @returns a new Market object
 */
export function createMarket(
    marketAddress: Address,
    blockNumber: BigInt
): Market {
    let market: Market;
    const contract = CToken.bind(marketAddress);

    market = new Market(marketAddress.toHexString());
    market.creationBlockNumber = blockNumber;
    market.latestBlockNumber = blockNumber;
    market.cTokenSymbol = contract.symbol();
    market.cTokenDecimals = BigInt.fromI32(contract.decimals());

    if (CETH_ADDRESS == marketAddress.toHexString()) {
        // cETH has a different interface
        market.underlyingName = "Ether";
        market.underlyingSymbol = "ETH";
        market.underlyingAddress = Address.fromString(ETH_ADDRESS);
        market.underlyingDecimals = BigInt.fromI32(18);
    } else {
        // any other cToken besides cETH
        const underlyingAddress = contract.underlying();
        const underlyingContract = ERC20.bind(underlyingAddress);
        market.underlyingAddress = underlyingAddress;
        market.underlyingName = underlyingContract.name();
        market.underlyingSymbol = underlyingContract.symbol();
        market.underlyingDecimals = BigInt.fromI32(
            underlyingContract.decimals()
        );
    }

    market.collatoralFactor = ZERO_BD;
    market.reserveFactor = ZERO_BD;
    market.cash = ZERO_BD;
    market.exchangeRate = ZERO_BD;
    market.supplyRate = ZERO_BI;
    market.borrowRate = ZERO_BI;
    market.supplyApy = ZERO_BD;
    market.borrowApy = ZERO_BD;
    market.totalSupplyApy = ZERO_BD;
    market.totalBorrowApy = ZERO_BD;
    market.totalSupply = ZERO_BD;
    market.totalBorrow = ZERO_BD;
    market.totalReserves = ZERO_BD;
    market.utalization = ZERO_BD;
    market.numberOfSuppliers = ZERO_BI;
    market.numberOfborrowers = ZERO_BI;
    market.usdcPerUnderlying = ZERO_BD;

    return market;
}

/**
 * Helper function to update the market
 * @param marketAddress address of the cToken corresponding to the market
 * @param blockNumber block number that this function is being called
 * @returns the updated Market object
 */
export function updateMarket(marketAddress: Address, blockNumber: BigInt) {
    let market = Market.load(marketAddress.toHexString());

    // Only update if the market exists, and it hasn't been updated on this block yet
    if (market != null && market.latestBlockNumber != blockNumber) {
        let contractAddress = Address.fromString(market.id);
        let contract = CToken.bind(contractAddress);

        // After block 10678764 price is calculated based on USD instead of ETH
        // if (blockNumber.gt(BigInt.fromU64(10678764))) {
        //     let ethPriceInUSD = getETHinUSD(blockNumber);

        //     // if cETH, we only update USD price
        //     if (market.id == cETHAddress) {
        //         market.underlyingPriceUSD = ethPriceInUSD.truncate(
        //             market.underlyingDecimals
        //         );
        //     } else {
        //         let tokenPriceUSD = getTokenPrice(
        //             blockNumber,
        //             contractAddress,
        //             market.underlyingAddress as Address,
        //             market.underlyingDecimals
        //         );
        //         market.underlyingPrice = tokenPriceUSD
        //             .div(ethPriceInUSD)
        //             .truncate(market.underlyingDecimals);
        //         // if USDC, we only update ETH price
        //         if (market.id != cUSDCAddress) {
        //             market.underlyingPriceUSD = tokenPriceUSD.truncate(
        //                 market.underlyingDecimals
        //             );
        //         }
        //     }
        // } else {
        //     let usdPriceInEth = getUSDCpriceETH(blockNumber);

        //     // if cETH, we only update USD price
        //     if (market.id == cETHAddress) {
        //         market.underlyingPriceUSD = market.underlyingPrice
        //             .div(usdPriceInEth)
        //             .truncate(market.underlyingDecimals);
        //     } else {
        //         let tokenPriceEth = getTokenPrice(
        //             blockNumber,
        //             contractAddress,
        //             market.underlyingAddress as Address,
        //             market.underlyingDecimals
        //         );
        //         market.underlyingPrice = tokenPriceEth.truncate(
        //             market.underlyingDecimals
        //         );
        //         // if USDC, we only update ETH price
        //         if (market.id != cUSDCAddress) {
        //             market.underlyingPriceUSD = market.underlyingPrice
        //                 .div(usdPriceInEth)
        //                 .truncate(market.underlyingDecimals);
        //         }
        //     }
        // }

        market.latestBlockNumber = contract.accrualBlockNumber();
        market.totalSupply = contract
            .totalSupply()
            .toBigDecimal()
            .div(market.cTokenDecimals.toBigDecimal());

        /* Exchange rate explanation
           In Practice
            - If you call the cDAI contract on etherscan it comes back (2.0 * 10^26)
            - If you call the cUSDC contract on etherscan it comes back (2.0 * 10^14)
            - The real value is ~0.02. So cDAI is off by 10^28, and cUSDC 10^16
           How to calculate for tokens with different decimals
            - Must div by tokenDecimals, 10^market.underlyingDecimals
            - Must multiply by ctokenDecimals, 10^8
            - Must div by mantissa, 10^18
         */
        // market.exchangeRate = contract
        //     .exchangeRateStored()
        //     .toBigDecimal()
        //     .div(exponentToBigDecimal(market.underlyingDecimals))
        //     .times(cTokenDecimalsBD)
        //     .div(mantissaFactorBD)
        //     .truncate(mantissaFactor);
        // market.borrowIndex = contract
        //     .borrowIndex()
        //     .toBigDecimal()
        //     .div(mantissaFactorBD)
        //     .truncate(mantissaFactor);

        // market.reserves = contract
        //     .totalReserves()
        //     .toBigDecimal()
        //     .div(exponentToBigDecimal(market.underlyingDecimals))
        //     .truncate(market.underlyingDecimals);
        // market.totalBorrows = contract
        //     .totalBorrows()
        //     .toBigDecimal()
        //     .div(exponentToBigDecimal(market.underlyingDecimals))
        //     .truncate(market.underlyingDecimals);
        // market.cash = contract
        //     .getCash()
        //     .toBigDecimal()
        //     .div(exponentToBigDecimal(market.underlyingDecimals))
        //     .truncate(market.underlyingDecimals);

        // Must convert to BigDecimal, and remove 10^18 that is used for Exp in Compound Solidity
        // market.borrowRate = contract
        //     .borrowRatePerBlock()
        //     .toBigDecimal()
        //     .times(BigDecimal.fromString("2102400"))
        //     .div(mantissaFactorBD)
        //     .truncate(mantissaFactor);

        // This fails on only the first call to cZRX. It is unclear why, but otherwise it works.
        // So we handle it like this.
        // let supplyRatePerBlock = contract.try_supplyRatePerBlock();
        // if (supplyRatePerBlock.reverted) {
        //     log.info(
        //         "***CALL FAILED*** : cERC20 supplyRatePerBlock() reverted",
        //         []
        //     );
        //     market.supplyRate = zeroBD;
        // } else {
        //     market.supplyRate = supplyRatePerBlock.value
        //         .toBigDecimal()
        //         .times(BigDecimal.fromString("2102400"))
        //         .div(mantissaFactorBD)
        //         .truncate(mantissaFactor);
        // }
        market.save();
    }
}
