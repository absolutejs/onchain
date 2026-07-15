# @absolutejs/onchain

Tasteful, **optional** on-chain provenance for AbsoluteJS apps. Let users **earn**
gasless, **seed-is-asset** collectibles with **real editions**, immutable origin ownership,
and auditable application-controlled sale, trade, gift, and recovery transfers.

Provider-agnostic: swap adapters for any chain/wallet/randomness. Ships a **working local
adapter** so it runs with zero setup; real chains live in `@absolutejs/onchain-adapters`.

## Principles (the whole point)

- **The seed is the asset.** Items are deterministic functions of a seed — tiny to store,
  re-derivable forever by anyone. The on-chain record is just the seed.
- **Earned origin never changes.** `originOwner` and the mint event survive every transfer.
- **Transferability is explicit.** Badges stay soulbound; market items opt in at mint.
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

Marketable assets use `soulbound: false`. After the application's off-chain wallet
settles atomically, it calls `transfer()` with an idempotent settlement reference. Public
provenance contains ownership and settlement references—not card or identity data.

Swap `localAdapter()` for `baseAdapter({...})` (`@absolutejs/onchain-base`) for real,
gasless, soulbound mints on Base — same `claim` API.

## Adapter contract

Implement `@absolutejs/onchain/adapter-kit`: `WalletProvider`, `Attester` (the integrity
gate — verify the fact, then sign), `MintProvider` (uniqueness + serials), and optionally
`RandomnessProvider` (VRF for true 1-of-1 rolls). Market-capable mint providers also
implement `transfer` and `provenance`. See `@absolutejs/onchain-adapters`.

> The local adapter's Attester does **not** verify facts (it's fakeable, for dev only).
> Real integrity comes from a chain adapter whose Attester re-checks the fact.
