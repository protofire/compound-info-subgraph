import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");

export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
export const CETH_ADDRESS = "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5";
export const SAI_ADDRESS = "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359";
export const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
export const MKR_ADDRESS = "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2";
export const CUSDC_ADDRESS = "0x39aa39c021dfbae8fac545936693ac917d5e7563";
export const COMP_ADDRESS = "0xc00e94Cb662C3520282E6f5717214004A7f26888";
export const CCOMP_ADDRESS = "0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4";
export const PRICE_ORACLE_1_ADDRESS = "0x02557a5e05defeffd4cae6d83ea3d173b272c904"; // Used for ~100 blocks at the beginning of the protocol
export const LEGACY_CWBTC_ADDRESS = "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4";

export const PROTOCOL_ID = "1";

export const SEC_PER_HOUR = BigInt.fromU32(3600);
export const SEC_PER_DAY = BigInt.fromU32(86400);
export const SEC_PER_WEEK = BigInt.fromU32(604800);
export const DAYS_PER_YEAR = BigInt.fromU32(365);

export const PRICE_ORACLE_1_CHANGED_TO_2_BLOCK_NUMBER = BigInt.fromU32(7715908);
export const GET_PRICE_UNDERLYING_CHANGES_FROM_ETH_TO_USDC_BASE_BLOCK_NUMBER = BigInt.fromU32(10678764);
export const COMP_SPEED_SPLIT_BLOCK_NUMBER = BigInt.fromU32(13322798);
export const MERGE_BLOCK_NUMBER = BigInt.fromU32(15537393);

// Pre-Merge block timing
export const SEC_PER_BLOCK_PRE_MERGE = BigDecimal.fromString("13.5"); // Average over life of Compound pre-merge
export const BLOCK_PER_SEC_PRE_MERGE = BigDecimal.fromString("1").div(SEC_PER_BLOCK_PRE_MERGE);
export const BLOCKS_PER_DAY_PRE_MERGE = BLOCK_PER_SEC_PRE_MERGE.times(SEC_PER_DAY.toBigDecimal());

// Post-Merge block timing
export const SEC_PER_BLOCK_POST_MERGE = BigDecimal.fromString("12");
export const BLOCK_PER_SEC_POST_MERGE = BigDecimal.fromString("1").div(SEC_PER_BLOCK_POST_MERGE);
export const BLOCKS_PER_DAY_POST_MERGE = BLOCK_PER_SEC_POST_MERGE.times(SEC_PER_DAY.toBigDecimal());
