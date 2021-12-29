import { Address, BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";

import { Market, Protocol } from "../../generated/schema";
import { CToken } from "../../generated/templates/cToken/cToken";
import { ERC20 } from "../../generated/templates/cToken/ERC20";
import { CERC20 } from "../../generated/templates/cToken/CERC20";
import { Comptroller } from "../../generated/comptroller/comptroller";

import {
    ETH_ADDRESS,
    CETH_ADDRESS,
    SAI_ADDRESS,
    COMP_ADDRESS,
    CCOMP_ADDRESS,
    ZERO_BD,
    MKR_ADDRESS,
    COMP_SPEED_SPLIT_BLOCK_NUMBER,
} from "../utils/constants";
import { getUsdcPerEth, getUsdcPerUnderlying } from "./oracle";
import {
    tokenAmountToDecimal,
    calculateApy,
    calculateCompDistrubtionApy,
} from "../utils/utils";

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
    log.info(`CREATING MARKET: ${marketAddress.toHexString()}`, []);

    const contract = CToken.bind(marketAddress);
    const market = new Market(marketAddress.toHexString());
    market.creationBlockNumber = blockNumber;
    market.latestBlockNumber = blockNumber;
    market.cTokenSymbol = contract.symbol();
    market.cTokenDecimals = BigInt.fromI32(contract.decimals());
    market.comptrollerAddress = contract.comptroller();

    if (CETH_ADDRESS == marketAddress.toHexString()) {
        // cETH has a different interface
        market.underlyingName = "Ether";
        market.underlyingSymbol = "ETH";
        market.underlyingAddress = Address.fromString(ETH_ADDRESS);
        market.underlyingDecimals = BigInt.fromI32(18);
    } else {
        // any other cToken besides cETH
        const cErc20Contract = CERC20.bind(marketAddress);
        const underlyingAddress = cErc20Contract.underlying();
        const underlyingContract = ERC20.bind(underlyingAddress);
        market.underlyingAddress = underlyingAddress;

        if (underlyingAddress.toHexString() == SAI_ADDRESS) {
            // SAI contract returns garbage for name and symbol
            market.underlyingName = "Sai Stablecoin v1.0 (SAI)";
            market.underlyingSymbol = "SAI";
        } else if (underlyingAddress.toHexString() == MKR_ADDRESS) {
            // MKR contract returns garbage for name and symbol
            market.underlyingName = "Maker token";
            market.underlyingSymbol = "MKR";
        } else {
            market.underlyingName = underlyingContract.name();
            market.underlyingSymbol = underlyingContract.symbol();
        }

        market.underlyingDecimals = BigInt.fromI32(
            underlyingContract.decimals()
        );
    }

    market.collateralFactor = ZERO_BD;
    market.reserveFactor = ZERO_BD;
    market.borrowCap = ZERO_BD;
    market.cash = ZERO_BD;
    market.underlyingPerCToken = ZERO_BD;
    market.supplyRatePerBlock = ZERO_BD;
    market.supplyRatePerBlock = ZERO_BD;
    market.supplyApy = ZERO_BD;
    market.borrowApy = ZERO_BD;
    market.totalSupplyApy = ZERO_BD;
    market.totalBorrowApy = ZERO_BD;
    market.totalSupply = ZERO_BD;
    market.totalSupplyUsd = ZERO_BD;
    market.totalBorrow = ZERO_BD;
    market.totalBorrowUsd = ZERO_BD;
    market.totalReserves = ZERO_BD;
    market.totalReservesUsd = ZERO_BD;
    market.availableLiquidity = ZERO_BD;
    market.availableLiquidityUsd = ZERO_BD;
    market.utilization = ZERO_BD;
    market.compSpeedSupply = ZERO_BD;
    market.compSpeedBorrow = ZERO_BD;
    market.usdcPerUnderlying = ZERO_BD;
    market.usdcPerEth = ZERO_BD;
    market.usdcPerComp = ZERO_BD;

    market.save();
    return market;
}

/**
 * Helper function to update the market, this will save it if successful
 * @param marketAddress address of the cToken corresponding to the market
 * @param blockNumber block number that this function is being called
 */
