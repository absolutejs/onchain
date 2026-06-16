// @absolutejs/onchain — tasteful, optional on-chain provenance for AbsoluteJS apps.
// Earn → gasless, soulbound, seed-is-asset collectibles with REAL editions. Provider-
// agnostic (swap adapters); ships a working local adapter so it runs with zero setup.
export { createOnchain, edition } from "./core";
export type { ClaimInput, Onchain } from "./core";
export { localAdapter } from "./local";
export type * from "./adapter-kit/index";
