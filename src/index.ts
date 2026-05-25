// @absolutejs/onchain — tasteful, optional on-chain provenance for AbsoluteJS apps.
// Earn → gasless, soulbound, seed-is-asset collectibles with REAL editions. Provider-
// agnostic (swap adapters); ships a working local adapter so it runs with zero setup.
export { createOnchain, edition } from "./core.ts";
export type { ClaimInput, Onchain } from "./core.ts";
export { localAdapter } from "./local.ts";
export type * from "./adapter-kit/index.ts";