export function updateMarket(
    marketAddress: Address,
    blockNumber: BigInt
): void {
    let market = Market.load(marketAddress.toHexString());

    if (market == null) {
        log.warning("*** ERROR: market was null in updateMarket()", []);
        return;
    }

    // log.info(`UPDATING MARKET: ${market.underlyingSymbol}`, []);

    // Only update if it hasn't been updated on this block yet
    if (market.latestBlockNumber != blockNumber) {
        let contractAddress = Address.fromString(market.id);
        let contract = CToken.bind(contractAddress);

        market.latestBlockNumber = contract.accrualBlockNumber();

        // This must come before calling getUsdcPerUnderlying
        market.usdcPerEth = getUsdcPerEth(blockNumber);

        market.usdcPerUnderlying = getUsdcPerUnderlying(
            changetype<Address>(market.underlyingAddress),
            Address.fromString(market.id),
            market.underlyingDecimals,
            blockNumber,
            market.usdcPerEth
        );

        market.usdcPerComp = getUsdcPerUnderlying(
            Address.fromString(COMP_ADDRESS),
            Address.fromString(CCOMP_ADDRESS),
            BigInt.fromU32(18),
            blockNumber,
            market.usdcPerEth
        );

        // mantisa for this is 18 + underlying decimals - ctoken decimals, i.e the value is scaled by 10^18 in contract
        market.underlyingPerCToken = tokenAmountToDecimal(
            contract.exchangeRateStored(),
            BigInt.fromU32(18)
                .plus(market.underlyingDecimals)
                .minus(market.cTokenDecimals)
        );

        market.totalSupply = tokenAmountToDecimal(
            contract.totalSupply(),
            market.cTokenDecimals
        ).times(market.underlyingPerCToken);

        market.totalSupplyUsd = market.totalSupply.times(
            market.usdcPerUnderlying
        );

        market.totalReserves = tokenAmountToDecimal(
            contract.totalReserves(),
            market.underlyingDecimals
        );

        market.totalReservesUsd = market.totalReserves.times(
            market.usdcPerUnderlying
        );

        market.utilization = market.totalSupply.notEqual(ZERO_BD)
            ? market.totalBorrow.div(market.totalSupply)
            : ZERO_BD;

        market.totalBorrow = tokenAmountToDecimal(
            contract.totalBorrows(),
            market.underlyingDecimals
        );

        market.totalBorrowUsd = market.totalBorrow.times(
            market.usdcPerUnderlying
        );

        market.cash = tokenAmountToDecimal(
            contract.getCash(),
            market.underlyingDecimals
        );

        // Remove 10^18 that scales this value
        market.supplyRatePerBlock = tokenAmountToDecimal(
            contract.supplyRatePerBlock(),
            BigInt.fromU32(18)
        );

        // Remove 10^18 that scales this value
        market.borrowRatePerBlock = tokenAmountToDecimal(
            contract.borrowRatePerBlock(),
            BigInt.fromU32(18)
        );

        market.supplyApy = calculateApy(market.supplyRatePerBlock);
        market.borrowApy = calculateApy(market.borrowRatePerBlock);

        market.reserveFactor = tokenAmountToDecimal(
            contract.reserveFactorMantissa(),
            BigInt.fromU32(18)
        );

        market.comptrollerAddress = contract.comptroller();

        const comptrollerContract = Comptroller.bind(
            changetype<Address>(market.comptrollerAddress)
        );

        const tryMarkets = comptrollerContract.try_markets(contractAddress);

        if (!tryMarkets.reverted) {
            market.collateralFactor = tokenAmountToDecimal(
                tryMarkets.value.value1,
                BigInt.fromU32(18)
            );
        }

        // No try_borrowCaps for this compreoller abi
        const tryBorrowCaps = comptrollerContract.try_borrowCaps(
            contractAddress
        );

        if (!tryBorrowCaps.reverted) {
            market.borrowCap = tokenAmountToDecimal(
                tryBorrowCaps.value,
                BigInt.fromU32(18)
            );
        }

        if (blockNumber.lt(COMP_SPEED_SPLIT_BLOCK_NUMBER)) {
            const tryCompSpeeds = comptrollerContract.try_compSpeeds(
                marketAddress
            );

            if (tryCompSpeeds.reverted) {
                market.compSpeedSupply = ZERO_BD;
                market.compSpeedBorrow = ZERO_BD;
            } else {
                market.compSpeedSupply = tokenAmountToDecimal(
                    tryCompSpeeds.value,
                    BigInt.fromU32(18)
                );
                market.compSpeedBorrow = market.compSpeedSupply;
            }
        } else {
            const tryCompSupplySpeeds = comptrollerContract.try_compSupplySpeeds(
                marketAddress
            );

            if (tryCompSupplySpeeds.reverted) {
                market.compSpeedSupply = ZERO_BD;
            } else {
                // Comp speeds with the 10^18 scaling removed
                market.compSpeedSupply = tokenAmountToDecimal(
                    tryCompSupplySpeeds.value,
                    BigInt.fromU32(18)
                );
            }

            const tryCompBorrowSpeeds = comptrollerContract.try_compBorrowSpeeds(
                marketAddress
            );

            if (tryCompBorrowSpeeds.reverted) {
                market.compSpeedBorrow = ZERO_BD;
            } else {
                // Comp speeds with the 10^18 scaling removed
                market.compSpeedBorrow = tokenAmountToDecimal(
                    tryCompBorrowSpeeds.value,
                    BigInt.fromU32(18)
                );
            }
        }

        const compSupplyApy = calculateCompDistrubtionApy(
            market.totalSupply,
            market.compSpeedSupply,
            market.usdcPerComp,
            market.usdcPerUnderlying
        );

        const compBorrowApy = calculateCompDistrubtionApy(
            market.totalBorrow,
            market.compSpeedBorrow,
            market.usdcPerComp,
            market.usdcPerUnderlying
        );

        market.totalSupplyApy = market.supplyApy.plus(compSupplyApy);
        market.totalBorrowApy = market.borrowApy.minus(compBorrowApy);

        let availableLiquidty = market.totalSupply
            .times(market.collateralFactor)
            .minus(market.totalBorrow);

        // Clamp to min of 0
        availableLiquidty = availableLiquidty.lt(ZERO_BD)
            ? ZERO_BD
            : availableLiquidty;

        // If there is a borrow cap, inforce it
        if (market.borrowCap.notEqual(ZERO_BD)) {
            let capLeft = market.totalBorrow.gt(market.borrowCap)
                ? ZERO_BD
                : market.borrowCap.minus(market.totalBorrow);
            if (availableLiquidty.gt(capLeft)) {
                availableLiquidty = capLeft;
            }
        }

        market.availableLiquidity = availableLiquidty;

        market.availableLiquidityUsd = market.availableLiquidity.times(
            market.usdcPerUnderlying
        );

        market.save();
    }
}
