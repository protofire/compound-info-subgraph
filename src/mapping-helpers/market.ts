import { Address, BigInt, log } from "@graphprotocol/graph-ts";

import { Market, Protocol } from "../../generated/schema";
import { CToken } from "../../generated/templates/cToken/cToken";
import { ERC20 } from "../../generated/templates/cToken/ERC20";
import { Comptroller } from "../../generated/comptroller/comptroller";

import {
    ETH_ADDRESS,
    CETH_ADDRESS,
    SAI_ADDRESS,
    CUSDC_ADDRESS,
    COMP_ADDRESS,
    CCOMP_ADDRESS,
    PROTOCOL_ID,
    ZERO_BI,
    ZERO_BD,
    ONE_BD,
    SEC_PER_BLOCK,
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
    const protocol = Protocol.load(PROTOCOL_ID);

    if (protocol == null) {
        log.warning(
            "*** ERROR: createMarket() called before the protocol exists",
            []
        );
    }

    let market: Market;
    const contract = CToken.bind(marketAddress);
    log.info(
        `@@@@ Creating new market for ctoken: ${marketAddress.toHexString()}`,
        []
    );

    market = new Market(marketAddress.toHexString());
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
        const underlyingAddress = contract.underlying();
        const underlyingContract = ERC20.bind(underlyingAddress);
        market.underlyingAddress = underlyingAddress;

        if (market.underlyingAddress.toHexString() != SAI_ADDRESS) {
            market.underlyingName = underlyingContract.name();
            market.underlyingSymbol = underlyingContract.symbol();
        } else {
            // SAI contract returns garbage for name and symbol
            market.underlyingName = "Sai Stablecoin v1.0 (SAI)";
            market.underlyingSymbol = "SAI";
        }

        market.underlyingDecimals = BigInt.fromI32(
            underlyingContract.decimals()
        );
    }

    market.collatoralFactor = ZERO_BD;
    market.reserveFactor = ZERO_BD;
    market.cash = ZERO_BD;
    market.cTokenPerUnderlying = ZERO_BD;
    market.supplyRatePerBlock = ZERO_BD;
    market.supplyRatePerBlock = ZERO_BD;
    market.supplyApy = ZERO_BD;
    market.borrowApy = ZERO_BD;
    market.totalSupplyApy = ZERO_BD;
    market.totalBorrowApy = ZERO_BD;
    market.totalSupply = ZERO_BD;
    market.totalBorrow = ZERO_BD;
    market.totalReserves = ZERO_BD;
    market.utalization = ZERO_BD;
    market.usdcPerUnderlying = ZERO_BD;
    market.usdcPerEth = ZERO_BD;
    market.usdcPerComp = ZERO_BD;

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
        market.cTokenPerUnderlying = tokenAmountToDecimal(
            contract.exchangeRateStored(),
            BigInt.fromU32(18)
                .plus(market.underlyingDecimals)
                .minus(market.cTokenDecimals)
        );

        market.totalSupply = tokenAmountToDecimal(
            contract.totalSupply(),
            market.cTokenDecimals
        ).times(market.cTokenPerUnderlying);

        market.totalReserves = tokenAmountToDecimal(
            contract.totalReserves(),
            market.underlyingDecimals
        );

        market.utalization = market.totalSupply.notEqual(ZERO_BD)
            ? market.totalBorrow.div(market.totalSupply)
            : ZERO_BD;

        market.totalBorrow = tokenAmountToDecimal(
            contract.totalBorrows(),
            market.underlyingDecimals
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

        market.comptrollerAddress = contract.comptroller();

        const comptrollerContract = Comptroller.bind(
            changetype<Address>(market.comptrollerAddress)
        );

        const tryCompSupplySpeeds = comptrollerContract.try_compSupplySpeeds(
            marketAddress
        );

        if (tryCompSupplySpeeds.reverted) {
            market.compSpeedSupply = ZERO_BD;
        } else {
            // Comp speeds with the 10^18 scaling removed
            market.compSpeedSupply = tokenAmountToDecimal(
                comptrollerContract.compSupplySpeeds(marketAddress),
                BigInt.fromU32(18)
            );
        }

        const try_compBorrowSpeeds = comptrollerContract.try_compBorrowSpeeds(
            marketAddress
        );

        if (try_compBorrowSpeeds.reverted) {
            market.compSpeedBorrow = ZERO_BD;
        } else {
            // Comp speeds with the 10^18 scaling removed
            market.compSpeedBorrow = tokenAmountToDecimal(
                comptrollerContract.compBorrowSpeeds(marketAddress),
                BigInt.fromU32(18)
            );
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
        market.totalBorrowApy = market.borrowApy.plus(compBorrowApy);

        market.save();
    }
}
