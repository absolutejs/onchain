# @absolutejs/onchain

Tasteful, **optional** on-chain provenance for AbsoluteJS apps. Let users **earn**
gasless, **soulbound** (non-transferable), **seed-is-asset** collectibles with **real
editions** — and ownership that **cannot be faked or forced, even by the app operator**.

Provider-agnostic: swap adapters for any chain/wallet/randomness. Ships a **working local
adapter** so it runs with zero setup; real chains live in `@absolutejs/onchain-adapters`.

## Principles (the whole point)

- **The seed is the asset.** Items are deterministic functions of a seed — tiny to store,
  re-derivable forever by anyone. The on-chain record is just the seed.
- **Soulbound = earned, not bought.** Non-transferable ⇒ no market, no speculation.
- **Gasless + walletless.** Users never touch crypto (embedded wallet + paymaster).
- **Real editions, literal numbers.** `edition()` returns `"1 of 1"` or `"#3 of 50"` —
  never a probability. (A "≈ 1 in N" generator preview is *not* ownership.)
- **Un-forgeable.** A mint requires an `Attestation` bound to an **externally verifiable
  fact** (e.g. a real GitHub commit). No fact, no token — the operator can't conjure one.

## Quick start (local adapter, no setup)

```ts
import { createOnchain, edition, localAdapter } from "@absolutejs/onchain";

const onchain = createOnchain(localAdapter({ file: "~/.myapp/ledger.json" }));

// the ONLY path to ownership: earn → attest(verifiable fact) → mint(soulbound, real serial)
const token = await onchain.claim("user-id", {
  seed: "wild:acme/app@abc123",            // the deterministic asset
  fact: "github:commit:acme/app@abc123",   // the real interaction it's earned from
  archetype: "wild-creature",
  maxSupply: 1                              // ⇒ a literal 1-of-1
});
edition(token); // "1 of 1"
await onchain.inventory("user-id");         // what they've earned
```

Swap `localAdapter()` for `baseAdapter({...})` (`@absolutejs/onchain-base`) for real,
gasless, soulbound mints on Base — same `claim` API.

## Adapter contract

Implement `@absolutejs/onchain/adapter-kit`: `WalletProvider`, `Attester` (the integrity
gate — verify the fact, then sign), `MintProvider` (uniqueness + serials), and optionally
`RandomnessProvider` (VRF for true 1-of-1 rolls). See `@absolutejs/onchain-adapters`.

> The local adapter's Attester does **not** verify facts (it's fakeable, for dev only).
> Real integrity comes from a chain adapter whose Attester re-checks the fact.
