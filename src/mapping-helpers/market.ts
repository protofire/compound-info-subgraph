import {
    Address,
    BigDecimal,
    BigInt,
    ByteArray,
    Bytes,
    log,
} from "@graphprotocol/graph-ts";

import { Market, Protocol } from "../../generated/schema";
import { CToken } from "../../generated/templates/cToken/cToken";
import { ERC20 } from "../../generated/templates/cToken/ERC20";
import { Comptroller } from "../../generated/comptroller/comptroller";

import {
    ETH_ADDRESS,
    CETH_ADDRESS,
    SAI_ADDRESS,
    CUSDC_ADDRESS,
    PROTOCOL_ID,
    ZERO_BI,
    ZERO_BD,
    SEC_PER_BLOCK,
} from "../utils/constants";
import {
    getTokenPrice,
    getETHinUSD,
    getUSDCpriceETH,
    getCOMPinUSD,
} from "./oracle";
import {
    exponentToBigDecimal,
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
    market.numberOfSuppliers = ZERO_BI;
    market.numberOfborrowers = ZERO_BI;
    market.usdcPerUnderlying = ZERO_BD;

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

        // After block 10678764 price is calculated based on USD instead of ETH
        if (blockNumber.gt(BigInt.fromU64(10678764))) {
            let ethPriceInUSD = getETHinUSD(blockNumber);

            if (ZERO_BD == ethPriceInUSD) {
                log.warning("***ERROR: GOT ZERO FOR ETH PRICE IN USD", []);
                return;
            }

            // if cETH, we only update USD price
            if (CETH_ADDRESS == market.id) {
                market.usdcPerUnderlying = ethPriceInUSD.truncate(
                    market.underlyingDecimals.toU32()
                );
            } else {
                let tokenPriceUSD = getTokenPrice(
                    blockNumber,
                    contractAddress,
                    changetype<Address>(market.underlyingAddress),
                    market.underlyingDecimals
                );
                market.ethPerUnderlying = tokenPriceUSD
                    .div(ethPriceInUSD)
                    .truncate(market.underlyingDecimals.toU32());
                // if USDC, we only update ETH price
                if (CUSDC_ADDRESS != market.id) {
                    market.usdcPerUnderlying = tokenPriceUSD.truncate(
                        market.underlyingDecimals.toU32()
                    );
                }
            }
        } else {
            let usdPriceInEth = getUSDCpriceETH(blockNumber);

            if (ZERO_BD == usdPriceInEth) {
                log.warning("***ERROR: GOT ZERO FOR USD PRICE IN ETH", []);
                return;
            }

            // if cETH, we only update USD price
            if (CETH_ADDRESS == market.id) {
                market.usdcPerUnderlying = market.ethPerUnderlying
                    .div(usdPriceInEth)
                    .truncate(market.underlyingDecimals.toU32());
            } else {
                let tokenPriceEth = getTokenPrice(
                    blockNumber,
                    contractAddress,
                    changetype<Address>(market.underlyingAddress),
                    market.underlyingDecimals
                );
                market.ethPerUnderlying = tokenPriceEth.truncate(
                    market.underlyingDecimals.toU32()
                );
                // if USDC, we only update ETH price
                if (CUSDC_ADDRESS != market.id) {
                    market.usdcPerUnderlying = market.ethPerUnderlying
                        .div(usdPriceInEth)
                        .truncate(market.underlyingDecimals.toU32());
                }
            }
        }

        market.latestBlockNumber = contract.accrualBlockNumber();

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

        market.utalization = market.totalBorrow.div(market.totalSupply);

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

        const comptrollerContract = Comptroller.bind(market.comptrollerAddress);

        // Comp speeds with the 10^18 scaling removed
        market.compSpeedSupply = tokenAmountToDecimal(
            comptrollerContract.compSupplySpeeds(marketAddress),
            BigInt.fromU32(18)
        );
        market.compSpeedBorrow = tokenAmountToDecimal(
            comptrollerContract.compBorrowSpeeds(marketAddress),
            BigInt.fromU32(18)
        );

        market.usdcPerComp = getCOMPinUSD(blockNumber);

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
