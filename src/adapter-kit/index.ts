// @absolutejs/onchain/adapter-kit — the provider contract every adapter implements.
// The design principles: "the seed is the asset" (deterministic, tiny,
// re-derivable), GASLESS + walletless
// (users never touch crypto), REAL editions (literal "#3 of 50" / "1 of 1", never a
// probability), and — most importantly — ownership that CANNOT BE FAKED OR FORCED, even
// by the app operator: a mint requires an Attestation tied to an externally-verifiable
// fact (a real, third-party-checkable event), so you can't conjure a token without the
// genuine interaction having actually happened.

export type Address = string;
export type Hex = string;

// An embedded, app-provisioned wallet keyed to an app identity — no seed phrase, no gas.
export interface WalletProvider {
  readonly id: string;
  ensureWallet(userId: string): Promise<{ address: Address }>;
  addressFor(userId: string): Promise<Address | null>;
}

// A genuine-interaction proof. `fact` is an EXTERNALLY VERIFIABLE reference (e.g.
// "github:commit:<repo>@<sha>") — a real-chain Attester re-checks it against the source
// of truth before signing, which is what makes ownership un-forgeable: no fact, no token.
export interface Attestation {
  subject: Address;     // who is earning it
  seed: string;         // the asset seed (e.g. keccak(githubId:repo:sha:kind)) — the asset itself
  fact: string;         // the verifiable real-world event this mint is earned from
  archetype: string;    // what kind of thing (e.g. "wild-creature", "crate:season1")
  issuedAt: number;
  signature: Hex;       // signed by the trusted attester key
}

export interface Attester {
  readonly id: string;
  // Verify `fact` against the real source of truth, then sign. MUST throw if the fact
  // can't be independently verified — this is the anti-fake / anti-force gate.
  attest(input: Omit<Attestation, "signature">): Promise<Attestation>;
  verify(att: Attestation): Promise<boolean>;
}

// A minted, earned collectible with a REAL edition (literal serial of a literal supply).
export interface MintReceipt {
  tokenId: string;
  archetype: string;
  seed: string;
  owner: Address;
  /** Immutable first owner, retained across every later transfer. */
  originOwner?: Address;
  serial: number;       // this is the Nth ever minted of its archetype...
  supply: number;       // ...out of this many total (supply 1 ⇒ a literal 1-of-1)
  soulbound: boolean;
  mintedAt: number;
  txRef?: string;       // chain tx / receipt reference (absent for the local adapter)
}

export type TransferReason = "sale" | "trade" | "gift" | "recovery";

export interface ProvenanceEvent {
  tokenId: string;
  sequence: number;
  kind: "mint" | "transfer";
  from: Address | null;
  to: Address;
  reason: "earned" | TransferReason;
  settlementRef?: string;
  txRef?: string;
  occurredAt: number;
}

export interface TransferInput {
  tokenId: string;
  from: Address;
  to: Address;
  reason: TransferReason;
  /** Idempotent marketplace/trade settlement reference. Never card or identity data. */
  settlementRef: string;
}

export interface TransferReceipt {
  tokenId: string;
  from: Address;
  to: Address;
  reason: TransferReason;
  settlementRef: string;
  txRef?: string;
  transferredAt: number;
}

export interface MintProvider {
  readonly id: string;
  // Mint requires a valid Attestation → no faked or forced ownership. Enforces seed
  // uniqueness (a seed mints exactly once) and assigns the next serial in the archetype.
  mint(att: Attestation, opts: { maxSupply?: number; soulbound?: boolean }): Promise<MintReceipt>;
  ownerOf(tokenId: string): Promise<Address | null>;
  isSeedUsed(seed: string): Promise<boolean>;
  ownedBy(owner: Address): Promise<MintReceipt[]>;
  /** Optional for backward-compatible soulbound adapters. Market adapters implement both methods. */
  transfer?(input: TransferInput): Promise<TransferReceipt>;
  provenance?(tokenId: string): Promise<ProvenanceEvent[]>;
}

// Provably-fair randomness (e.g. Chainlink VRF) for the genuine 1-of-1 rolls.
export interface RandomnessProvider {
  readonly id: string;
  random(salt: string): Promise<{ value: bigint; proof?: Hex }>;
}

export interface OnchainAdapters {
  wallet: WalletProvider;
  attester: Attester;
  mint: MintProvider;
  randomness?: RandomnessProvider;
}
